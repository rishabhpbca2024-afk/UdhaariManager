import React from 'react';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  UserX,
  Users,
} from 'lucide-react';
import type { DashboardMetrics, UdhaariRecord } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate, isDueDatePassed } from '../utils/date';
import { getCustomerSummary } from '../utils/customerKhata';

interface DashboardProps {
  metrics: DashboardMetrics;
  records: UdhaariRecord[];
  onAddClick: () => void;
  onFilterSelect: (filter: 'pending' | 'partial' | 'overdue' | 'repaid') => void;
  onEditRecord: (record: UdhaariRecord) => void;
  onToggleRepaid: (record: UdhaariRecord) => void;
  onOpenPartialPayment: (record: UdhaariRecord) => void;
  onOpenLedger?: (personName: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  metrics,
  records,
  onAddClick,
  onFilterSelect,
  onEditRecord,
  onOpenLedger,
}) => {
  const overdueRecords = records.filter(
    (r) => r.status !== 'repaid' && r.dueDate && isDueDatePassed(r.dueDate)
  );

  // Exact count of unique customers who currently owe money (pending balance > 0)
  const debtorCustomerCount = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (!r || r.status === 'repaid') continue;
      const rem = Math.max(0, (r.amountPaise || 0) - (r.paidPaise || 0));
      if (rem > 0 && r.personName) {
        set.add(String(r.personName).trim().toLowerCase());
      }
    }
    return set.size;
  }, [records]);

  return (
    <div className="dashboard-container">
      {/* Main Metric Card */}
      <div className="metric-grid">
        <div className="metric-card-main">
          <div className="main-metric-label">
            <TrendingUp size={18} color="var(--primary)" />
            <span>Total Outstanding</span>
          </div>
          <div className="main-metric-value">
            {formatINR(metrics.totalOutstandingPaise)}
          </div>
          <div className="main-metric-footer">
            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--primary)' }}>
              👥 {debtorCustomerCount} customer{debtorCustomerCount === 1 ? '' : 's'} with balance
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="var(--primary)" /> 100% Offline & Private
            </span>
          </div>
        </div>

        {/* Sub Card 1: Active Debtors Count */}
        <div
          className="metric-card-sub"
          onClick={() => onFilterSelect('pending')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-sub-header">
            <span className="metric-sub-title">
              Active Debtors
            </span>
            <div className="metric-sub-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
              <Users size={16} />
            </div>
          </div>
          <div className="metric-sub-value" style={{ color: 'var(--primary)', fontSize: '1.35rem', fontWeight: 700 }}>
            {debtorCustomerCount}
          </div>
          <div className="metric-sub-count">
            Customers with pending balance
          </div>
        </div>

        {/* Sub Card 2: Overdue Amount */}
        <div
          className="metric-card-sub"
          onClick={() => onFilterSelect('overdue')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-sub-header">
            <span className="metric-sub-title">Overdue Amount</span>
            <div className="metric-sub-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-overdue-text)' }}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="metric-sub-value" style={{ color: metrics.overdueCount > 0 ? 'var(--status-overdue-text)' : 'var(--text-main)' }}>
            {formatINR(metrics.totalOverduePaise)}
          </div>
          <div className="metric-sub-count">
            {metrics.overdueCount} account{metrics.overdueCount === 1 ? '' : 's'} overdue
          </div>
        </div>

        {/* Sub Card 3: Total Repaid */}
        <div
          className="metric-card-sub"
          onClick={() => onFilterSelect('repaid')}
          style={{ cursor: 'pointer', gridColumn: 'span 2' }}
        >
          <div className="metric-sub-header">
            <span className="metric-sub-title">Total Collected</span>
            <div className="metric-sub-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="metric-sub-value" style={{ color: 'var(--primary)' }}>
            {formatINR(metrics.totalRepaidPaise)}
          </div>
          <div className="metric-sub-count">
            {metrics.repaidCount} account{metrics.repaidCount === 1 ? '' : 's'} fully settled
          </div>
        </div>
      </div>

      {/* Prominent Quick Action Button */}
      <div className="quick-action-cta" onClick={onAddClick}>
        <div className="cta-left">
          <div className="cta-icon-circle">
            <PlusCircle size={22} />
          </div>
          <div>
            <div className="cta-text-title">Record New Credit</div>
            <div className="cta-text-subtitle">Enter customer name, amount, and due date</div>
          </div>
        </div>
        <ChevronRight size={18} color="var(--text-secondary)" />
      </div>

      {/* Urgent Overdue Section if any */}
      {overdueRecords.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-header">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-overdue-text)' }}>
              <AlertCircle size={16} />
              <span>Overdue Accounts ({overdueRecords.length})</span>
            </div>
            <button
              type="button"
              className="section-action-btn"
              onClick={() => onFilterSelect('overdue')}
            >
              View All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overdueRecords.slice(0, 3).map((record) => (
              <div
                key={record.id}
                onClick={() => onEditRecord(record)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid var(--status-overdue)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                    {record.personName}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--status-overdue-text)', marginTop: 2 }}>
                    Due: {record.dueDate ? formatDisplayDate(record.dueDate) : 'Overdue'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--status-overdue-text)', fontSize: '1rem' }}>
                    {formatINR(record.amountPaise - (record.paidPaise || 0))}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--status-overdue-text)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Records List */}
      <div style={{ marginBottom: 16 }}>
        <div className="section-header">
          <div className="section-title">Recent Transactions</div>
          <button
            type="button"
            className="section-action-btn"
            onClick={() => onFilterSelect('pending')}
          >
            View All
          </button>
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <UserX size={28} />
            </div>
            <div className="empty-state-title">No credit records yet</div>
            <p className="empty-state-desc">
              Keep track of customer credits and repayments. All data is kept securely on your device.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'inline-flex', margin: '0 auto' }}
              onClick={onAddClick}
            >
              <PlusCircle size={16} />
              <span>Record First Credit</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {records.slice(0, 5).map((record) => {
              const remaining = Math.max(0, (record.amountPaise || 0) - (record.paidPaise || 0));
              const summary = getCustomerSummary(records, record.personName);
              const hasMultiple = summary && summary.recordsCount > 1;

              return (
                <div
                  key={record.id}
                  onClick={() => onEditRecord(record)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-main)' }}>
                        {record.personName}
                      </span>
                      {hasMultiple && (
                        <span
                          onClick={(e) => {
                            if (onOpenLedger) {
                              e.stopPropagation();
                              onOpenLedger(record.personName);
                            }
                          }}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: 'var(--status-pending-text)',
                            background: 'var(--status-pending-bg)',
                            border: '1px solid var(--status-pending-border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '1px 6px',
                            cursor: onOpenLedger ? 'pointer' : 'default',
                          }}
                          title={onOpenLedger ? 'Click to open Ledger statement' : undefined}
                        >
                          Total: {formatINR(summary.totalRemainingPaise)} ({summary.recordsCount} loans)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Given: {formatDisplayDate(record.dateGiven)}
                      {record.status === 'partial' && ` • Balance: ${formatINR(remaining)}`}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: record.status === 'repaid' ? 'var(--primary)' : 'var(--text-main)' }}>
                      {formatINR(record.amountPaise)}
                    </div>
                    <span
                      className={`status-badge ${
                        record.status === 'repaid'
                          ? 'repaid'
                          : record.dueDate && isDueDatePassed(record.dueDate)
                          ? 'overdue'
                          : record.status === 'partial'
                          ? 'partial'
                          : 'pending'
                      }`}
                      style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                    >
                      {record.status === 'repaid'
                        ? 'Settled'
                        : record.dueDate && isDueDatePassed(record.dueDate)
                        ? 'Overdue'
                        : record.status === 'partial'
                        ? 'Partial'
                        : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
