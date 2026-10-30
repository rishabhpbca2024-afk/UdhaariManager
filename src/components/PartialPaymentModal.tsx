import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import type { UdhaariRecord } from '../types/udhaari';
import { formatINR, rupeesToPaise, paiseToRupees } from '../utils/currency';
import { getTodayDateString } from '../utils/date';

interface PartialPaymentModalProps {
  isOpen: boolean;
  record: UdhaariRecord | null;
  onClose: () => void;
  onSubmit: (paymentAmountPaise: number, newDueDate?: string | null, notes?: string | null) => Promise<void>;
}

export const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({
  isOpen,
  record,
  onClose,
  onSubmit,
}) => {
  const [paymentRupees, setPaymentRupees] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !record) return null;

  const totalPaise = record.amountPaise;
  const alreadyPaidPaise = record.paidPaise || 0;
  const remainingPaise = Math.max(0, totalPaise - alreadyPaidPaise);

  const handleQuickPercent = (percent: number) => {
    const calculatedRupees = Math.round((paiseToRupees(remainingPaise) * percent) / 100);
    setPaymentRupees(String(calculatedRupees));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(paymentRupees.trim().replace(/,/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid payment amount (greater than ₹0).');
      return;
    }

    const paymentPaise = rupeesToPaise(paymentRupees);
    if (paymentPaise > remainingPaise) {
      setError(`Payment amount cannot exceed remaining balance (${formatINR(remainingPaise)}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(paymentPaise, newDueDate ? newDueDate : null, notes.trim() ? notes.trim() : null);
      setPaymentRupees('');
      setNewDueDate('');
      setNotes('');
      setError(null);
      onClose();
    } catch (err) {
      console.error('Failed to submit partial payment', err);
      setError('Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Receive Payment</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Customer: {record.personName}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance Overview Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            marginBottom: 16,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Total Credit:</span>
            <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-main)' }}>{formatINR(totalPaise)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.80rem', color: 'var(--primary)' }}>Already Paid:</span>
            <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--primary)' }}>
              {formatINR(alreadyPaidPaise)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Remaining Balance:
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--status-pending-text)' }}>
              {formatINR(remainingPaise)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Payment Amount Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="partialAmount">
              Payment Amount Received (₹) <span className="required-star">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="partialAmount"
                type="number"
                inputMode="decimal"
                className={`form-input ${error ? 'has-error' : ''}`}
                placeholder="e.g. 500"
                value={paymentRupees}
                onChange={(e) => {
                  setPaymentRupees(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
              <span
                style={{
                  position: 'absolute',
                  right: 14,
                  top: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  pointerEvents: 'none',
                }}
              >
                ₹
              </span>
            </div>

            {/* Quick Percentage Chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                className="filter-pill"
                onClick={() => handleQuickPercent(25)}
              >
                25%
              </button>
              <button
                type="button"
                className="filter-pill"
                onClick={() => handleQuickPercent(50)}
                style={{ fontWeight: 600, borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                50% (Half)
              </button>
              <button
                type="button"
                className="filter-pill"
                onClick={() => handleQuickPercent(75)}
              >
                75%
              </button>
              <button
                type="button"
                className="filter-pill"
                onClick={() => handleQuickPercent(100)}
              >
                100% (Full)
              </button>
            </div>

            {error && <div className="form-error-msg">{error}</div>}
          </div>

          {/* Extend Due Date for Remaining Balance */}
          <div className="form-group">
            <label className="form-label" htmlFor="newDueDate">
              New Due Date for Remaining Balance (Optional)
            </label>
            <input
              id="newDueDate"
              type="date"
              min={getTodayDateString()}
              className="form-input"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {record.dueDate
                ? `Current Due Date: ${record.dueDate}. Select a future date if extended time is requested.`
                : 'Select a date if the customer committed to a specific repayment deadline.'}
            </p>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="paymentNotes">
              Payment Note / Reference (Optional)
            </label>
            <input
              id="paymentNotes"
              type="text"
              className="form-input"
              placeholder="e.g. Cash payment, Google Pay, remaining balance next week..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Buttons */}
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
              <span>{isSubmitting ? 'Saving...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartialPaymentModal;
