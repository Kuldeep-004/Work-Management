// Utility to generate a PDF for Subordinate Timesheets view
// Includes: user name, role, email, total time, and a table of Timeslot | Task Name | Description | Time Spent
// Uses jsPDF and jspdf-autotable with line wrapping and full-width layout.

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Format minutes -> `Xh Ym`
function formatTimeHM(totalMinutes = 0) {
  const h = Math.floor((totalMinutes || 0) / 60);
  const m = Math.abs((totalMinutes || 0) % 60);
  return `${h}h ${m}m`;
}

// Get minutes between two 24h time strings like "09:00" and "10:30"
function getMinutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) endM += 24 * 60; // cross midnight
  return endM - startM;
}

// dateStr: ISO date string or display-ready date
// timesheets: array of { user: {firstName,lastName,role,email}, date, entries: [...] }
export default function generateTimesheetPdf({ dateStr, timesheets, fileLabel = 'timesheets' }) {
  if (!Array.isArray(timesheets) || timesheets.length === 0) {
    throw new Error('No timesheets to export');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let cursorY = margin;

  const niceDate = (() => {
    try {
      const d = new Date(dateStr);
      // If invalid dateStr is passed, fallback to raw string
      if (isNaN(d.getTime())) return String(dateStr || '');
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateStr || '');
    }
  })();

  // Title
  doc.setFontSize(14);
  doc.setTextColor(33);
  doc.text('Subordinate Timesheets', margin, cursorY);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(niceDate, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 8;

  // Optional total for all
  try {
    const grandTotal = timesheets.reduce((acc, ts) => acc + ts.entries.reduce((s, e) => s + getMinutesBetween(e.startTime, e.endTime), 0), 0);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Total (all users): ${formatTimeHM(grandTotal)}`, margin, cursorY);
    cursorY += 4;
  } catch {}

  // Divider
  doc.setDrawColor(220);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4;

  // Prepare column widths to fill full width
  const tableWidth = pageWidth - margin * 2;
  const colTimeslot = 32; // mm
  const colTimeSpent = 25; // mm
  const remaining = tableWidth - colTimeslot - colTimeSpent; // for Task + Description
  const colTask = Math.max(40, Math.round(remaining * 0.42));
  const colDesc = Math.max(40, remaining - colTask);

  const addUserSection = (ts) => {
    const name = `${ts?.user?.firstName || ''} ${ts?.user?.lastName || ''}`.trim();
    const role = ts?.user?.role || '';
    const email = ts?.user?.email || '';

    // Header block with name/role/email and total time on the right
    doc.setFontSize(12);
    doc.setTextColor(33);
    doc.text(name || 'User', margin, cursorY);
    doc.setFontSize(9);
    doc.setTextColor(100);
    cursorY += 4;
    if (email) doc.text(email, margin, cursorY);
    if (role) doc.text(`Role: ${role}`, margin + 80, cursorY); // same line to save space

    // Total time on right
    const totalMins = ts.entries.reduce((sum, e) => sum + getMinutesBetween(e.startTime, e.endTime), 0);
    doc.setFontSize(10);
    doc.setTextColor(20, 80, 180);
    doc.text(`Total: ${formatTimeHM(totalMins)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 5;

    // Table data
    const rows = (ts.entries || []).map(e => {
      const timeslot = (e.startTime && e.endTime) ? `${e.startTime} - ${e.endTime}` : 'N/A';
      const taskName = e?.task?.title || e?.manualTaskName || 'N/A';
      const description = e?.workDescription || 'N/A';
      const mins = getMinutesBetween(e.startTime, e.endTime);
      const timeSpent = `${mins} min`;
      return [timeslot, taskName, description, timeSpent];
    });

    // Render table
    doc.autoTable({
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Timeslot', 'Task Name', 'Description', 'Time Spent']],
      body: rows.length ? rows : [['-', '-', 'No Entries', '-']],
      styles: { fontSize: 9, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [245, 245, 245], textColor: 60, lineColor: [230, 230, 230] },
      columnStyles: {
        0: { cellWidth: colTimeslot },
        1: { cellWidth: colTask },
        2: { cellWidth: colDesc },
        3: { cellWidth: colTimeSpent, halign: 'right' }
      },
      didDrawPage: (data) => {
        // Add footer page numbers
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
      }
    });

    cursorY = doc.lastAutoTable.finalY + 12; // Add more space for signatures

    // Signature lines
    const signLineY = cursorY;
    const signLineLength = 38; // mm
    // Hari Sir's Sign (left)
    doc.setDrawColor(80);
    doc.line(margin, signLineY, margin + signLineLength, signLineY);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text("Hari Sir's Sign", margin, signLineY + 6);
    // Team Head Sign (right)
    doc.line(pageWidth - margin - signLineLength, signLineY, pageWidth - margin, signLineY);
    doc.text('Team Head Sign', pageWidth - margin - signLineLength, signLineY + 6);

    cursorY += 18; // Add space after signatures for next section

    // Section divider
    doc.setDrawColor(230);
    doc.line(margin, cursorY - 2, pageWidth - margin, cursorY - 2);
  };

  timesheets.forEach((ts, idx) => {
    if (idx > 0) {
      // If near bottom, start a new page for clean section start
      if (cursorY > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        cursorY = margin + 8; // a little below top margin
      } else {
        cursorY += 2;
      }
    }
    addUserSection(ts);
  });

  // File name
  const label = fileLabel || 'timesheets';
  const ymd = (() => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr || 'date');
      return d.toISOString().slice(0, 10);
    } catch { return 'date'; }
  })();
  doc.save(`${label}_${ymd}.pdf`);
}
