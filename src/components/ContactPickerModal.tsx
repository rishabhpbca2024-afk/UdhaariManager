import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Phone, BookUser, Check, Upload, UserPlus, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { getAllRecords } from '../services/repository';
import { getAllSavedContacts, saveContact, saveBulkContacts, parseVCF, type SavedContact } from '../services/contactDb';
import { validateIndianMobile } from '../utils/validation';

export interface ContactDisplayItem {
  id: string;
  name: string;
  phoneNumber: string;
  source: 'phonebook' | 'history' | 'imported' | 'manual';
}

interface ContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { name: string; phoneNumber: string }) => void;
}

export const ContactPickerModal: React.FC<ContactPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<ContactDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingPhone, setIsSyncingPhone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Contact inline form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAllContacts = async () => {
    setIsLoading(true);
    const map = new Map<string, ContactDisplayItem>();

    // 1. Load from SQLite app_contacts
    try {
      const dbContacts = await getAllSavedContacts();
      for (const c of dbContacts) {
        const key = `${c.name.toLowerCase()}_${c.phoneNumber}`;
        map.set(key, {
          id: c.id,
          name: c.name,
          phoneNumber: c.phoneNumber,
          source: c.source,
        });
      }
    } catch (err) {
      console.warn('Failed loading contacts from SQLite:', err);
    }

    // 2. Load from transaction records (Existing Customers)
    try {
      const records = await getAllRecords();
      for (const r of records) {
        const name = String(r.personName || '').trim();
        const rawPhone = String(r.phoneNumber || '').trim();
        if (name && rawPhone) {
          const clean = validateIndianMobile(rawPhone).cleaned || rawPhone.replace(/[^\d+]/g, '');
          const key = `${name.toLowerCase()}_${clean}`;
          if (!map.has(key)) {
            map.set(key, {
              id: `rec_${r.id}`,
              name,
              phoneNumber: clean,
              source: 'history',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Failed loading history records:', err);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    setContacts(sorted);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setStatusMessage(null);
      setShowAddForm(false);
      return;
    }
    loadAllContacts();
  }, [isOpen]);

  // Sync phonebook contacts to SQLite
  const handleSyncPhoneContacts = async () => {
    try {
      setIsSyncingPhone(true);
      setStatusMessage('Requesting contacts permission...');

      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await Contacts.checkPermissions();
          if (perm.contacts !== 'granted') {
            const req = await Contacts.requestPermissions();
            if (req.contacts !== 'granted') {
              setStatusMessage('Contacts permission was denied.');
              setIsSyncingPhone(false);
              return;
            }
          }
        } catch (permErr) {
          console.warn('Permission check error:', permErr);
        }

        setStatusMessage('Reading device phonebook...');
        const res = await Contacts.getContacts({
          projection: {
            name: true,
            phones: true,
          },
        });

        if (res && res.contacts && res.contacts.length > 0) {
          const toSave: Array<{ name: string; phoneNumber: string; source: SavedContact['source'] }> = [];
          for (const c of res.contacts) {
            const name = (c.name?.display || c.name?.given || '').trim();
            const phones = c.phones || [];
            for (const p of phones) {
              const rawPhone = (p.number || '').trim();
              if (name && rawPhone) {
                toSave.push({ name, phoneNumber: rawPhone, source: 'phonebook' });
              }
            }
          }

          setStatusMessage(`Saving ${toSave.length} contacts to SQLite...`);
          const count = await saveBulkContacts(toSave);
          await loadAllContacts();
          setStatusMessage(`✅ ${count} contacts synced into SQLite!`);
        } else {
          setStatusMessage('No contacts found on device.');
        }
      } else {
        setStatusMessage('Sync is available on Android. For web, please use .vcf import.');
      }
    } catch (err: any) {
      console.error('Failed to sync contacts:', err);
      setStatusMessage('Error reading contacts: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSyncingPhone(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Google Contacts .vcf file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = parseVCF(text);

        if (parsed.length === 0) {
          setStatusMessage('No valid contacts found in this .vcf file.');
          return;
        }

        setStatusMessage(`Saving ${parsed.length} contacts to database...`);
        const count = await saveBulkContacts(
          parsed.map((p) => ({ ...p, source: 'imported' }))
        );
        await loadAllContacts();
        setStatusMessage(`✅ ${count} Google contacts imported into SQLite!`);
      } catch (err) {
        console.error('Failed to parse .vcf file', err);
        setStatusMessage('Failed to import .vcf file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  // Save new contact manually into SQLite
  const handleSaveNewContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setAddError('Please enter a name.');
      return;
    }
    const validation = validateIndianMobile(newPhone);
    if (!validation.isValid) {
      setAddError(validation.error || 'Please enter a valid phone number.');
      return;
    }

    try {
      const saved = await saveContact(newName.trim(), validation.cleaned || newPhone, 'manual');
      await loadAllContacts();
      setShowAddForm(false);
      setNewName('');
      setNewPhone('');
      setAddError(null);
      setStatusMessage(`✅ Saved ${saved.name} to SQLite contacts!`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save contact:', err);
      setAddError('Failed to save to database.');
    }
  };

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNumber.replace(/\s+/g, '').includes(q)
    );
  }, [contacts, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content-sheet"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #1c1c24)',
          borderRadius: '22px 22px 0 0',
          border: '1px solid var(--border, rgba(255,255,255,0.12))',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.18)',
                color: 'var(--primary, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookUser size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main, #fff)' }}>
                Select Contact
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {contacts.length} Contacts in Local SQLite
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action bar (Sync, Import .vcf, Add Contact) */}
        <div
          style={{
            padding: '10px 20px 4px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          {/* Sync Phone Contacts */}
          <button
            type="button"
            onClick={handleSyncPhoneContacts}
            disabled={isSyncingPhone}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.75rem',
              padding: '6px 11px',
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: 'var(--primary, #6366f1)',
              fontWeight: 600,
              cursor: isSyncingPhone ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Sync all contacts from phonebook into SQLite"
          >
            <RefreshCw size={12} className={isSyncingPhone ? 'animate-spin' : ''} />
            <span>{isSyncingPhone ? 'Syncing...' : 'Sync Phone Contacts'}</span>
          </button>

          {/* Import Google Contacts (.vcf) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.75rem',
              padding: '6px 11px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Import Google Contacts .vcf file into SQLite"
          >
            <Upload size={12} />
            <span>Import Google (.vcf)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.vcard"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          {/* Add New Contact Button */}
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.75rem',
              padding: '6px 11px',
              borderRadius: 8,
              background: showAddForm ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: showAddForm ? '#ef4444' : 'var(--text-main, #fff)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {showAddForm ? <X size={12} /> : <UserPlus size={12} />}
            <span>{showAddForm ? 'Cancel' : '+ Add Contact'}</span>
          </button>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            style={{
              margin: '6px 20px 0 20px',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: 'var(--text-main, #fff)',
              fontSize: '0.78rem',
              textAlign: 'center',
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* Inline Add Contact Form */}
        {showAddForm && (
          <form
            onSubmit={handleSaveNewContact}
            style={{
              margin: '10px 20px 4px 20px',
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main, #fff)' }}>
              Save New Contact into SQLite
            </div>
            <input
              type="text"
              placeholder="Contact Name (e.g. Suresh Patel)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--bg-surface, #131317)',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                color: '#fff',
                fontSize: '0.86rem',
                outline: 'none',
              }}
            />
            <input
              type="tel"
              placeholder="10-digit Phone Number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--bg-surface, #131317)',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                color: '#fff',
                fontSize: '0.86rem',
                outline: 'none',
              }}
            />
            {addError && (
              <div style={{ fontSize: '0.74rem', color: '#ef4444' }}>{addError}</div>
            )}
            <button
              type="submit"
              style={{
                padding: '8px',
                borderRadius: 8,
                background: 'var(--primary, #6366f1)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Save to Database
            </button>
          </form>
        )}

        {/* Live Search Input */}
        <div style={{ padding: '10px 20px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary, #94a3b8)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              autoFocus
              placeholder="Search name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 38px 11px 40px',
                background: 'var(--bg-surface, #131317)',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                borderRadius: 12,
                fontSize: '0.92rem',
                color: 'var(--text-main, #fff)',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Contacts List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 20px 20px',
            maxHeight: '52vh',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary, #94a3b8)' }}>
              Loading contacts from SQLite...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary, #94a3b8)' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-main, #fff)' }}>
                No contacts found
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {searchTerm
                  ? `No contacts match "${searchTerm}"`
                  : 'Tap "Sync Phone Contacts" or "Import Google (.vcf)" above to add contacts into SQLite!'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredContacts.map((c) => {
                const initials =
                  c.name
                    .split(' ')
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '?';

                let badgeColor = 'rgba(99, 102, 241, 0.15)';
                let badgeText = '#818cf8';
                let badgeLabel = 'Contact';

                if (c.source === 'history') {
                  badgeColor = 'rgba(16, 185, 129, 0.15)';
                  badgeText = '#10b981';
                  badgeLabel = 'Customer';
                } else if (c.source === 'imported') {
                  badgeColor = 'rgba(245, 158, 11, 0.15)';
                  badgeText = '#f59e0b';
                  badgeLabel = 'Google';
                } else if (c.source === 'phonebook') {
                  badgeColor = 'rgba(59, 130, 246, 0.15)';
                  badgeText = '#60a5fa';
                  badgeLabel = 'Phone';
                }

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelect({ name: c.name, phoneNumber: c.phoneNumber });
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background:
                            c.source === 'history'
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : c.source === 'imported'
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                              : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 600,
                              color: 'var(--text-main, #fff)',
                            }}
                          >
                            {c.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: badgeColor,
                              color: badgeText,
                              fontWeight: 600,
                            }}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary, #94a3b8)',
                            marginTop: 2,
                          }}
                        >
                          <Phone size={12} />
                          <span>{c.phoneNumber}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        color: 'var(--primary, #6366f1)',
                        opacity: 0.6,
                      }}
                    >
                      <Check size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPickerModal;
