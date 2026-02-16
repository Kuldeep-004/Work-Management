import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import Timesheet from "../models/Timesheet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format minutes to "Xh Ym" format
 */
function formatTimeHM(totalMinutes = 0) {
  const h = Math.floor((totalMinutes || 0) / 60);
  const m = Math.abs((totalMinutes || 0) % 60);
  return `${h}h ${m}m`;
}

/**
 * Get minutes between two time strings
 */
function getMinutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) endM += 24 * 60; // cross midnight
  return endM - startM;
}

/**
 * Generate PDF report of timesheets (matching frontend format exactly)
 * @param {Date} date - Date to generate report for
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateTimesheetPDF = async (date) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get all submitted timesheets for the target date
    const timesheets = await Timesheet.find({
      date: {
        $gte: targetDate,
        $lt: nextDate,
      }
    })
    .populate("user", "firstName lastName email role")
    .populate("entries.task", "title")
    .lean();
    
    console.log(timesheets,targetDate);
    if (timesheets.length === 0) {
      console.log(
        `[TimesheetReport] No submitted timesheets found for ${targetDate.toISOString().split("T")[0]}`,
      );
      return null;
    }

    // Create PDF with exact same format as frontend
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let cursorY = margin;

    const fontSize = 12;
    const titleFontSize = fontSize + 2;
    const headerFontSize = fontSize - 1;
    const bodyFontSize = fontSize - 3;
    const tableFontSize = fontSize - 3;

    // Format nice date
    const niceDate = targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Title
    doc.setFontSize(titleFontSize);
    doc.setTextColor(33);
    doc.text("Subordinate Timesheets", margin, cursorY);
    doc.setFontSize(headerFontSize);
    doc.setTextColor(80);
    doc.text(niceDate, pageWidth - margin, cursorY, { align: "right" });
    cursorY += 8;

    // Grand total
    const grandTotal = timesheets.reduce(
      (acc, ts) =>
        acc +
        ts.entries
          .filter(
            (e) =>
              e.approvalStatus === "pending" || e.approvalStatus === "accepted",
          )
          .reduce((s, e) => s + getMinutesBetween(e.startTime, e.endTime), 0),
      0,
    );
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(60);
    doc.text(`Total (all users): ${formatTimeHM(grandTotal)}`, margin, cursorY);
    cursorY += 4;

    // Divider
    doc.setDrawColor(220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 4;

    // Column widths
    const tableWidth = pageWidth - margin * 2;
    const colTimeslot = 28;
    const colTask = 32;
    const colTimeSpent = 16;
    const colStatus = 12;
    const colDesc =
      tableWidth - colTimeslot - colTask - colTimeSpent - colStatus;

    // Function to add user section
    const addUserSection = (ts) => {
      const name =
        `${ts?.user?.firstName || ""} ${ts?.user?.lastName || ""}`.trim();
      const role = ts?.user?.role || "";
      const email = ts?.user?.email || "";

      // Header block
      doc.setFontSize(fontSize);
      doc.setTextColor(33);
      doc.text(name || "User", margin, cursorY);
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(100);
      cursorY += 4;
      if (email) doc.text(email, margin, cursorY);
      if (role) doc.text(`Role: ${role}`, margin + 80, cursorY);

      // Total time (excluding permission)
      const totalMins = ts.entries
        .filter(
          (e) =>
            e.approvalStatus === "pending" || e.approvalStatus === "accepted",
        )
        .filter(
          (e) => e.manualTaskName !== "Permission" && e.task !== "permission",
        )
        .reduce((sum, e) => sum + getMinutesBetween(e.startTime, e.endTime), 0);
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(20, 80, 180);
      doc.text(
        `Total: ${formatTimeHM(totalMins)}`,
        pageWidth - margin,
        cursorY,
        { align: "right" },
      );
      cursorY += 5;

      // Sort entries by start time
      const sortedEntries = [...(ts.entries || [])].sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        const [aHour, aMin] = a.startTime.split(":").map(Number);
        const [bHour, bMin] = b.startTime.split(":").map(Number);
        const aTime = aHour * 60 + aMin;
        const bTime = bHour * 60 + bMin;
        return aTime - bTime;
      });

      // Table rows
      const rows = sortedEntries.map((e) => {
        const timeslot =
          e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : "N/A";
        const taskName = e?.task?.title || e?.manualTaskName || "N/A";
        const description = e?.workDescription || "N/A";
        let statusIcon = "";
        if (typeof e.approvalStatus === "string") {
          if (e.approvalStatus.toLowerCase() === "accepted") statusIcon = "A";
          else if (e.approvalStatus.toLowerCase() === "rejected")
            statusIcon = "R";
        }
        const mins = getMinutesBetween(e.startTime, e.endTime);
        const timeSpent = formatTimeHM(mins);
        return [timeslot, taskName, description, timeSpent, statusIcon];
      });

      // Render table
      autoTable(doc,{
        startY: cursorY,
        margin: { left: margin, right: margin },
        head: [
          [
            "Timeslot",
            "Task Name",
            "Description",
            { content: "Time", styles: { halign: "right" } },
            "State",
          ],
        ],
        body: rows.length ? rows : [["-", "-", "No Entries", "-", "-"]],
        styles: {
          fontSize: tableFontSize,
          cellPadding: 2.2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: 60,
          lineColor: [230, 230, 230],
        },
        columnStyles: {
          0: { cellWidth: colTimeslot },
          1: { cellWidth: colTask },
          2: { cellWidth: colDesc },
          3: { cellWidth: colTimeSpent, halign: "right" },
          4: { cellWidth: colStatus, halign: "center" },
        },
      });

      cursorY = doc.lastAutoTable.finalY + 12;

      // Signature lines
      const signLineY = cursorY;
      const signLineLength = 38;
      doc.setDrawColor(80);
      doc.line(margin, signLineY, margin + signLineLength, signLineY);
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(60);
      doc.text("Hari Sir's Sign", margin, signLineY + 6);
      doc.line(
        pageWidth - margin - signLineLength,
        signLineY,
        pageWidth - margin,
        signLineY,
      );
      doc.text(
        "Team Head Sign",
        pageWidth - margin - signLineLength,
        signLineY + 6,
      );

      cursorY += 18;

      // Section divider
      doc.setDrawColor(230);
      doc.line(margin, cursorY - 2, pageWidth - margin, cursorY - 2);
    };

    // Add each timesheet
    timesheets.forEach((ts, idx) => {
      if (idx > 0) {
        if (cursorY > doc.internal.pageSize.getHeight() - 50) {
          doc.addPage();
          cursorY = margin + 8;
        } else {
          cursorY += 2;
        }
      }
      addUserSection(ts);
    });

    // Add page numbers
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(bodyFontSize - 2);
      doc.setTextColor(120);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" },
      );
    }

    // Save PDF to file
    const reportsDir = path.join(__dirname, "..", "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const dateStr = targetDate.toISOString().split("T")[0];
    const fileName = `Timesheets-${dateStr}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    // Save to file system
    const pdfBuffer = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

    console.log(
      `[TimesheetReport] Generated PDF timesheet report: ${fileName} (${timesheets.length} timesheets, ${timesheets.reduce((sum, ts) => sum + ts.entries.length, 0)} entries)`,
    );

    return filePath;
  } catch (error) {
    console.error(
      "[TimesheetReport] Error generating timesheet PDF:",
      error.message,
    );
    throw error;
  }
};

/**
 * Get the previous working day (skips Sundays)
 * @param {Date} fromDate - Starting date (defaults to today)
 * @returns {Date} - Previous working day
 */
export const getPreviousWorkingDay = (fromDate = new Date()) => {
  const date = new Date(fromDate);
  date.setHours(0, 0, 0, 0);

  // Go back one day
  date.setDate(date.getDate() - 1);

  // If it's Sunday (0), go back one more day to Saturday
  if (date.getDay() === 0) {
    date.setDate(date.getDate() - 1);
  }

  return date;
};

/**
 * Clean up old report files (older than 7 days)
 */
export const cleanupOldReports = () => {
  try {
    const reportsDir = path.join(__dirname, "..", "reports");

    if (!fs.existsSync(reportsDir)) {
      return;
    }

    const files = fs.readdirSync(reportsDir);
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[TimesheetReport] Cleaned up ${deletedCount} old report files`,
      );
    }
  } catch (error) {
    console.error(
      "[TimesheetReport] Error cleaning up old reports:",
      error.message,
    );
  }
};
