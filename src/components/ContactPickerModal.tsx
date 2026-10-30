import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Phone, BookUser, Smartphone, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { getAllRecords } from '../services/repository';
import { validateIndianMobile } from '../utils/validation';

export interface ContactItem {
  id: string;
  name: string;
  phoneNumber: string;
  source: 'phonebook' | 'history' | 'sample';
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
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningNativePicker, setIsOpeningNativePicker] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    let isMounted = true;

    async function loadContacts() {
      setIsLoading(true);
      const contactMap = new Map<string, ContactItem>();

      // 1. Load from app's previous transaction records (Existing Customers)
      try {
        const records = await getAllRecords();
        for (const r of records) {
          const name = String(r.personName || '').trim();
          const rawPhone = String(r.phoneNumber || '').trim();
          if (name && rawPhone) {
            const clean = validateIndianMobile(rawPhone).cleaned || rawPhone.replace(/[^\d+]/g, '');
            const key = `${name.toLowerCase()}_${clean}`;
            if (!contactMap.has(key)) {
              contactMap.set(key, {
                id: `rec_${r.id}`,
                name,
                phoneNumber: clean,
                source: 'history',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Could not load history records:', err);
      }

      // 2. If on native Android device, fetch phonebook contacts
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await Contacts.checkPermissions();
          if (perm.contacts !== 'granted') {
            await Contacts.requestPermissions();
          }

          const res = await Contacts.getContacts({
            projection: {
              name: true,
              phones: true,
            },
          });

          if (res && res.contacts) {
            for (const c of res.contacts) {
              const name = (c.name?.display || c.name?.given || '').trim();
              const phones = c.phones || [];
              for (const p of phones) {
                const rawPhone = (p.number || '').trim();
                if (name && rawPhone) {
                  const clean = validateIndianMobile(rawPhone).cleaned || rawPhone.replace(/[^\d+]/g, '');
                  const key = `${name.toLowerCase()}_${clean}`;
                  if (!contactMap.has(key)) {
                    contactMap.set(key, {
                      id: `phone_${c.contactId}_${rawPhone}`,
                      name,
                      phoneNumber: clean,
                      source: 'phonebook',
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Native contacts fetch failed or permission denied:', err);
        }
      } else {
        // 3. For Web testing fallback (so developers & users testing in browser see realistic contacts)
        const sampleContacts: Omit<ContactItem, 'id'>[] = [
          { name: 'Ramesh Kumar', phoneNumber: '9876543210', source: 'sample' },
          { name: 'Aman Sharma', phoneNumber: '9812345678', source: 'sample' },
          { name: 'Rahul Verma', phoneNumber: '9765432109', source: 'sample' },
          { name: 'Pooja Patel', phoneNumber: '9988776655', source: 'sample' },
          { name: 'Vikas Gupta', phoneNumber: '9123456780', source: 'sample' },
          { name: 'Sunil Mehra', phoneNumber: '9845012345', source: 'sample' },
        ];

        for (const s of sampleContacts) {
          const key = `${s.name.toLowerCase()}_${s.phoneNumber}`;
          if (!contactMap.has(key)) {
            contactMap.set(key, {
              ...s,
              id: `sample_${s.phoneNumber}`,
            });
          }
        }
      }

      if (isMounted) {
        const sorted = Array.from(contactMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setContacts(sorted);
        setIsLoading(false);
      }
    }

    loadContacts();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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

  // Open native Android contact intent directly
  const handleOpenNativePicker = async () => {
    try {
      setIsOpeningNativePicker(true);
      if (Capacitor.isNativePlatform()) {
        const res = await Contacts.pickContact({
          projection: {
            name: true,
            phones: true,
          },
        });
        if (res && res.contact) {
          const rawName = (res.contact.name?.display || res.contact.name?.given || '').trim();
          const rawPhone = (res.contact.phones?.[0]?.number || '').trim();
          const cleanPhone = validateIndianMobile(rawPhone).cleaned || rawPhone.replace(/[\s\-()]/g, '');
          if (cleanPhone || rawName) {
            onSelect({ name: rawName, phoneNumber: cleanPhone });
            onClose();
            return;
          }
        }
      } else if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
        const nav = navigator as any;
        const sel = await nav.contacts.select(['name', 'tel'], { multiple: false });
        if (sel && sel.length > 0) {
          const rawName = Array.isArray(sel[0].name) ? sel[0].name[0] : (sel[0].name || '');
          const rawPhone = Array.isArray(sel[0].tel) ? sel[0].tel[0] : (sel[0].tel || '');
          const cleanPhone = validateIndianMobile(rawPhone).cleaned || String(rawPhone).replace(/[\s\-()]/g, '');
          onSelect({ name: String(rawName).trim(), phoneNumber: cleanPhone });
          onClose();
          return;
        }
      }
    } catch (e) {
      console.warn('Native picker canceled or error:', e);
    } finally {
      setIsOpeningNativePicker(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content-sheet"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #1e1e24)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
                background: 'rgba(99, 102, 241, 0.15)',
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
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {contacts.length} contacts available
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

        {/* Search Bar & Native Picker Button */}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                border: '1px solid var(--border, rgba(255,255,255,0.12))',
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

          {/* Native Phonebook Trigger */}
          <button
            type="button"
            onClick={handleOpenNativePicker}
            disabled={isOpeningNativePicker}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--primary, #6366f1)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: isOpeningNativePicker ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Smartphone size={16} />
            <span>{isOpeningNativePicker ? 'Opening Phonebook...' : 'Open Phone Contacts List'}</span>
          </button>
        </div>

        {/* Contacts List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 20px 20px',
            maxHeight: '50vh',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary, #94a3b8)' }}>
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary, #94a3b8)' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 500 }}>No contacts found</p>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.8 }}>
                {searchTerm ? `No results for "${searchTerm}"` : 'No contacts available'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredContacts.map((c) => {
                const initials = c.name
                  .split(' ')
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '?';

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
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
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
                          {c.source === 'history' && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 600,
                              }}
                            >
                              Customer
                            </span>
                          )}
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
