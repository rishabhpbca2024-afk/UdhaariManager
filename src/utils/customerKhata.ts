import type { UdhaariRecord, CustomerKhata } from '../types/udhaari';
import { isDueDatePassed } from './date';

/**
 * Normalizes customer name for grouping (case-insensitive, trimmed, single spaces)
 */
export function normalizeCustomerName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generates a stable deterministic ID for a person based on their normalized name & phone
 */
export function getStablePersonId(name: string, phone?: string | null): string {
  const normName = normalizeCustomerName(name);
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const key = `${normName}_${cleanPhone}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return 'pid_' + Math.abs(hash).toString(36);
}

/**
 * Groups all individual transaction entries by customer name and calculates cumulative totals.
 * Handles cases where Aman borrows 100 times (10-10 rupees) so the user sees:
 * - Aman: Total ₹1,000 pending across 100 entries
 */
export function groupRecordsByCustomer(records: UdhaariRecord[]): CustomerKhata[] {
  const map = new Map<string, {
    canonicalName: string;
    phoneNumber?: string | null;
    records: UdhaariRecord[];
  }>();

  for (const record of records) {
    const key = normalizeCustomerName(record.personName);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.records.push(record);
      // Prefer record with phone number if available
      if (!existing.phoneNumber && record.phoneNumber) {
        existing.phoneNumber = record.phoneNumber;
      }
      // If newer name has better casing
      if (record.personName.trim().length > existing.canonicalName.length) {
        existing.canonicalName = record.personName.trim();
      }
    } else {
      map.set(key, {
        canonicalName: record.personName.trim(),
        phoneNumber: record.phoneNumber || null,
        records: [record],
      });
    }
  }

  const khatas: CustomerKhata[] = [];

  for (const [, { canonicalName, phoneNumber, records: customerRecords }] of map) {
    let totalUdhaarPaise = 0;
    let totalPaidPaise = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let repaidCount = 0;
    let overdueCount = 0;
    let lastDate = '0000-00-00';

    // Sort customer records by dateGiven DESC, createdAt DESC
    customerRecords.sort((a, b) => {
      const cmpDate = b.dateGiven.localeCompare(a.dateGiven);
      if (cmpDate !== 0) return cmpDate;
      return b.createdAt.localeCompare(a.createdAt);
    });

    for (const r of customerRecords) {
      const paid = r.paidPaise || 0;
      totalUdhaarPaise += r.amountPaise;
      totalPaidPaise += paid;

      if (r.dateGiven > lastDate) {
        lastDate = r.dateGiven;
      }

      if (r.status === 'repaid' || paid >= r.amountPaise) {
        repaidCount++;
      } else {
        const remaining = Math.max(0, r.amountPaise - paid);
        if (remaining > 0) {
          if (r.dueDate && isDueDatePassed(r.dueDate)) {
            overdueCount++;
          }
          if (r.status === 'partial' || paid > 0) {
            partialCount++;
          } else {
            pendingCount++;
          }
        }
      }
    }

    const remainingPaise = Math.max(0, totalUdhaarPaise - totalPaidPaise);
    const personId = getStablePersonId(canonicalName, phoneNumber);

    khatas.push({
      personId,
      personName: canonicalName,
      phoneNumber,
      totalUdhaarPaise,
      totalPaidPaise,
      remainingPaise,
      recordsCount: customerRecords.length,
      pendingCount,
      partialCount,
      repaidCount,
      overdueCount,
      lastDate: lastDate === '0000-00-00' ? customerRecords[0]?.dateGiven || '' : lastDate,
      records: customerRecords,
    });
  }

  // Sort khatas: Customers with highest pending balance first, then by last date
  khatas.sort((a, b) => {
    if (b.remainingPaise !== a.remainingPaise) {
      return b.remainingPaise - a.remainingPaise;
    }
    return b.lastDate.localeCompare(a.lastDate);
  });

  return khatas;
}

/**
 * Returns quick customer summary for any given person name
 */
export function getCustomerSummary(records: UdhaariRecord[], personName: string | null | undefined) {
  const norm = normalizeCustomerName(personName);
  if (!norm) {
    return {
      totalRemainingPaise: 0,
      recordsCount: 0,
      totalUdhaarPaise: 0,
      totalPaidPaise: 0,
    };
  }

  const matched = records.filter((r) => r && normalizeCustomerName(r.personName) === norm);

  let totalUdhaarPaise = 0;
  let totalPaidPaise = 0;

  for (const r of matched) {
    totalUdhaarPaise += (r.amountPaise || 0);
    totalPaidPaise += (r.paidPaise || 0);
  }

  return {
    totalRemainingPaise: Math.max(0, totalUdhaarPaise - totalPaidPaise),
    recordsCount: matched.length,
    totalUdhaarPaise,
    totalPaidPaise,
  };
}
