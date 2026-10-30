import React, { useState } from 'react';
import { X, CheckCircle2, Calendar, FileText, AlertCircle } from 'lucide-react';
import type { CustomerKhata } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate, getTodayDateString } from '../utils/date';

interface SettleAllModalProps {
  isOpen: boolean;
  khata: CustomerKhata | null;
  onClose: () => void;
  onConfirmSettle: (
    personName: string,
    personId?: string,
    settlementDate?: string,
    notes?: string
  ) => Promise<void>;
}

export const SettleAllModal: React.FC<SettleAllModalProps> = ({
  isOpen,
  khata,
  onClose,
  onConfirmSettle,
}) => {
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [settlementNote, setSettlementNote] = useState('Full settlement of all dues');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !khata) return null;

  // Filter only active loans that have remaining balance
  const activeLoans = khata.records.filter((r) => {
    if (r.status === 'repaid') return false;
    const remaining = Math.max(0, (r.amountPaise || 0) - (r.paidPaise || 0));
    return remaining > 0;
  });

  const totalOutstanding = khata.remainingPaise;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || totalOutstanding <= 0) return;

    try {
      setIsSubmitting(true);
      await onConfirmSettle(
        khata.personName,
        khata.personId,
        settlementDate,
        settlementNote.trim() || 'Full settlement of all dues'
      );
      onClose();
    } catch (err) {
      console.error('Failed to settle all dues', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-full)',
                background: 'var(--status-paid-bg)',
                border: '1px solid var(--status-paid-border)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>
                Settle All Dues
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Settle all outstanding credit for {khata.personName}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '4px 0 0 0' }}>
          {/* Outstanding Balance Banner */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: '0.80rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Total Outstanding to Settle
            </div>
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                color: 'var(--primary)',
                margin: '4px 0',
              }}
            >
              {formatINR(totalOutstanding)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {activeLoans.length} active loan{activeLoans.length > 1 ? 's' : ''} will be marked fully settled
            </div>
          </div>

          {/* Breakdown of Active Loans Being Settled */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: '0.80rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}
            >
              Review Loans Being Settled:
            </div>
            <div
              style={{
                maxHeight: 140,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                background: 'var(--bg-surface)',
                fontSize: '0.78rem',
              }}
            >
              {activeLoans.map((loan, idx) => {
                const rem = Math.max(0, loan.amountPaise - (loan.paidPaise || 0));
                return (
                  <div
                    key={loan.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom:
                        idx === activeLoans.length - 1 ? 'none' : '1px dashed var(--border)',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        Loan #{idx + 1}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                        ({formatDisplayDate(loan.dateGiven)})
                      </span>
                      {loan.paidPaise > 0 && (
                        <span style={{ color: 'var(--primary)', marginLeft: 6, fontSize: '0.70rem' }}>
                          [{formatINR(loan.paidPaise)} already paid]
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--status-overdue-text)' }}>
                      {formatINR(rem)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settlement Date */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color="var(--primary)" />
              <span>Settlement Date *</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              required
            />
          </div>

          {/* Settlement Note */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} color="var(--primary)" />
              <span>Settlement Note / Reference (Optional)</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={settlementNote}
              onChange={(e) => setSettlementNote(e.target.value)}
              placeholder="e.g. Cash received in full, Google Pay..."
            />
          </div>

          {/* Confirmation Warning */}
          <div
            style={{
              background: 'var(--status-pending-bg)',
              border: '1px solid var(--status-pending-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px',
              fontSize: '0.76rem',
              color: 'var(--status-pending-text)',
              display: 'flex',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={16} color="var(--status-pending-text)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              Mark <strong>{khata.personName}</strong>’s total outstanding balance of{' '}
              <strong>{formatINR(totalOutstanding)}</strong> as fully settled? Individual payment
              entries will be allocated across each active loan.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
              disabled={isSubmitting || totalOutstanding <= 0}
            >
              {isSubmitting ? 'Settling...' : 'Confirm & Settle All Dues'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettleAllModal;
