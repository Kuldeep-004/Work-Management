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
// fontSize: base font size for the PDF (default: 12)
export default function generateTimesheetPdf({ dateStr, timesheets, fileLabel = 'timesheets', fontSize = 12 }) {
  if (!Array.isArray(timesheets) || timesheets.length === 0) {
    throw new Error('No timesheets to export');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let cursorY = margin;

  // Calculate font sizes based on the base fontSize
  const titleFontSize = fontSize + 2;
  const headerFontSize = fontSize - 1;
  const bodyFontSize = fontSize - 3;
  const tableFontSize = fontSize - 3;

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
  doc.setFontSize(titleFontSize);
  doc.setTextColor(33);
  doc.text('Subordinate Timesheets', margin, cursorY);
  doc.setFontSize(headerFontSize);
  doc.setTextColor(80);
  doc.text(niceDate, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 8;

  // Optional total for all
  try {
    const grandTotal = timesheets.reduce((acc, ts) => 
      acc + ts.entries
        .filter(e => e.approvalStatus === 'pending' || e.approvalStatus === 'accepted')
        .reduce((s, e) => s + getMinutesBetween(e.startTime, e.endTime), 0), 0);
    doc.setFontSize(bodyFontSize);
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
  const colTimeslot = 28; // mm
  const colTask = 32; // mm
  const colTimeSpent = 16; // mm (rightmost except status)
  const colStatus = 12; // mm (very right, smallest)
  const colDesc = tableWidth - colTimeslot - colTask - colTimeSpent - colStatus; // fill remaining width

  const addUserSection = (ts) => {
    const name = `${ts?.user?.firstName || ''} ${ts?.user?.lastName || ''}`.trim();
    const role = ts?.user?.role || '';
    const email = ts?.user?.email || '';

    // Header block with name/role/email and total time on the right
    doc.setFontSize(fontSize);
    doc.setTextColor(33);
    doc.text(name || 'User', margin, cursorY);
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(100);
    cursorY += 4;
    if (email) doc.text(email, margin, cursorY);
    if (role) doc.text(`Role: ${role}`, margin + 80, cursorY); // same line to save space

    // Total time on right (excluding permission hours)
    const totalMins = ts.entries
      .filter(e => e.approvalStatus === 'pending' || e.approvalStatus === 'accepted')
      .filter(e => e.manualTaskName !== 'Permission' && e.task !== 'permission') // Exclude permission
      .reduce((sum, e) => sum + getMinutesBetween(e.startTime, e.endTime), 0);
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(20, 80, 180);
    doc.text(`Total: ${formatTimeHM(totalMins)}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 5;

    // Table data - Sort entries by start time before processing
    const sortedEntries = [...(ts.entries || [])].sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0;
      const [aHour, aMin] = a.startTime.split(':').map(Number);
      const [bHour, bMin] = b.startTime.split(':').map(Number);
      const aTime = aHour * 60 + aMin;
      const bTime = bHour * 60 + bMin;
      return aTime - bTime;
    });

    const rows = sortedEntries.map(e => {
      const timeslot = (e.startTime && e.endTime) ? `${e.startTime} - ${e.endTime}` : 'N/A';
      const taskName = e?.task?.title || e?.manualTaskName || 'N/A';
      const description = e?.workDescription || 'N/A';
      let statusIcon = '';
      if (typeof e.approvalStatus === 'string') {
        if (e.approvalStatus.toLowerCase() === 'accepted') statusIcon = 'A';
        else if (e.approvalStatus.toLowerCase() === 'rejected') statusIcon = 'R';
      }
  const mins = getMinutesBetween(e.startTime, e.endTime);
  const timeSpent = formatTimeHM(mins);
      // New order: Timeslot, Task Name, Description, Time Spent, Status (Status at very right)
      return [timeslot, taskName, description, timeSpent, statusIcon];
    });

    // Render table
    doc.autoTable({
      startY: cursorY,
      margin: { left: margin, right: margin },
  head: [['Timeslot', 'Task Name', 'Description', { content: 'Time', styles: { halign: 'right' } }, 'State']],
      body: rows.length ? rows : [['-', '-', 'No Entries', '-', '-']],
      styles: { fontSize: tableFontSize, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [245, 245, 245], textColor: 60, lineColor: [230, 230, 230] },
      columnStyles: {
        0: { cellWidth: colTimeslot },
        1: { cellWidth: colTask },
        2: { cellWidth: colDesc },
        3: { cellWidth: colTimeSpent, halign: 'right' },
        4: { cellWidth: colStatus, halign: 'center' }
      },
      didDrawPage: (data) => {
        // Add footer page numbers - fix by calculating total pages after all content is added
        doc.setFontSize(bodyFontSize - 2);
        doc.setTextColor(120);
        // Use data.pageNumber and calculate total pages dynamically
        const totalPages = doc.internal.getNumberOfPages();
        doc.text(`Page ${data.pageNumber} of ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
      }
    });

    cursorY = doc.lastAutoTable.finalY + 12; // Add more space for signatures

    // Signature lines
    const signLineY = cursorY;
    const signLineLength = 38; // mm
    // Hari Sir's Sign (left)
    doc.setDrawColor(80);
    doc.line(margin, signLineY, margin + signLineLength, signLineY);
    doc.setFontSize(bodyFontSize);
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
