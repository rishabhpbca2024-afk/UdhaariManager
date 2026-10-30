import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { UdhaariRecord, BackupPayload, PaymentEntry } from '../types/udhaari';

const BACKUP_VERSION = 2;

/**
 * Creates a structured JSON backup payload
 */
export function createBackupPayload(records: UdhaariRecord[]): BackupPayload {
  return {
    app: 'Udhaari Manager',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    recordsCount: records.length,
    records,
  };
}

/**
 * Initiates local download or native share of JSON backup file.
 * Completely offline, works inside Android WebView and modern browsers.
 */
export async function downloadBackupFile(records: UdhaariRecord[]): Promise<void> {
  const payload = createBackupPayload(records);
  const jsonString = JSON.stringify(payload, null, 2);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeSuffix = now.getTime();
  const filename = `udhaari_backup_${dateStr}_${timeSuffix}.json`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
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
        title: 'Udhaari Manager Database Backup',
        text: `Udhaari Manager Backup (${records.length} accounts)`,
        url: uriResult.uri,
        files: [uriResult.uri],
        dialogTitle: 'Save Backup to Device / Google Drive',
      });
      return;
    } catch (err) {
      console.warn('Native JSON backup save/share failed, falling back to browser download', err);
    }
  }

  // Web Browser fallback
  const blob = new Blob([jsonString], { type: 'application/json' });
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
 * Exports records as a clean Excel-compatible CSV file.
 * Uses UTF-8 BOM so Hindi/English names display properly in Excel / Google Sheets.
 */
export async function downloadCsvFile(records: UdhaariRecord[]): Promise<void> {
  const headers = [
    'Customer Name',
    'Phone Number',
    'Total Amount (Rs)',
    'Paid Amount (Rs)',
    'Remaining Balance (Rs)',
    'Status',
    'Date Given',
    'Due Date',
    'Notes',
    'Repaid Date',
  ];

  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => {
    const totalRs = (r.amountPaise / 100).toFixed(2);
    const paidRs = ((r.paidPaise || 0) / 100).toFixed(2);
    const remRs = (Math.max(0, r.amountPaise - (r.paidPaise || 0)) / 100).toFixed(2);
    const statusText =
      r.status === 'repaid'
        ? 'Repaid'
        : r.status === 'partial'
        ? 'Partial'
        : 'Pending';

    return [
      escapeCsv(r.personName),
      escapeCsv(r.phoneNumber || ''),
      escapeCsv(totalRs),
      escapeCsv(paidRs),
      escapeCsv(remRs),
      escapeCsv(statusText),
      escapeCsv(r.dateGiven),
      escapeCsv(r.dueDate || ''),
      escapeCsv(r.notes || ''),
      escapeCsv(r.repaidDate || ''),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');

  const dateStr = new Date().toISOString().split('T')[0];
  const timeSuffix = new Date().getTime();
  const filename = `udhaari_report_${dateStr}_${timeSuffix}.csv`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(csvContent)));
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
        title: 'Udhaari Excel / CSV Report',
        text: `Udhaari CSV Report (${records.length} accounts)`,
        url: uriResult.uri,
        files: [uriResult.uri],
        dialogTitle: 'Save to Device / Share CSV',
      });
      return;
    } catch (err) {
      console.warn('Native CSV backup save/share failed, falling back to browser download', err);
    }
  }

  // Web Browser fallback
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidationResult =
  | { success: true; records: UdhaariRecord[]; count: number }
  | { success: false; error: string; isDocOrPdf?: boolean; fileType?: 'pdf' | 'doc' };

/**
 * Parses a CSV line handling quoted values
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses and validates an uploaded backup file (JSON or CSV).
 * Gracefully detects PDF or DOC files to explain to user why they cannot be imported.
 */
