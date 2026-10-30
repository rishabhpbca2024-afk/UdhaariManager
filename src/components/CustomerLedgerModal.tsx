import React, { useState, useMemo } from 'react';
import {
  X,
  MessageCircle,
  PlusCircle,
  Share2,
  FileText,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import type { CustomerKhata, UdhaariRecord } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate } from '../utils/date';
import { RecordCard } from './RecordCard';
import { downloadPdfReport, downloadDocReport } from '../services/documentExport';

interface CustomerLedgerModalProps {
  isOpen: boolean;
  khata: CustomerKhata | null;
  onClose: () => void;
  onAddUdhaarForCustomer: (personName: string, phoneNumber?: string | null) => void;
  onEditRecord: (record: UdhaariRecord) => void;
  onDeleteRecord: (record: UdhaariRecord) => void;
  onToggleRepaid: (record: UdhaariRecord) => void;
  onOpenPartialPayment: (record: UdhaariRecord) => void;
  onOpenSettleAll?: (khata: CustomerKhata) => void;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  isOpen,
  khata,
  onClose,
  onAddUdhaarForCustomer,
  onEditRecord,
  onDeleteRecord,
  onToggleRepaid,
  onOpenPartialPayment,
  onOpenSettleAll,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'repaid'>('all');

  const filteredRecords = useMemo(() => {
    if (!khata) return [];
    if (filter === 'pending') {
      return khata.records.filter((r) => r.status !== 'repaid');
    }
    if (filter === 'repaid') {
      return khata.records.filter((r) => r.status === 'repaid');
    }
    return khata.records;
  }, [khata, filter]);

  if (!isOpen || !khata) return null;

  const isSettled = khata.remainingPaise === 0;
  const cleanPhone = khata.phoneNumber ? khata.phoneNumber.replace(/[^0-9+]/g, '') : '';

