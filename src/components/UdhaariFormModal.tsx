import React, { useState, useEffect } from 'react';
import { X, User, Phone, CheckCircle2, Split } from 'lucide-react';
import type { UdhaariRecord, UdhaariFormData, FormValidationErrors } from '../types/udhaari';
import { paiseToRupees, formatINR, amountInWords } from '../utils/currency';
import { getTodayDateString } from '../utils/date';
import { validateIndianMobile } from '../utils/validation';

interface UdhaariFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<UdhaariRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editingRecord?: UdhaariRecord | null;
  initialPersonName?: string;
  initialPhoneNumber?: string | null;
}

export const UdhaariFormModal: React.FC<UdhaariFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingRecord,
  initialPersonName,
  initialPhoneNumber,
}) => {
  const isEditing = Boolean(editingRecord);

  const [formData, setFormData] = useState<UdhaariFormData>({
    personName: '',
    amountRupees: '',
    paidRupees: '0',
    dateGiven: getTodayDateString(),
    dueDate: '',
    phoneNumber: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        personName: String(editingRecord.personName || ''),
        amountRupees: String(paiseToRupees(editingRecord.amountPaise || 0)),
        paidRupees: editingRecord.paidPaise ? String(paiseToRupees(editingRecord.paidPaise)) : '0',
        dateGiven: editingRecord.dateGiven || getTodayDateString(),
        dueDate: editingRecord.dueDate || '',
        phoneNumber: editingRecord.phoneNumber || '',
        notes: editingRecord.notes || '',
      });
      setErrors({});
    } else {
      const cleanName = typeof initialPersonName === 'string' ? initialPersonName : '';
      const cleanPhone = typeof initialPhoneNumber === 'string' ? initialPhoneNumber : '';
      setFormData({
        personName: cleanName,
        amountRupees: '',
        paidRupees: '0',
        dateGiven: getTodayDateString(),
        dueDate: '',
        phoneNumber: cleanPhone,
        notes: '',
      });
      setErrors({});
    }
  }, [editingRecord, isOpen, initialPersonName, initialPhoneNumber]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: FormValidationErrors = {};
    const nameStr = String(formData.personName || '').trim();

    // Person Name
    if (!nameStr) {
      errs.personName = 'Please enter the customer name.';
    } else if (nameStr.length < 2) {
      errs.personName = 'Name must be at least 2 characters.';
    }

    // Amount
    const amountStr = String(formData.amountRupees || '').trim().replace(/,/g, '');
    const parsedAmount = parseFloat(amountStr);
    if (!amountStr) {
      errs.amountRupees = 'Please enter a valid credit amount.';
    } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errs.amountRupees = 'Amount must be greater than ₹0.';
    }

    // Paid Amount in Edit mode
    if (isEditing && formData.paidRupees) {
      const parsedPaid = parseFloat(String(formData.paidRupees).trim().replace(/,/g, ''));
      if (isNaN(parsedPaid) || parsedPaid < 0) {
        errs.paidRupees = 'Paid amount is invalid.';
      } else if (parsedPaid > parsedAmount) {
        errs.paidRupees = 'Paid amount cannot exceed total credit amount.';
      }
    }

    // Date Given
    if (!formData.dateGiven) {
      errs.dateGiven = 'Date given is required.';
    }

    // Phone Number (optional)
    if (formData.phoneNumber && String(formData.phoneNumber).trim()) {
      const phoneValidation = validateIndianMobile(String(formData.phoneNumber));
      if (!phoneValidation.isValid) {
        errs.phoneNumber = phoneValidation.error;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const amountPaise = Math.round(parseFloat(String(formData.amountRupees).trim().replace(/,/g, '')) * 100);
      const paidPaise = isEditing && formData.paidRupees
        ? Math.round(parseFloat(String(formData.paidRupees).trim().replace(/,/g, '')) * 100)
        : 0;

      const status: UdhaariRecord['status'] =
        paidPaise >= amountPaise ? 'repaid' : paidPaise > 0 ? 'partial' : 'pending';

      const trimmedName = String(formData.personName).trim();
      const trimmedPhone = formData.phoneNumber ? String(formData.phoneNumber).trim() : null;
      const trimmedNotes = formData.notes ? String(formData.notes).trim() : null;

      await onSubmit({
        personName: trimmedName,
        amountPaise,
        paidPaise,
        paymentHistory: editingRecord?.paymentHistory || [],
        dateGiven: formData.dateGiven,
        dueDate: formData.dueDate ? formData.dueDate : null,
        phoneNumber: trimmedPhone || null,
        notes: trimmedNotes || null,
        status,
        repaidDate: status === 'repaid' ? getTodayDateString() : null,
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit form', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedAmountForHelper = parseFloat(String(formData.amountRupees || '').trim().replace(/,/g, ''));
  const amountPreview =
    !isNaN(parsedAmountForHelper) && parsedAmountForHelper > 0
      ? `${formatINR(parsedAmountForHelper * 100)} (${amountInWords(parsedAmountForHelper)})`
      : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Edit Credit Record' : 'Record New Credit'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Person's Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="personName" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Customer Name</span>
              <span className="required-star">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="personName"
                type="text"
                className={`form-input ${errors.personName ? 'has-error' : ''}`}
                placeholder="e.g. Ramesh Kumar, Aman Sharma..."
                value={formData.personName}
                onChange={(e) => {
                  setFormData({ ...formData, personName: e.target.value });
                  if (errors.personName) setErrors({ ...errors, personName: undefined });
                }}
                autoFocus
              />
              <User
                size={16}
                color="var(--text-secondary)"
                style={{ position: 'absolute', right: 14, top: 15, pointerEvents: 'none' }}
              />
            </div>
            {errors.personName && (
              <div className="form-error-msg">{errors.personName}</div>
            )}
          </div>

          {/* Amount in Rupees */}
          <div className="form-group">
            <label className="form-label" htmlFor="amountRupees" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Credit Amount (₹)</span>
              <span className="required-star">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="amountRupees"
                type="number"
                inputMode="decimal"
                className={`form-input ${errors.amountRupees ? 'has-error' : ''}`}
                placeholder="₹ 0"
                value={formData.amountRupees}
                onChange={(e) => {
                  setFormData({ ...formData, amountRupees: e.target.value });
                  if (errors.amountRupees) setErrors({ ...errors, amountRupees: undefined });
                }}
              />
              <span style={{ position: 'absolute', right: 14, top: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                INR
              </span>
            </div>
            {amountPreview && (
              <div style={{ fontSize: '0.74rem', color: 'var(--primary)', marginTop: 4, fontWeight: 500 }}>
                {amountPreview}
              </div>
            )}
            {errors.amountRupees && (
              <div className="form-error-msg">{errors.amountRupees}</div>
            )}
          </div>

          {/* Paid Amount (Only in Edit mode) */}
          {isEditing && (
            <div className="form-group">
              <label className="form-label" htmlFor="paidRupees">
                Amount Paid So Far (₹)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="paidRupees"
                  type="number"
                  inputMode="decimal"
                  className={`form-input ${errors.paidRupees ? 'has-error' : ''}`}
                  value={formData.paidRupees}
                  onChange={(e) => {
                    setFormData({ ...formData, paidRupees: e.target.value });
                    if (errors.paidRupees) setErrors({ ...errors, paidRupees: undefined });
                  }}
                />
                <Split
                  size={16}
                  color="var(--text-secondary)"
                  style={{ position: 'absolute', right: 14, top: 15, pointerEvents: 'none' }}
                />
              </div>
              {errors.paidRupees && (
                <div className="form-error-msg">{errors.paidRupees}</div>
              )}
            </div>
          )}

          {/* Date Row: Date Given and Due Date */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="dateGiven">
                Date Given <span className="required-star">*</span>
              </label>
              <input
                id="dateGiven"
                type="date"
                className="form-input"
                value={formData.dateGiven}
                onChange={(e) => setFormData({ ...formData, dateGiven: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="dueDate">
                Due Date (Optional)
              </label>
              <input
                id="dueDate"
                type="date"
                className="form-input"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="phoneNumber">
              Phone Number (For WhatsApp reminders)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="phoneNumber"
                type="tel"
                inputMode="tel"
                className={`form-input ${errors.phoneNumber ? 'has-error' : ''}`}
                placeholder="10-digit mobile number"
                value={formData.phoneNumber}
                onChange={(e) => {
                  setFormData({ ...formData, phoneNumber: e.target.value });
                  if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: undefined });
                }}
              />
              <Phone
                size={16}
                color="var(--text-secondary)"
                style={{ position: 'absolute', right: 14, top: 15, pointerEvents: 'none' }}
              />
            </div>
            {errors.phoneNumber && (
              <div className="form-error-msg">{errors.phoneNumber}</div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Notes / Description (Optional)
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              placeholder="e.g. Grocery items, invoice #104, rice bag..."
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="form-actions-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Credit' : 'Save Credit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UdhaariFormModal;