export function validateBackupFile(rawText: string, fileName?: string): BackupValidationResult {
  const lowerName = (fileName || '').toLowerCase();

  // 1. Check for PDF or DOC file signatures
  if (
    lowerName.endsWith('.pdf') ||
    rawText.startsWith('%PDF') ||
    rawText.includes('/Type /Catalog')
  ) {
    return {
      success: false,
      isDocOrPdf: true,
      fileType: 'pdf',
      error: 'Aapne PDF report select ki hai. PDF file sirf padhne aur print nikalne ke liye hoti hai, isse database me data restore nahi kiya ja sakta. Kripya ".json" backup file ya CSV file select karein.',
    };
  }

  if (
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    rawText.startsWith('\xD0\xCF\x11\xE0') ||
    rawText.startsWith('PK\x03\x04') ||
    rawText.includes('<html')
  ) {
    return {
      success: false,
      isDocOrPdf: true,
      fileType: 'doc',
      error: 'Aapne Word (.doc) document select kiya hai. Word files sirf dekhne ya print nikalne ke liye hoti hain. Data restore karne ke liye kripya ".json" backup file ya CSV file select karein.',
    };
  }

  // 2. Try JSON Parsing first
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);

      let list: unknown[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { records: unknown[] }).records)) {
        list = (parsed as { records: unknown[] }).records;
      }

      if (list.length > 0) {
        const validatedRecords: UdhaariRecord[] = [];

        for (let i = 0; i < list.length; i++) {
          const item = list[i] as Record<string, unknown>;
          if (!item || typeof item !== 'object') continue;

          if (!item.personName || typeof item.personName !== 'string' || item.personName.trim().length === 0) {
            continue;
          }

          const amountPaise = Number(item.amountPaise);
          if (isNaN(amountPaise) || amountPaise <= 0) continue;

          const dateGiven = typeof item.dateGiven === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dateGiven)
            ? item.dateGiven
            : new Date().toISOString().split('T')[0];

          const paidPaise = Math.max(0, Number(item.paidPaise || 0));
          const paymentHistory: PaymentEntry[] = Array.isArray(item.paymentHistory)
            ? (item.paymentHistory as PaymentEntry[])
            : [];

          const id = typeof item.id === 'string' && item.id.trim().length > 0
            ? item.id
            : `udh_restored_${Date.now()}_${i}`;

          const rawStatus = String(item.status || 'pending');
          const status: UdhaariRecord['status'] =
            rawStatus === 'repaid' || paidPaise >= amountPaise
              ? 'repaid'
              : rawStatus === 'partial' || paidPaise > 0
              ? 'partial'
              : 'pending';

          const dueDate = item.dueDate && typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
            ? item.dueDate
            : null;

          const repaidDate = item.repaidDate && typeof item.repaidDate === 'string'
            ? item.repaidDate
            : (status === 'repaid' ? dateGiven : null);

          validatedRecords.push({
            id,
            personName: item.personName.trim(),
            amountPaise,
            paidPaise,
            paymentHistory,
            dateGiven,
            dueDate,
            phoneNumber: item.phoneNumber && typeof item.phoneNumber === 'string' ? item.phoneNumber.trim() : null,
            notes: item.notes && typeof item.notes === 'string' ? item.notes.trim() : null,
            status,
            repaidDate,
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
            updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
          });
        }

        if (validatedRecords.length > 0) {
          return {
            success: true,
            records: validatedRecords,
            count: validatedRecords.length,
          };
        }
      }
    }
  } catch {
    // Not valid JSON, try CSV next
  }

  // 3. Try CSV Parsing
  try {
    const cleanText = rawText.replace(/^\uFEFF/, ''); // remove BOM if present
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length >= 2) {
      const headerLine = lines[0].toLowerCase();
      if (headerLine.includes('customer') || headerLine.includes('amount') || headerLine.includes('name')) {
        const validatedRecords: UdhaariRecord[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          if (cols.length < 3) continue;

          const personName = cols[0];
          const phoneNumber = cols[1] || null;
          const totalAmountRs = parseFloat(cols[2].replace(/[^0-9.]/g, ''));
          const paidRs = cols[3] ? parseFloat(cols[3].replace(/[^0-9.]/g, '')) || 0 : 0;
          const dateGiven = cols[6] && /^\d{4}-\d{2}-\d{2}$/.test(cols[6]) ? cols[6] : new Date().toISOString().split('T')[0];
          const dueDate = cols[7] && /^\d{4}-\d{2}-\d{2}$/.test(cols[7]) ? cols[7] : null;
          const notes = cols[8] || null;

          if (!personName || isNaN(totalAmountRs) || totalAmountRs <= 0) continue;

          const amountPaise = Math.round(totalAmountRs * 100);
          const paidPaise = Math.round(paidRs * 100);

          const status: UdhaariRecord['status'] =
            paidPaise >= amountPaise ? 'repaid' : paidPaise > 0 ? 'partial' : 'pending';

          validatedRecords.push({
            id: `udh_csv_${Date.now()}_${i}`,
            personName: personName.trim(),
            amountPaise,
            paidPaise,
            paymentHistory: [],
            dateGiven,
            dueDate,
            phoneNumber: phoneNumber ? phoneNumber.trim() : null,
            notes: notes ? notes.trim() : null,
            status,
            repaidDate: status === 'repaid' ? dateGiven : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (validatedRecords.length > 0) {
          return {
            success: true,
            records: validatedRecords,
            count: validatedRecords.length,
          };
        }
      }
    }
  } catch (err) {
    console.warn('CSV parse failed', err);
  }

  return {
    success: false,
    error: 'Aapki file recognize nahi ho saki. Kripya Udhaari Manager se download ki gayi ".json" backup file ya CSV file select karein.',
  };
}

// Backward compatibility alias
export const validateBackupJson = validateBackupFile;
