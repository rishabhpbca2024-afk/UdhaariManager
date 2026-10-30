import {
  isNativePlatform,
  executeQuery,
  executeRun,
  mapSqliteRowToRecord,
  getWebStorageRecords,
  setWebStorageRecords,
  initializeDatabase,
} from './db';
import type { UdhaariRecord, DashboardMetrics, PaymentEntry, SettleAllDuesResult } from '../types/udhaari';
import { isDueDatePassed, getTodayDateString } from '../utils/date';
import { normalizeCustomerName, getStablePersonId } from '../utils/customerKhata';

/**
 * Generates a unique, collision-resistant ID for offline records
 */
export function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'udh_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Fetch all Udhaari records sorted by dateGiven DESC, createdAt DESC
 */
export async function getAllRecords(): Promise<UdhaariRecord[]> {
  await initializeDatabase();

  if (isNativePlatform()) {
    const rows = await executeQuery<Record<string, unknown>>(
      `SELECT * FROM udhaari_records ORDER BY date_given DESC, created_at DESC;`
    );
    return rows.map(mapSqliteRowToRecord);
  } else {
    const list = getWebStorageRecords();
    return list.sort((a, b) => {
      if (b.dateGiven !== a.dateGiven) {
        return b.dateGiven.localeCompare(a.dateGiven);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
}

/**
 * Fetch a single record by its ID
 */
export async function getRecordById(id: string): Promise<UdhaariRecord | null> {
  await initializeDatabase();

  if (isNativePlatform()) {
    const rows = await executeQuery<Record<string, unknown>>(
      `SELECT * FROM udhaari_records WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    return mapSqliteRowToRecord(rows[0]);
  } else {
    const list = getWebStorageRecords();
    return list.find((r) => r.id === id) || null;
  }
}

/**
 * Create a new Udhaari record
 */
export async function createRecord(
  data: Omit<UdhaariRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UdhaariRecord> {
  await initializeDatabase();

  const now = new Date().toISOString();
  const personId = data.personId || getStablePersonId(data.personName, data.phoneNumber);
  const newRecord: UdhaariRecord = {
    ...data,
    personId,
    paidPaise: data.paidPaise || 0,
    paymentHistory: data.paymentHistory || [],
    id: generateUniqueId(),
    createdAt: now,
    updatedAt: now,
  };

  if (isNativePlatform()) {
    await executeRun(
      `INSERT INTO udhaari_records (
        id, person_id, person_name, amount_paise, paid_paise, payment_history, date_given, due_date, phone_number, notes, status, repaid_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        newRecord.id,
        newRecord.personId || null,
        newRecord.personName,
        newRecord.amountPaise,
        newRecord.paidPaise,
        JSON.stringify(newRecord.paymentHistory),
        newRecord.dateGiven,
        newRecord.dueDate,
        newRecord.phoneNumber,
        newRecord.notes,
        newRecord.status,
        newRecord.repaidDate,
        newRecord.createdAt,
        newRecord.updatedAt,
      ]
    );
  } else {
    const list = getWebStorageRecords();
    list.unshift(newRecord);
    setWebStorageRecords(list);
  }

  return newRecord;
}

/**
 * Update an existing Udhaari record
 */
export async function updateRecord(
  id: string,
  data: Partial<Omit<UdhaariRecord, 'id' | 'createdAt'>>
): Promise<UdhaariRecord> {
  await initializeDatabase();

  const existing = await getRecordById(id);
  if (!existing) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  const now = new Date().toISOString();
  const personId =
    data.personId ||
    existing.personId ||
    getStablePersonId(data.personName || existing.personName, data.phoneNumber || existing.phoneNumber);

  const updated: UdhaariRecord = {
    ...existing,
    ...data,
    personId,
    updatedAt: now,
  };

  // Re-verify status based on paidPaise vs amountPaise
  if (updated.paidPaise >= updated.amountPaise && updated.amountPaise > 0) {
    updated.status = 'repaid';
    if (!updated.repaidDate) updated.repaidDate = getTodayDateString();
  } else if (updated.paidPaise > 0) {
    updated.status = 'partial';
    updated.repaidDate = null;
  } else if (updated.status !== 'repaid') {
    updated.status = 'pending';
    updated.repaidDate = null;
  }

  if (isNativePlatform()) {
    await executeRun(
      `UPDATE udhaari_records SET
        person_id = ?,
        person_name = ?,
        amount_paise = ?,
        paid_paise = ?,
        payment_history = ?,
        date_given = ?,
        due_date = ?,
        phone_number = ?,
        notes = ?,
        status = ?,
        repaid_date = ?,
        updated_at = ?
      WHERE id = ?;`,
      [
        updated.personId || null,
        updated.personName,
        updated.amountPaise,
        updated.paidPaise,
        JSON.stringify(updated.paymentHistory || []),
        updated.dateGiven,
        updated.dueDate,
        updated.phoneNumber,
        updated.notes,
        updated.status,
        updated.repaidDate,
        updated.updatedAt,
        id,
      ]
    );
  } else {
    const list = getWebStorageRecords();
    const index = list.findIndex((r) => r.id === id);
    if (index !== -1) {
      list[index] = updated;
      setWebStorageRecords(list);
    }
  }

  return updated;
}

/**
 * Records a partial repayment (आधे पैसे वापस दिए हो तो)
 * Allows extending the due date for the remaining balance.
 */
export async function recordPartialPayment(
  id: string,
  paymentAmountPaise: number,
  newDueDate?: string | null,
  notes?: string | null
): Promise<UdhaariRecord> {
  const existing = await getRecordById(id);
  if (!existing) throw new Error('Record not found');

  const paymentDate = getTodayDateString();
  const newEntry: PaymentEntry = {
    id: generateUniqueId(),
    amountPaise: paymentAmountPaise,
    date: paymentDate,
    notes: notes || null,
  };

  const history = [...(existing.paymentHistory || []), newEntry];
  const newPaidPaise = (existing.paidPaise || 0) + paymentAmountPaise;

  const isFullyRepaid = newPaidPaise >= existing.amountPaise;

  return updateRecord(id, {
    paidPaise: newPaidPaise,
    paymentHistory: history,
    status: isFullyRepaid ? 'repaid' : 'partial',
    repaidDate: isFullyRepaid ? paymentDate : null,
    dueDate: newDueDate !== undefined ? newDueDate : existing.dueDate,
  });
}

/**
 * Delete a record permanently
 */
export async function deleteRecord(id: string): Promise<boolean> {
  await initializeDatabase();

  if (isNativePlatform()) {
    const changes = await executeRun(`DELETE FROM udhaari_records WHERE id = ?;`, [id]);
    return changes > 0;
  } else {
    const list = getWebStorageRecords();
    const filtered = list.filter((r) => r.id !== id);
    setWebStorageRecords(filtered);
    return filtered.length < list.length;
  }
}

/**
 * Toggle or set repaid status
 */
export async function setRecordRepaidStatus(
  id: string,
  isRepaid: boolean,
  repaidDate: string | null = null
): Promise<UdhaariRecord> {
  const existing = await getRecordById(id);
  if (!existing) throw new Error('Record not found');

  if (isRepaid) {
    return updateRecord(id, {
      status: 'repaid',
      paidPaise: existing.amountPaise,
      repaidDate: repaidDate || getTodayDateString(),
    });
  } else {
    return updateRecord(id, {
      status: existing.paidPaise > 0 ? 'partial' : 'pending',
      paidPaise: 0,
      paymentHistory: [],
      repaidDate: null,
    });
  }
}

/**
 * Settle all outstanding dues for a specific person.
 * Allocates repayment across all active loans for that person,
 * recording the exact remaining amount as a PaymentEntry on each active loan.
 * Ensures the repayment transaction is recorded exactly once per loan,
 * never double-counts, and leaves other customers completely untouched.
 */
export async function settleAllDuesForCustomer(
  personName: string,
  personId?: string,
  settlementDate: string = getTodayDateString(),
  notes: string = 'Sabhi hisab chukta (Full settlement)'
): Promise<SettleAllDuesResult> {
  await initializeDatabase();
  const allRecords = await getAllRecords();

  const targetNormName = normalizeCustomerName(personName);

  // Find records matching either stable personId or normalized name
  const customerRecords = allRecords.filter((r) => {
    if (personId && r.personId && r.personId === personId) return true;
    return normalizeCustomerName(r.personName) === targetNormName;
  });

  const activeRecords = customerRecords.filter(
    (r) => r.status !== 'repaid' && (r.amountPaise - (r.paidPaise || 0)) > 0
  );

  let totalSettledPaise = 0;
  const updatedRecords: UdhaariRecord[] = [];

  for (const record of activeRecords) {
    const remaining = Math.max(0, record.amountPaise - (record.paidPaise || 0));
    if (remaining <= 0) continue;

    const paymentEntry: PaymentEntry = {
      id: generateUniqueId(),
      amountPaise: remaining,
      date: settlementDate,
      notes: notes,
    };

    const newHistory = [...(record.paymentHistory || []), paymentEntry];
    const updated = await updateRecord(record.id, {
      paidPaise: record.amountPaise,
      paymentHistory: newHistory,
      status: 'repaid',
      repaidDate: settlementDate,
    });

    totalSettledPaise += remaining;
    updatedRecords.push(updated);
  }

  const finalRecords = await getAllRecords();

  return {
    customerName: personName,
    personId: personId || getStablePersonId(personName),
    totalSettledPaise,
    settledRecordsCount: updatedRecords.length,
    settlementDate,
    records: finalRecords,
  };
}

/**
 * Scans records for likely testing / mock / placeholder markers
 * (e.g. name has 'test'/'demo'/'sample', dummy phone numbers, or dummy notes)
 */
export async function findPotentialTestRecords(): Promise<UdhaariRecord[]> {
  const records = await getAllRecords();
  const dummyPhones = new Set([
    '9876543210',
    '1234567890',
    '9999999999',
    '8888888888',
    '7777777777',
    '0000000000',
  ]);

  return records.filter((r) => {
    const nameLower = (r.personName || '').toLowerCase();
    const notesLower = (r.notes || '').toLowerCase();
    const cleanPhone = (r.phoneNumber || '').replace(/[^0-9]/g, '');

    const isTestName =
      nameLower.includes('test') ||
      nameLower.includes('demo') ||
      nameLower.includes('sample') ||
      nameLower.includes('dummy');

    const isTestNote =
      notesLower.includes('test') ||
      notesLower.includes('demo') ||
      notesLower.includes('sample') ||
      notesLower.includes('dummy');

    const isDummyPhone = cleanPhone.length > 0 && dummyPhones.has(cleanPhone);

    return isTestName || isTestNote || isDummyPhone;
  });
}

/**
 * Bulk delete records by IDs safely
 */
export async function deleteMultipleRecords(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    const deleted = await deleteRecord(id);
    if (deleted) count++;
  }
  return count;
}

/**
 * Bulk import records with safe conflict resolution
 */
export async function importRecords(
  records: UdhaariRecord[],
  strategy: 'merge' | 'replace'
): Promise<{ added: number; updated: number; total: number }> {
  await initializeDatabase();

  let added = 0;
  let updated = 0;

  if (strategy === 'replace') {
    if (isNativePlatform()) {
      await executeRun(`DELETE FROM udhaari_records;`);
      for (const rec of records) {
        const personId = rec.personId || getStablePersonId(rec.personName, rec.phoneNumber);
        await executeRun(
          `INSERT INTO udhaari_records (
            id, person_id, person_name, amount_paise, paid_paise, payment_history, date_given, due_date, phone_number, notes, status, repaid_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            rec.id,
            personId || null,
            rec.personName,
            rec.amountPaise,
            rec.paidPaise || 0,
            JSON.stringify(rec.paymentHistory || []),
            rec.dateGiven,
            rec.dueDate,
            rec.phoneNumber,
            rec.notes,
            rec.status,
            rec.repaidDate,
            rec.createdAt,
            rec.updatedAt,
          ]
        );
        added++;
      }
    } else {
      setWebStorageRecords(records);
      added = records.length;
    }
    return { added, updated: 0, total: added };
  }

  // Merge strategy
  const existingRecords = await getAllRecords();
  const existingMap = new Map(existingRecords.map((r) => [r.id, r]));

  for (const rec of records) {
    if (existingMap.has(rec.id)) {
      await updateRecord(rec.id, rec);
      updated++;
    } else {
      const personId = rec.personId || getStablePersonId(rec.personName, rec.phoneNumber);
      if (isNativePlatform()) {
        await executeRun(
          `INSERT INTO udhaari_records (
            id, person_id, person_name, amount_paise, paid_paise, payment_history, date_given, due_date, phone_number, notes, status, repaid_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            rec.id,
            personId || null,
            rec.personName,
            rec.amountPaise,
            rec.paidPaise || 0,
            JSON.stringify(rec.paymentHistory || []),
            rec.dateGiven,
            rec.dueDate,
            rec.phoneNumber,
            rec.notes,
            rec.status,
            rec.repaidDate,
            rec.createdAt,
            rec.updatedAt,
          ]
        );
      } else {
        const list = getWebStorageRecords();
        list.push({ ...rec, personId });
        setWebStorageRecords(list);
      }
      added++;
    }
  }

  return { added, updated, total: added + updated };
}

/**
 * Calculates dashboard metrics from records.
 * Rules:
 * - Outstanding balance is sum of remaining unpaid amounts (amountPaise - paidPaise) for all non-repaid records.
 * - Repaid total is sum of all repaid amounts.
 * - Overdue is based on remaining balance when dueDate < today and not fully repaid.
 */
export function calculateMetrics(records: UdhaariRecord[]): DashboardMetrics {
  let totalOutstandingPaise = 0;
  let pendingCount = 0;
  let partialCount = 0;
  let totalOverduePaise = 0;
  let overdueCount = 0;
  let totalRepaidPaise = 0;
  let repaidCount = 0;

  for (const r of records) {
    const paid = r.paidPaise || 0;
    const remaining = Math.max(0, r.amountPaise - paid);

    if (r.status === 'repaid' || remaining === 0) {
      totalRepaidPaise += r.amountPaise;
      repaidCount++;
    } else {
      // Active debt (pending or partial)
      totalOutstandingPaise += remaining;
      totalRepaidPaise += paid;

      if (r.status === 'partial') {
        partialCount++;
      } else {
        pendingCount++;
      }

      if (r.dueDate && isDueDatePassed(r.dueDate)) {
        totalOverduePaise += remaining;
        overdueCount++;
      }
    }
  }

  return {
    totalOutstandingPaise,
    pendingCount,
    partialCount,
    totalOverduePaise,
    overdueCount,
    totalRepaidPaise,
    repaidCount,
    totalRecordsCount: records.length,
  };
}
