import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import type { UdhaariRecord, PaymentEntry } from '../types/udhaari';

export const DB_NAME = 'udhaari_manager_db';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS udhaari_records (
  id TEXT PRIMARY KEY NOT NULL,
  person_id TEXT,
  person_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  paid_paise INTEGER NOT NULL DEFAULT 0,
  payment_history TEXT NOT NULL DEFAULT '[]',
  date_given TEXT NOT NULL,
  due_date TEXT,
  phone_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  repaid_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_status ON udhaari_records(status);
CREATE INDEX IF NOT EXISTS idx_records_date_given ON udhaari_records(date_given);
CREATE INDEX IF NOT EXISTS idx_records_person_name ON udhaari_records(person_name);
CREATE INDEX IF NOT EXISTS idx_records_person_id ON udhaari_records(person_id);
`;

const WEB_STORAGE_KEY = 'udhaari_records_offline_store';

let isDbInitialized = false;

/**
 * Checks if the app is currently running in a native Capacitor environment (Android/iOS)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initializes the SQLite database on Android or the local fallback on web.
 * Safe to call multiple times; will not re-create or wipe existing data.
 */
export async function initializeDatabase(): Promise<void> {
  if (isDbInitialized) return;

  if (isNativePlatform()) {
    try {
      try {
        await CapacitorSQLite.createConnection({
          database: DB_NAME,
          encrypted: false,
          mode: 'no-encryption',
          version: 1,
          readonly: false,
        });
      } catch {
        // Connection already created
      }

      // Check if DB is opened
      const isOpen = await CapacitorSQLite.isDBOpen({ database: DB_NAME });
      if (!isOpen.result) {
        await CapacitorSQLite.open({ database: DB_NAME, readonly: false });
      }

      // Run schema migrations/creation
      await CapacitorSQLite.execute({
        database: DB_NAME,
        statements: CREATE_TABLE_SQL,
      });

      // Backward-compatible migrations for existing databases
      try {
        await CapacitorSQLite.execute({
          database: DB_NAME,
          statements: `ALTER TABLE udhaari_records ADD COLUMN paid_paise INTEGER NOT NULL DEFAULT 0;`,
        });
      } catch {
        // column already exists
      }

      try {
        await CapacitorSQLite.execute({
          database: DB_NAME,
          statements: `ALTER TABLE udhaari_records ADD COLUMN payment_history TEXT NOT NULL DEFAULT '[]';`,
        });
      } catch {
        // column already exists
      }

      try {
        await CapacitorSQLite.execute({
          database: DB_NAME,
          statements: `ALTER TABLE udhaari_records ADD COLUMN person_id TEXT;`,
        });
      } catch {
        // column already exists
      }

      isDbInitialized = true;
      console.log('Udhaari Manager: Native SQLite database successfully initialized');
    } catch (err) {
      console.error('Udhaari Manager: SQLite initialization error', err);
      throw new Error(`Failed to initialize SQLite database: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    // Web Fallback for browser development / testing
    try {
      if (!localStorage.getItem(WEB_STORAGE_KEY)) {
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify([]));
      }
      isDbInitialized = true;
      console.log('Udhaari Manager: Web local storage fallback initialized');
    } catch (err) {
      console.error('Udhaari Manager: Web fallback initialization error', err);
    }
  }
}

/**
 * Row mapping from SQLite table columns to TypeScript UdhaariRecord
 */
export function mapSqliteRowToRecord(row: Record<string, unknown>): UdhaariRecord {
  let paymentHistory: PaymentEntry[] = [];
  if (row.payment_history) {
    try {
      paymentHistory = JSON.parse(String(row.payment_history));
    } catch {
      paymentHistory = [];
    }
  }

  const rawStatus = String(row.status || 'pending');
  const status: UdhaariRecord['status'] =
    rawStatus === 'repaid' ? 'repaid' : rawStatus === 'partial' ? 'partial' : 'pending';

  return {
    id: String(row.id),
    personId: row.person_id ? String(row.person_id) : undefined,
    personName: String(row.person_name),
    amountPaise: Number(row.amount_paise),
    paidPaise: Number(row.paid_paise || 0),
    paymentHistory,
    dateGiven: String(row.date_given),
    dueDate: row.due_date ? String(row.due_date) : null,
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    notes: row.notes ? String(row.notes) : null,
    status,
    repaidDate: row.repaid_date ? String(row.repaid_date) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Executes a SELECT query safely on native SQLite or web fallback
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = []
): Promise<T[]> {
  await initializeDatabase();

  if (isNativePlatform()) {
    const res = await CapacitorSQLite.query({
      database: DB_NAME,
      statement: sql,
      values: values as (string | number | boolean | null)[],
    });
    return (res.values || []) as T[];
  } else {
    // For web fallback, we handle the queries via in-memory representation
    const raw = localStorage.getItem(WEB_STORAGE_KEY) || '[]';
    const records: UdhaariRecord[] = JSON.parse(raw);
    return records as unknown as T[];
  }
}

/**
 * Executes an INSERT / UPDATE / DELETE statement safely
 */
export async function executeRun(
  sql: string,
  values: unknown[] = []
): Promise<number> {
  await initializeDatabase();

  if (isNativePlatform()) {
    const res = await CapacitorSQLite.run({
      database: DB_NAME,
      statement: sql,
      values: values as (string | number | boolean | null)[],
    });
    return res.changes?.changes ?? 0;
  }
  return 1;
}

/**
 * Direct web storage helper used only when not in native platform
 */
export function getWebStorageRecords(): UdhaariRecord[] {
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setWebStorageRecords(records: UdhaariRecord[]): void {
  try {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save to web storage fallback', err);
  }
}
