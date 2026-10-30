import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { UdhaariRecord } from '../types/udhaari';
import { formatDisplayDate } from '../utils/date';

/**
 * Downloads or saves/shares a structured Word document (.doc) containing the complete Udhaari report.
 * Works on Android device storage and PC browser.
 */
export async function downloadDocReport(records: UdhaariRecord[]): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = formatDisplayDate(dateStr);

  let totalOutstandingPaise = 0;
  let totalRepaidPaise = 0;
  let totalOverduePaise = 0;

  for (const r of records) {
    const paid = r.paidPaise || 0;
    const remaining = Math.max(0, r.amountPaise - paid);
    if (r.status === 'repaid') {
      totalRepaidPaise += r.amountPaise;
    } else {
      totalOutstandingPaise += remaining;
      totalRepaidPaise += paid;
      if (r.dueDate && r.dueDate < dateStr) {
        totalOverduePaise += remaining;
      }
    }
  }

  const formatRs = (paise: number) => `Rs ${(paise / 100).toLocaleString('en-IN')}`;

  const tableRows = records
    .map((r, i) => {
      const paid = r.paidPaise || 0;
      const remaining = Math.max(0, r.amountPaise - paid);
      const statusText =
        r.status === 'repaid'
          ? '<span style="color: #047857; font-weight: bold;">Repaid</span>'
          : r.dueDate && r.dueDate < dateStr
          ? '<span style="color: #b91c1c; font-weight: bold;">Overdue</span>'
          : r.status === 'partial'
          ? '<span style="color: #2563eb; font-weight: bold;">Partial</span>'
          : '<span style="color: #b45309; font-weight: bold;">Pending</span>';

      return `
        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold;">${r.personName}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${r.phoneNumber || '-'}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">${formatRs(r.amountPaise)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">${formatRs(paid)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${remaining > 0 ? '#b91c1c' : '#047857'};">${formatRs(remaining)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${statusText}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${formatDisplayDate(r.dateGiven)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${r.dueDate ? formatDisplayDate(r.dueDate) : '-'}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 0.85em; color: #475569;">${r.notes || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Credit Ledger Statement</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; margin: 24px; color: #0f172a; line-height: 1.4; }
        h1 { color: #047857; margin-bottom: 4px; font-size: 24px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        .summary-card { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
        .summary-grid { width: 100%; border-collapse: collapse; }
        .summary-grid td { padding: 8px; vertical-align: top; }
        .stat-val { font-size: 18px; font-weight: bold; }
        .stat-lbl { font-size: 12px; color: #475569; text-transform: uppercase; }
        table.records { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        th { background: #0f172a; color: #ffffff; padding: 10px 8px; text-align: left; border: 1px solid #0f172a; }
      </style>
    </head>
    <body>
      <h1>Udhaari Manager - Credit Ledger Report</h1>
      <div class="meta">Report Date: ${nowDisplay} | Total Records: ${records.length} | Generated Offline</div>

      <div class="summary-card">
        <table class="summary-grid">
          <tr>
            <td>
              <div class="stat-lbl">Total Outstanding</div>
              <div class="stat-val" style="color: #b91c1c;">${formatRs(totalOutstandingPaise)}</div>
            </td>
            <td>
              <div class="stat-lbl">Total Repaid</div>
              <div class="stat-val" style="color: #047857;">${formatRs(totalRepaidPaise)}</div>
            </td>
            <td>
              <div class="stat-lbl">Overdue Amount</div>
              <div class="stat-val" style="color: #dc2626;">${formatRs(totalOverduePaise)}</div>
            </td>
            <td>
              <div class="stat-lbl">Total Accounts</div>
              <div class="stat-val" style="color: #2563eb;">${records.length}</div>
            </td>
          </tr>
        </table>
      </div>

      <table class="records">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Customer Name</th>
            <th>Phone</th>
            <th style="text-align: right;">Total (Rs)</th>
            <th style="text-align: right;">Paid (Rs)</th>
            <th style="text-align: right;">Balance (Rs)</th>
            <th style="text-align: center;">Status</th>
            <th style="text-align: center;">Given Date</th>
            <th style="text-align: center;">Due Date</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        Generated by Udhaari Manager Android App • Safe Local Offline Ledger
      </div>
    </body>
    </html>
  `;

  const timeSuffix = new Date().getTime();
  const filename = `udhaari_report_${dateStr}_${timeSuffix}.doc`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(docHtml)));
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      const uriResult = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'Credit Ledger Statement (.doc)',
        text: `Credit Ledger Statement (${records.length} accounts)`,
        url: uriResult.uri,
        files: [uriResult.uri],
        dialogTitle: 'Save / Share Credit Ledger Document',
      });
      return;
    } catch (err) {
      console.warn('Native DOC save/share failed, falling back to browser download', err);
    }
  }

  // Browser fallback
  const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads or saves/shares a clean PDF report using jsPDF.
 * Works on Android device storage and PC browser.
 */
