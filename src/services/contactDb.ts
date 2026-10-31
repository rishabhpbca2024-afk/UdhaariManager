import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { DB_NAME, isNativePlatform, initializeDatabase } from './db';
import { validateIndianMobile } from '../utils/validation';

export interface SavedContact {
  id: string;
  name: string;
  phoneNumber: string;
  source: 'phonebook' | 'history' | 'imported' | 'manual';
  createdAt: string;
}

const WEB_CONTACTS_KEY = 'udhaari_saved_contacts_store';

const CREATE_CONTACTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS app_contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON app_contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON app_contacts(phone_number);
`;

let isContactsTableReady = false;

/**
 * Initializes the app_contacts SQLite table
 */
export async function initializeContactsTable(): Promise<void> {
  if (isContactsTableReady) return;
  await initializeDatabase();

  if (isNativePlatform()) {
    try {
      await CapacitorSQLite.execute({
        database: DB_NAME,
        statements: CREATE_CONTACTS_TABLE_SQL,
      });
      isContactsTableReady = true;
    } catch (err) {
      console.warn('Failed to initialize app_contacts table:', err);
    }
  } else {
    isContactsTableReady = true;
  }
}

/**
 * Fetch all saved contacts from SQLite or Web storage
 */
export async function getAllSavedContacts(): Promise<SavedContact[]> {
  await initializeContactsTable();

  if (isNativePlatform()) {
    try {
      const res = await CapacitorSQLite.query({
        database: DB_NAME,
        statement: 'SELECT id, name, phone_number, source, created_at FROM app_contacts ORDER BY name ASC',
        values: [],
      });
      const rows = res.values || [];
      return rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        phoneNumber: String(r.phone_number),
        source: (r.source as SavedContact['source']) || 'manual',
        createdAt: String(r.created_at),
      }));
    } catch (err) {
      console.error('Failed to query contacts from SQLite:', err);
      return [];
    }
  } else {
    try {
      const raw = localStorage.getItem(WEB_CONTACTS_KEY);
      if (!raw) {
        // Pre-populate with realistic demo contacts on web
        const initial: SavedContact[] = [
          { id: 'c1', name: 'Ramesh Kumar', phoneNumber: '9876543210', source: 'imported', createdAt: new Date().toISOString() },
          { id: 'c2', name: 'Aman Sharma', phoneNumber: '9812345678', source: 'imported', createdAt: new Date().toISOString() },
          { id: 'c3', name: 'Rahul Verma', phoneNumber: '9765432109', source: 'imported', createdAt: new Date().toISOString() },
          { id: 'c4', name: 'Pooja Patel', phoneNumber: '9988776655', source: 'imported', createdAt: new Date().toISOString() },
          { id: 'c5', name: 'Vikas Gupta', phoneNumber: '9123456780', source: 'imported', createdAt: new Date().toISOString() },
          { id: 'c6', name: 'Sunil Mehra', phoneNumber: '9845012345', source: 'imported', createdAt: new Date().toISOString() },
        ];
        localStorage.setItem(WEB_CONTACTS_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

/**
 * Insert or update a single contact in SQLite
 */
export async function saveContact(
  name: string,
  phoneNumber: string,
  source: SavedContact['source'] = 'manual'
): Promise<SavedContact> {
  await initializeContactsTable();

  const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const cleanName = name.trim();
  const cleanPhone = validateIndianMobile(phoneNumber).cleaned || phoneNumber.replace(/[\s\-()]/g, '');

  if (isNativePlatform()) {
    await CapacitorSQLite.run({
      database: DB_NAME,
      statement: `
        INSERT OR REPLACE INTO app_contacts (id, name, phone_number, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      values: [id, cleanName, cleanPhone, source, now],
    });
  } else {
    const list = await getAllSavedContacts();
    const updated = [...list.filter(c => c.phoneNumber !== cleanPhone), { id, name: cleanName, phoneNumber: cleanPhone, source, createdAt: now }];
    localStorage.setItem(WEB_CONTACTS_KEY, JSON.stringify(updated));
  }

  return { id, name: cleanName, phoneNumber: cleanPhone, source, createdAt: now };
}

/**
 * Bulk save contacts (from phonebook sync or .vcf import)
 */
export async function saveBulkContacts(
  items: Array<{ name: string; phoneNumber: string; source: SavedContact['source'] }>
): Promise<number> {
  if (!items.length) return 0;
  await initializeContactsTable();

  const now = new Date().toISOString();
  let count = 0;

  if (isNativePlatform()) {
    try {
      for (const item of items) {
        const cleanName = item.name.trim();
        const cleanPhone = validateIndianMobile(item.phoneNumber).cleaned || item.phoneNumber.replace(/[\s\-()]/g, '');
        if (!cleanName || !cleanPhone) continue;

        const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await CapacitorSQLite.run({
          database: DB_NAME,
          statement: `
            INSERT OR REPLACE INTO app_contacts (id, name, phone_number, source, created_at)
            VALUES (?, ?, ?, ?, ?)
          `,
          values: [id, cleanName, cleanPhone, item.source, now],
        });
        count++;
      }
    } catch (err) {
      console.error('Failed bulk contacts insert:', err);
    }
  } else {
    const existing = await getAllSavedContacts();
    const phoneMap = new Map<string, SavedContact>();
    for (const c of existing) phoneMap.set(c.phoneNumber, c);

    for (const item of items) {
      const cleanName = item.name.trim();
      const cleanPhone = validateIndianMobile(item.phoneNumber).cleaned || item.phoneNumber.replace(/[\s\-()]/g, '');
      if (!cleanName || !cleanPhone) continue;

      const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      phoneMap.set(cleanPhone, {
        id,
        name: cleanName,
        phoneNumber: cleanPhone,
        source: item.source,
        createdAt: now,
      });
      count++;
    }

    localStorage.setItem(WEB_CONTACTS_KEY, JSON.stringify(Array.from(phoneMap.values())));
  }

  return count;
}

/**
 * Parses Google Contacts / Android vCard (.vcf) file content
 */
export function parseVCF(vcfText: string): Array<{ name: string; phoneNumber: string }> {
  const cards = vcfText.split(/BEGIN:VCARD/i);
  const contacts: Array<{ name: string; phoneNumber: string }> = [];

  for (const card of cards) {
    if (!card.trim()) continue;

    let name = '';
    // Formatted name FN:
    const fnMatch = card.match(/FN(?:;[^:]*)?:(.*)/i);
    if (fnMatch && fnMatch[1]) {
      name = fnMatch[1].trim().replace(/\r/g, '');
    } else {
      // Structured name N: (Last;First;Middle...)
      const nMatch = card.match(/N(?:;[^:]*)?:(.*)/i);
      if (nMatch && nMatch[1]) {
        const parts = nMatch[1].split(';').map(p => p.trim()).filter(Boolean);
        name = parts.reverse().join(' ');
      }
    }

    // Phone numbers TEL:
    const telMatches = card.matchAll(/TEL(?:;[^:]*)?:(.*)/gi);
    for (const match of telMatches) {
      if (match && match[1]) {
        const rawPhone = match[1].trim().replace(/\r/g, '');
        const cleanPhone = validateIndianMobile(rawPhone).cleaned || rawPhone.replace(/[\s\-()+]/g, '');
        if (cleanPhone && cleanPhone.length >= 6) {
          contacts.push({
            name: name || 'Contact',
            phoneNumber: cleanPhone,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return contacts.filter(c => {
    const key = `${c.name.toLowerCase()}_${c.phoneNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