  const handleWhatsAppStatement = () => {
    if (!cleanPhone) return;
    const remainingStr = formatINR(khata.remainingPaise);
    const borrowedStr = formatINR(khata.totalUdhaarPaise);
    const paidStr = formatINR(khata.totalPaidPaise);

    const text = encodeURIComponent(
      `*Credit Ledger Statement - ${khata.personName}*\n\n` +
      `• Total Loans: ${khata.recordsCount}\n` +
      `• Total Credit: ${borrowedStr}\n` +
      `• Total Repaid: ${paidStr}\n` +
      `• *Outstanding Balance: ${remainingStr}*\n\n` +
      `Please settle the outstanding balance at your convenience.\nThank you!`
    );
    window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${text}`, '_blank');
  };

  const handleExportCustomerPdf = async () => {
    await downloadPdfReport(khata.records);
  };

  const handleExportCustomerDoc = async () => {
    await downloadDocReport(khata.records);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet customer-ledger-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Top Header */}
        <div className="modal-header" style={{ paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="customer-avatar" style={{ width: 40, height: 40, fontSize: '1.1rem' }}>
              {khata.personName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>
                {khata.personName}'s Ledger
              </h2>
              {khata.phoneNumber ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <a href={`tel:${cleanPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {khata.phoneNumber}
                  </a>
                  <button
                    type="button"
                    onClick={handleWhatsAppStatement}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Send WhatsApp Statement"
                  >
                    <MessageCircle size={14} color="#25D366" />
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  No phone number saved
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Ledger"
          >
            <X size={20} />
          </button>
        </div>

        {/* Customer Totals Summary Card */}
        <div className="ledger-summary-banner">
          <div className="ledger-summary-metric">
            <span className="ledger-metric-label">Net Outstanding Balance</span>
            <span
              className="ledger-metric-value"
              style={{ color: isSettled ? 'var(--primary)' : 'var(--status-overdue-text)' }}
            >
              {formatINR(khata.remainingPaise)}
            </span>
          </div>

          <div className="ledger-summary-grid">
            <div className="ledger-sub-stat">
              <span className="sub-stat-lbl">Total Credit</span>
              <span className="sub-stat-val">{formatINR(khata.totalUdhaarPaise)}</span>
            </div>
            <div className="ledger-sub-stat">
              <span className="sub-stat-lbl">Total Paid</span>
              <span className="sub-stat-val" style={{ color: 'var(--primary)' }}>{formatINR(khata.totalPaidPaise)}</span>
            </div>
            <div className="ledger-sub-stat">
              <span className="sub-stat-lbl">Total Loans</span>
              <span className="sub-stat-val">{khata.recordsCount}</span>
            </div>
            <div className="ledger-sub-stat">
              <span className="sub-stat-lbl">Overdue</span>
              <span className="sub-stat-val" style={{ color: khata.overdueCount > 0 ? 'var(--status-overdue-text)' : 'inherit' }}>
                {khata.overdueCount}
              </span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts Bar */}
        <div className="ledger-actions-bar">
          {khata.remainingPaise > 0 ? (
            <button
              type="button"
              className="btn-primary"
              style={{
                padding: '8px 14px',
                fontSize: '0.82rem',
                gap: 6,
                minHeight: 40,
              }}
              onClick={() => onOpenSettleAll?.(khata)}
              title="Mark all outstanding dues as fully settled"
            >
              <CheckCircle2 size={16} />
              <span>Settle All Dues ({formatINR(khata.remainingPaise)})</span>
            </button>
          ) : (
            <div
              style={{
                fontSize: '0.80rem',
                color: 'var(--primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '8px 12px',
                background: 'var(--status-paid-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--status-paid-border)',
              }}
            >
              <CheckCircle2 size={14} />
              <span>All Dues Fully Settled</span>
            </div>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: 6, minHeight: 40 }}
            onClick={() => {
              onAddUdhaarForCustomer(khata.personName, khata.phoneNumber);
            }}
          >
            <PlusCircle size={16} />
            <span>+ Add Credit</span>
          </button>

          {cleanPhone && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.82rem', gap: 6, minHeight: 40 }}
              onClick={handleWhatsAppStatement}
            >
              <MessageCircle size={16} color="#25D366" />
              <span>Share Statement</span>
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: 6, minHeight: 40 }}
            onClick={handleExportCustomerPdf}
            title="Download PDF statement for this customer"
          >
            <FileText size={15} color="var(--status-overdue-text)" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: 6, minHeight: 40 }}
            onClick={handleExportCustomerDoc}
            title="Download Word statement for this customer"
          >
            <Share2 size={15} color="var(--status-partial-text)" />
            <span>Word</span>
          </button>
        </div>

        {/* Filter Pills inside Customer Ledger */}
        <div className="ledger-filter-row">
          <div style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Transactions ({filteredRecords.length}):
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`filter-pill-mini ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({khata.recordsCount})
            </button>
            <button
              type="button"
              className={`filter-pill-mini ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({khata.pendingCount + khata.partialCount})
            </button>
            <button
              type="button"
              className={`filter-pill-mini ${filter === 'repaid' ? 'active' : ''}`}
              onClick={() => setFilter('repaid')}
            >
              Settled ({khata.repaidCount})
            </button>
          </div>
        </div>

        {/* Scrollable List of Customer's Individual Entries */}
        <div
          className="ledger-records-scroll"
          style={{ flex: 1, overflowY: 'auto', paddingRight: 2, marginTop: 8 }}
        >
          {filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
              <Filter size={20} style={{ margin: '0 auto 6px auto', opacity: 0.5 }} />
              <div>No transactions found for this filter.</div>
            </div>
          ) : (
            filteredRecords.map((record, index) => (
              <div key={record.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 4 }}>
                  Loan #{filteredRecords.length - index} • {formatDisplayDate(record.dateGiven)}
                </div>
                <RecordCard
                  record={record}
                  onEdit={onEditRecord}
                  onDelete={onDeleteRecord}
                  onToggleRepaid={onToggleRepaid}
                  onOpenPartialPayment={onOpenPartialPayment}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerModal;
