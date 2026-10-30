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
  const isSettled = khata.remainingPaise === 0;
  const hasOverdue = khata.overdueCount > 0;
  const cleanPhone = khata.phoneNumber ? khata.phoneNumber.replace(/[^0-9+]/g, '') : '';

  // Get initial for avatar
  const initial = khata.personName.charAt(0).toUpperCase();

  const handleWhatsAppReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanPhone) return;

    const remainingStr = formatINR(khata.remainingPaise);
    const message = encodeURIComponent(
      `Hello ${khata.personName},\n\nThis is a friendly reminder that you have an outstanding credit balance of ${remainingStr} across ${khata.recordsCount} loan(s) in our ledger.\n\nPlease settle at your convenience. Thank you!\n- Udhaari Manager Ledger`
    );
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${message}`, '_blank');
  };

  return (
    <div
      className={`customer-khata-card ${isSettled ? 'settled' : hasOverdue ? 'overdue' : 'active'}`}
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
            style={{ color: isSettled ? 'var(--primary)' : hasOverdue ? 'var(--status-overdue-text)' : 'var(--text-main)' }}
          >
            {formatINR(khata.remainingPaise)}
          </div>
          <div className="customer-remaining-label">
            {isSettled ? (
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>All Settled (₹0)</span>
            ) : (
              <span>Outstanding Balance</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle row: Badges & Summary */}
      <div className="customer-stats-row">
        {/* Total Entries Count */}
        <span className="customer-stat-pill entries">
          <Layers size={12} />
          <span>{khata.recordsCount} {khata.recordsCount === 1 ? 'Loan' : 'Loans'}</span>
        </span>

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
