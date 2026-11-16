import React from 'react';
import {
  Phone,
  MessageCircle,
  BookOpen,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import type { CustomerKhata } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate } from '../utils/date';

interface CustomerKhataCardProps {
  khata: CustomerKhata;
  onViewLedger: (khata: CustomerKhata) => void;
  onAddUdhaarForCustomer: (personName: string, phoneNumber?: string | null) => void;
  onOpenSettleAll?: (khata: CustomerKhata) => void;
}

export const CustomerKhataCard: React.FC<CustomerKhataCardProps> = ({
  khata,
  onViewLedger,
  onAddUdhaarForCustomer,
  onOpenSettleAll,
}) => {
  const net = khata.netRemainingPaise !== undefined ? khata.netRemainingPaise : khata.remainingPaise;
  const isSettled = net === 0 && khata.remainingPaise === 0;
  const hasOverdue = khata.overdueCount > 0;
  const cleanPhone = khata.phoneNumber ? khata.phoneNumber.replace(/[^0-9+]/g, '') : '';

  // Get initial for avatar
  const initial = khata.personName.charAt(0).toUpperCase();

  const handleWhatsAppReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanPhone) return;

    const remainingStr = formatINR(Math.abs(net));
    const isReceivable = net >= 0;
    const message = encodeURIComponent(
      `Hello ${khata.personName},\n\nThis is a friendly update regarding our khata ledger. Current balance is ${remainingStr} (${isReceivable ? 'You have to pay' : 'I have to pay'}) across ${khata.recordsCount} transaction(s).\n\nThank you!\n- Udhaari Manager`
    );
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${message}`, '_blank');
  };

  return (
    <div
      className={`customer-khata-card card-3d ${isSettled ? 'settled' : hasOverdue ? 'overdue' : 'active'}`}
      onClick={() => onViewLedger(khata)}
    >
      {/* Top Header: Avatar, Name, Phone & Total Balance */}
      <div className="customer-card-header">
        <div className="customer-info-left">
          <div className="customer-avatar">
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 className="customer-name">{khata.personName}</h3>
            {khata.phoneNumber ? (
              <div className="customer-phone-row" onClick={(e) => e.stopPropagation()}>
                <a href={`tel:${cleanPhone}`} className="customer-phone-link">
                  <Phone size={12} color="var(--primary)" />
                  <span>{khata.phoneNumber}</span>
                </a>
                <button
                  type="button"
                  className="customer-wa-btn"
                  onClick={handleWhatsAppReminder}
                  title="WhatsApp Reminder"
                  aria-label="WhatsApp Reminder"
                >
                  <MessageCircle size={14} color="#25D366" />
                </button>
              </div>
            ) : (
              <span className="customer-no-phone">No phone number saved</span>
            )}
          </div>
        </div>

        {/* Right side: Grand Total Outstanding */}
        <div className="customer-balance-right">
          <div
            className="customer-remaining-amount"
            style={{ color: isSettled ? 'var(--primary)' : net > 0 ? 'var(--status-pending-text)' : '#F87171' }}
          >
            {formatINR(Math.abs(net))}
          </div>
          <div className="customer-remaining-label">
            {isSettled ? (
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>All Settled (₹0)</span>
            ) : net > 0 ? (
              <span style={{ color: 'var(--status-pending-text)', fontWeight: 600 }}>लेना है (Receivable)</span>
            ) : (
              <span style={{ color: '#F87171', fontWeight: 600 }}>देना है (Payable)</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle row: Badges & Summary */}
      <div className="customer-stats-row">
        {/* Total Entries Count */}
        <span className="customer-stat-pill entries">
          <Layers size={12} />
          <span>{khata.recordsCount} Entries</span>
        </span>

        {/* Given / Taken badges */}
        {khata.givenRecordsCount > 0 && (
          <span className="customer-stat-pill given" style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.12)' }}>
            🟢 {khata.givenRecordsCount} दिया
          </span>
        )}
        {khata.takenRecordsCount > 0 && (
          <span className="customer-stat-pill taken" style={{ color: '#F87171', background: 'rgba(239, 68, 68, 0.12)' }}>
            🔴 {khata.takenRecordsCount} लिया
          </span>
        )}

        {/* Overdue alert badge if any */}
        {hasOverdue && (
          <span className="customer-stat-pill overdue">
            <AlertCircle size={12} />
            <span>{khata.overdueCount} Overdue</span>
          </span>
        )}

        {/* Repaid / Settled Badge */}
        {isSettled ? (
          <span className="customer-stat-pill settled">
            <CheckCircle2 size={12} />
            <span>Settled</span>
          </span>
        ) : khata.totalPaidPaise > 0 ? (
          <span className="customer-stat-pill partial">
            <span>{formatINR(khata.totalPaidPaise)} paid</span>
          </span>
        ) : null}

        {/* Last active date */}
        {khata.lastDate && (
          <span className="customer-stat-pill date">
            <Calendar size={12} />
            <span>Last: {formatDisplayDate(khata.lastDate)}</span>
          </span>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="customer-actions-row" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn-customer-action secondary"
          onClick={() => onViewLedger(khata)}
        >
          <BookOpen size={14} />
          <span>Ledger ({khata.recordsCount})</span>
        </button>

        {khata.remainingPaise > 0 && onOpenSettleAll && (
          <button
            type="button"
            className="btn-customer-action"
            style={{ background: 'var(--status-paid-bg)', color: 'var(--status-paid-text)', border: '1px solid var(--status-paid-border)', fontWeight: 600 }}
            onClick={() => onOpenSettleAll(khata)}
          >
            <CheckCircle2 size={14} />
            <span>Settle All</span>
          </button>
        )}

        <button
          type="button"
          className="btn-customer-action primary"
          onClick={() => onAddUdhaarForCustomer(khata.personName, khata.phoneNumber)}
        >
          <PlusCircle size={14} />
          <span>+ Credit</span>
        </button>
      </div>
    </div>
  );
};

export default CustomerKhataCard;