export async function downloadPdfReport(records: UdhaariRecord[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = new Date().toISOString().split('T')[0];
  const nowDisplay = formatDisplayDate(dateStr);

  let totalOutstandingPaise = 0;
  let totalRepaidPaise = 0;
  let totalOverduePaise = 0;

  for (const r of records) {
    const paid = r.paidPaise || 0;
    const remaining = Math.max(0, r.amountPaise - paid);
    if (r.status === 'repaid') {
      totalRepaidPaise += r.amountPaise;
    } else {
      totalOutstandingPaise += remaining;
      totalRepaidPaise += paid;
      if (r.dueDate && r.dueDate < dateStr) {
        totalOverduePaise += remaining;
      }
    }
  }

  const formatRs = (paise: number) => `Rs ${(paise / 100).toLocaleString('en-IN')}`;

  const drawHeader = (pageNum: number) => {
    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 50, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Udhaari Manager - Credit Ledger Report', 30, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${nowDisplay} | Page ${pageNum}`, pageWidth - 30, 32, { align: 'right' });
  };

  let currentPage = 1;
  drawHeader(currentPage);

  // Summary Metrics Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(30, 65, pageWidth - 60, 48, 4, 4, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(30, 65, pageWidth - 60, 48, 4, 4, 'S');

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL OUTSTANDING', 45, 82);
  doc.text('TOTAL REPAID', 185, 82);
  doc.text('OVERDUE AMOUNT', 325, 82);
  doc.text('TOTAL ACCOUNTS', 465, 82);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(formatRs(totalOutstandingPaise), 45, 100);

  doc.setTextColor(4, 120, 87);
  doc.text(formatRs(totalRepaidPaise), 185, 100);

  doc.setTextColor(220, 38, 38);
  doc.text(formatRs(totalOverduePaise), 325, 100);

  doc.setTextColor(37, 99, 235);
  doc.text(String(records.length), 465, 100);

  // Table header
  let y = 135;
  const colX = [30, 50, 175, 245, 305, 365, 425, 490];

  const drawTableHeader = (currY: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(30, currY, pageWidth - 60, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', colX[0] + 5, currY + 13);
    doc.text('Customer Name', colX[1], currY + 13);
    doc.text('Phone', colX[2], currY + 13);
    doc.text('Total (Rs)', colX[3] + 45, currY + 13, { align: 'right' });
    doc.text('Paid (Rs)', colX[4] + 45, currY + 13, { align: 'right' });
    doc.text('Balance (Rs)', colX[5] + 45, currY + 13, { align: 'right' });
    doc.text('Due Date', colX[6], currY + 13);
    doc.text('Status', colX[7], currY + 13);
  };

  drawTableHeader(y);
  y += 24;

  records.forEach((r, idx) => {
    if (y > pageHeight - 50) {
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 65;
      drawTableHeader(y);
      y += 24;
    }

    const paid = r.paidPaise || 0;
    const remaining = Math.max(0, r.amountPaise - paid);
    const isOdd = idx % 2 === 1;

    if (isOdd) {
      doc.setFillColor(248, 250, 252);
      doc.rect(30, y - 10, pageWidth - 60, 18, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(30, y + 8, pageWidth - 30, y + 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text(String(idx + 1), colX[0] + 5, y + 2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const shortName = r.personName.length > 22 ? r.personName.substring(0, 20) + '..' : r.personName;
    doc.text(shortName, colX[1], y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(r.phoneNumber || '-', colX[2], y + 2);

    doc.setTextColor(15, 23, 42);
    doc.text((r.amountPaise / 100).toLocaleString('en-IN'), colX[3] + 45, y + 2, { align: 'right' });

    doc.setTextColor(4, 120, 87);
    doc.text((paid / 100).toLocaleString('en-IN'), colX[4] + 45, y + 2, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    if (remaining > 0) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(4, 120, 87);
    }
    doc.text((remaining / 100).toLocaleString('en-IN'), colX[5] + 45, y + 2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(r.dueDate || '-', colX[6], y + 2);

    if (r.status === 'repaid') {
      doc.setTextColor(4, 120, 87);
      doc.text('Repaid', colX[7], y + 2);
    } else if (r.dueDate && r.dueDate < dateStr) {
      doc.setTextColor(220, 38, 38);
      doc.text('Overdue', colX[7], y + 2);
    } else if (r.status === 'partial') {
      doc.setTextColor(37, 99, 235);
      doc.text('Partial', colX[7], y + 2);
    } else {
      doc.setTextColor(180, 83, 9);
      doc.text('Pending', colX[7], y + 2);
    }

    y += 18;
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated by Udhaari Manager Android App • 100% Offline Ledger', pageWidth / 2, pageHeight - 20, {
    align: 'center',
  });

  const timeSuffix = new Date().getTime();
  const filename = `udhaari_report_${dateStr}_${timeSuffix}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.split(',')[1];

      // 1. Write file to phone Documents
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (docErr) {
        console.warn('Documents folder write fallback', docErr);
      }

      // 2. Also write to Cache so Share intent can access content URI
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      const uriResult = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });

      // 3. Open Android native Share/Save bottom sheet (ONLY pass files, NOT url)
      await Share.share({
        title: 'Credit Ledger PDF Statement',
        files: [uriResult.uri],
        dialogTitle: 'Save / Share PDF Statement',
      });
      return;
    } catch (err) {
      console.warn('Native PDF save/share error, running browser download fallback', err);
    }
  }

  // Browser download fallback (Direct file download)
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}

/**
 * Explicitly shares PDF report via WhatsApp / installed apps
 */
export async function sharePdfReport(records: UdhaariRecord[]): Promise<void> {
  await downloadPdfReport(records);
}

