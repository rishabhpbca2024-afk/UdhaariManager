import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { validateIndianMobile } from '../utils/validation';

export interface PickedContact {
  name: string;
  phoneNumber: string;
}

export async function pickContact(): Promise<PickedContact | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await Contacts.checkPermissions();
        if (permStatus.contacts !== 'granted') {
          const req = await Contacts.requestPermissions();
          if (req.contacts !== 'granted') {
            return null;
          }
        }
      } catch (e) {
        // Some Android versions do not need explicit permission for picker intent
        console.warn('Permission check skipped or error:', e);
      }

      const res = await Contacts.pickContact({
        projection: {
          name: true,
          phones: true,
        },
      });

      if (!res || !res.contact) return null;

      const contact = res.contact;
      const rawName = contact.name?.display || contact.name?.given || '';
      const rawPhone = contact.phones?.[0]?.number || '';

      const validation = validateIndianMobile(rawPhone);
      const cleanPhone = validation.cleaned ? validation.cleaned : rawPhone.replace(/[\s\-()]/g, '');

      return {
        name: rawName.trim(),
        phoneNumber: cleanPhone,
      };
    }

    // Web fallback using browser Contacts API if supported
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      const nav = navigator as any;
      const contacts = await nav.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        const rawName = Array.isArray(c.name) ? c.name[0] : (c.name || '');
        const rawPhone = Array.isArray(c.tel) ? c.tel[0] : (c.tel || '');
        const validation = validateIndianMobile(rawPhone);
        const cleanPhone = validation.cleaned ? validation.cleaned : String(rawPhone).replace(/[\s\-()]/g, '');
        return {
          name: String(rawName).trim(),
          phoneNumber: cleanPhone,
        };
      }
    }

    return null;
  } catch (err: any) {
    // If user canceled picker, ignore error
    console.warn('Contact picking canceled or failed:', err);
    return null;
  }
}

