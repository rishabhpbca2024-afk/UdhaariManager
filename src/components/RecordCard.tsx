import React from 'react';
import {
  Calendar,
  Clock,
  Phone,
  Edit2,
  Trash2,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  MessageCircle,
  Split,
} from 'lucide-react';
import type { UdhaariRecord } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate, getDaysOverdue, getDaysRemaining, isDueDatePassed } from '../utils/date';

interface RecordCardProps {
  record: UdhaariRecord;
  customerGrandTotal?: { remainingPaise: number; count: number } | null;
  onEdit: (record: UdhaariRecord) => void;
  onDelete: (record: UdhaariRecord) => void;
  onToggleRepaid: (record: UdhaariRecord) => void;
  onOpenPartialPayment: (record: UdhaariRecord) => void;
  onOpenLedger?: (personName: string) => void;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  customerGrandTotal,
  onEdit,
  onDelete,
  onToggleRepaid,
  onOpenPartialPayment,
  onOpenLedger,
}) => {
  const isRepaid = record.status === 'repaid';
  const isPartial = record.status === 'partial' || (!isRepaid && (record.paidPaise || 0) > 0);
  const isOverdue = !isRepaid && record.dueDate ? isDueDatePassed(record.dueDate) : false;
  const daysOverdue = isOverdue ? getDaysOverdue(record.dueDate) : 0;
  const daysRemaining = !isRepaid && record.dueDate && !isOverdue ? getDaysRemaining(record.dueDate) : 0;

  const totalPaise = record.amountPaise;
  const paidPaise = record.paidPaise || 0;
  const remainingPaise = Math.max(0, totalPaise - paidPaise);
  const percentPaid = totalPaise > 0 ? Math.min(100, Math.round((paidPaise / totalPaise) * 100)) : 0;

  // Border style
  const borderClass = isRepaid
    ? 'repaid-border'
    : isOverdue
    ? 'overdue-border'
    : isPartial
    ? 'partial-border'
    : 'pending-border';

  const cleanPhone = record.phoneNumber ? record.phoneNumber.replace(/[^0-9+]/g, '') : '';

  return (
    <div className={`record-card ${borderClass}`}>
      {/* Top Header: Customer Name and Amount */}
      <div className="record-card-header">
        <div className="record-customer-info">
          <div className="record-name-wrap">
            <h3
              className="record-person-name"
              onClick={() => onOpenLedger?.(record.personName)}
              style={{ cursor: onOpenLedger ? 'pointer' : 'default' }}
              title={onOpenLedger ? 'Click to view full ledger statement' : undefined}
            >
              {record.personName}
            </h3>
            {customerGrandTotal && customerGrandTotal.count > 1 && (
              <span
                className="record-grand-total-tag"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLedger?.(record.personName);
                }}
                title="Click to view full ledger statement"
              >
                Total: {formatINR(customerGrandTotal.remainingPaise)} ({customerGrandTotal.count})
              </span>
            )}
          </div>

          {record.phoneNumber && (
            <div className="record-phone-inline">
              <a href={`tel:${cleanPhone}`} className="record-phone-link">
                <Phone size={11} color="var(--primary)" />
                <span>{record.phoneNumber}</span>
              </a>
              <a
                href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
                className="record-wa-link"
                title="Message on WhatsApp"
              >
                <MessageCircle size={12} />
              </a>
            </div>
          )}
        </div>

        <div className="record-amount-wrap">
          {isPartial ? (
            <>
              <div
                className="record-amount-val"
                style={{ color: isOverdue ? 'var(--status-overdue-text)' : 'var(--status-pending-text)' }}
              >
                {formatINR(remainingPaise)}
              </div>
              <div className="record-amount-sub">
                of {formatINR(totalPaise)}
              </div>
            </>
          ) : (
            <div
              className="record-amount-val"
              style={{ color: isRepaid ? 'var(--primary)' : isOverdue ? 'var(--status-overdue-text)' : 'var(--text-main)' }}
            >
              {formatINR(totalPaise)}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Status pill + Dates + Notes inline */}
      <div className="record-meta-row">
        <span className={`status-badge ${isRepaid ? 'repaid' : isOverdue ? 'overdue' : isPartial ? 'partial' : 'pending'}`}>
          {isRepaid ? <CheckCircle size={10} /> : isOverdue ? <AlertTriangle size={10} /> : isPartial ? <Split size={10} /> : <Clock size={10} />}
          {isRepaid ? 'Settled' : isOverdue ? `Overdue (${daysOverdue}d)` : isPartial ? `${percentPaid}% Paid` : 'Pending'}
        </span>

        <span className="record-date-chip">
          <Calendar size={11} />
          <span>{formatDisplayDate(record.dateGiven)}</span>
        </span>

        {record.dueDate && (
          <span className="record-date-chip" style={{ color: isOverdue ? 'var(--status-overdue-text)' : 'inherit' }}>
            <Clock size={11} />
            <span>Due: {formatDisplayDate(record.dueDate)}{!isRepaid && !isOverdue && daysRemaining >= 0 && ` (${daysRemaining}d)`}</span>
          </span>
        )}

        {record.notes && (
          <span className="record-note-chip" title={record.notes}>
            "{record.notes}"
          </span>
        )}
      </div>

      {/* Partial Payment Progress Bar (if partial) */}
      {isPartial && (
        <div className="record-progress-wrap">
          <div className="record-progress-track">
            <div className="record-progress-fill" style={{ width: `${percentPaid}%` }} />
          </div>
          <div className="record-progress-labels">
            <span>Paid: {formatINR(paidPaise)}</span>
            <span>Balance: {formatINR(remainingPaise)}</span>
          </div>
        </div>
      )}

      {/* Row 3: Single-Row Compact Action Buttons */}
      <div className="record-actions-footer">
        <div className="record-actions-left">
          {!isRepaid && (
            <button
              type="button"
              className="btn-action-pill receive"
              onClick={() => onOpenPartialPayment(record)}
              title="Receive Payment"
            >
              <Split size={13} />
              <span>Receive</span>
            </button>
          )}

          <button
            type="button"
            className={`btn-action-pill ${isRepaid ? 'mark-pending' : 'mark-repaid'}`}
            onClick={() => onToggleRepaid(record)}
          >
            {isRepaid ? (
              <>
                <RotateCcw size={13} />
                <span>Pending</span>
              </>
            ) : (
              <>
                <CheckCircle size={13} />
                <span>Settle</span>
              </>
            )}
          </button>
        </div>

        <div className="record-actions-right">
          <button
            type="button"
            className="btn-action-icon"
            onClick={() => onEdit(record)}
            title="Edit Record"
            aria-label="Edit Record"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn-action-icon delete"
            onClick={() => onDelete(record)}
            title="Delete Record"
            aria-label="Delete Record"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordCard;
