import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  UserX,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
} from 'lucide-react';
import type { DashboardMetrics, UdhaariRecord } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { formatDisplayDate, isDueDatePassed } from '../utils/date';
import { getCustomerSummary } from '../utils/customerKhata';

interface DashboardProps {
  metrics: DashboardMetrics;
  records: UdhaariRecord[];
  onAddClick: () => void;
  onFilterSelect: (filter: any) => void;
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

  // Exact count of unique parties who currently have active balance
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

  const netBalance = metrics.netBalancePaise ?? (metrics.totalGivenOutstandingPaise - metrics.totalTakenOutstandingPaise);

  return (
    <div className="dashboard-container">
      {/* 3D Net Position Hero Card */}
      <div className="card-3d balance-hero-card">
        <div className="balance-hero-header">
          <div className="balance-hero-title-wrap">
            <div className="icon-3d-bubble balance-bubble">
              <Scale size={20} />
            </div>
            <div>
              <span className="balance-hero-subtitle">Net Financial Standing</span>
              <div className="balance-hero-status-pill">
                {netBalance > 0 ? (
                  <span className="net-pill positive">
                    <ArrowUpRight size={13} /> You are to receive {formatINR(netBalance)} (Net Receivable)
                  </span>
                ) : netBalance < 0 ? (
                  <span className="net-pill negative">
                    <ArrowDownLeft size={13} /> You have to pay {formatINR(Math.abs(netBalance))} (Net Payable)
                  </span>
                ) : (
                  <span className="net-pill neutral">
                    <ShieldCheck size={13} /> All Settled (No Net Dues)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="balance-hero-amount-row">
          <div className={`balance-hero-value ${netBalance > 0 ? 'net-positive' : netBalance < 0 ? 'net-negative' : 'net-zero'}`}>
            {formatINR(Math.abs(netBalance))}
          </div>
          <div className={`balance-hero-badge-tag ${netBalance > 0 ? 'badge-given' : netBalance < 0 ? 'badge-taken' : 'badge-neutral'}`}>
            {netBalance > 0 ? '🟢 Net Receivable' : netBalance < 0 ? '🔴 Net Payable' : '⚪ Balanced'}
          </div>
        </div>

        {/* 3D Dual Receivable (Given) & Payable (Borrowed) Cards */}
        <div className="balance-dual-grid">
          {/* Given Card (Receivable) */}
          <div
            className="card-3d dual-card given-card"
            onClick={() => onFilterSelect('given')}
            role="button"
            tabIndex={0}
            title="Click to view all given credits (Receivable)"
          >
            <div className="dual-card-header">
              <div className="dual-icon-badge given-badge">
                <ArrowUpRight size={16} />
              </div>
              <span className="dual-title">Total Receivable (Given)</span>
            </div>
            <div className="dual-amount given-amount">
              {formatINR(metrics.totalGivenOutstandingPaise || 0)}
            </div>
            <div className="dual-footer">
              <span>{metrics.givenCount || 0} Loans Given</span>
              <span className="dual-action-arrow">View →</span>
            </div>
          </div>

          {/* Taken Card (Payable) */}
          <div
            className="card-3d dual-card taken-card"
            onClick={() => onFilterSelect('taken')}
            role="button"
            tabIndex={0}
            title="Click to view all borrowed credits (Payable)"
          >
            <div className="dual-card-header">
              <div className="dual-icon-badge taken-badge">
                <ArrowDownLeft size={16} />
              </div>
              <span className="dual-title">Total Payable (Borrowed)</span>
            </div>
            <div className="dual-amount taken-amount">
              {formatINR(metrics.totalTakenOutstandingPaise || 0)}
            </div>
            <div className="dual-footer">
              <span>{metrics.takenCount || 0} Loans Borrowed</span>
              <span className="dual-action-arrow">View →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Metric Grid: Active Accounts, Overdue, Settled */}
      <div className="metric-grid" style={{ marginTop: 12 }}>
        {/* Sub Card 1: Active Debtors Count */}
        <div
          className="metric-card-sub card-3d"
          onClick={() => onFilterSelect('pending')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-sub-header">
            <span className="metric-sub-title">Active Accounts</span>
            <div className="metric-sub-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)' }}>
              <Users size={16} />
            </div>
          </div>
          <div className="metric-sub-value" style={{ color: 'var(--primary)', fontSize: '1.35rem', fontWeight: 700 }}>
            {debtorCustomerCount}
          </div>
          <div className="metric-sub-count">
            Parties with active balance
          </div>
        </div>

        {/* Sub Card 2: Overdue Amount */}
        <div
          className="metric-card-sub card-3d"
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
          className="metric-card-sub card-3d"
          onClick={() => onFilterSelect('repaid')}
          style={{ cursor: 'pointer', gridColumn: 'span 2' }}
        >
          <div className="metric-sub-header">
            <span className="metric-sub-title">Total Settled / Collected</span>
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

      {/* Prominent 3D Quick Action Button */}
      <div className="quick-action-cta card-3d" onClick={onAddClick}>
        <div className="cta-left">
          <div className="cta-icon-circle">
            <PlusCircle size={22} />
          </div>
          <div>
            <div className="cta-text-title">Record New Credit / Debit</div>
            <div className="cta-text-subtitle">Record money lent (Given) or borrowed (Taken)</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {overdueRecords.slice(0, 3).map((record) => {
              const isTaken = record.type === 'taken';
              return (
                <div
                  key={record.id}
                  onClick={() => onEditRecord(record)}
                  className="card-3d"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${isTaken ? 'var(--status-overdue)' : 'var(--status-pending)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {record.personName}
                      </span>
                      <span className={`record-type-badge ${isTaken ? 'type-taken' : 'type-given'}`}>
                        {isTaken ? '🔴 Borrowed' : '🟢 Lent'}
                      </span>
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
              );
            })}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {records.slice(0, 5).map((record) => {
              const isTaken = record.type === 'taken';
              const remaining = Math.max(0, (record.amountPaise || 0) - (record.paidPaise || 0));
              const summary = getCustomerSummary(records, record.personName);
              const hasMultiple = summary && summary.recordsCount > 1;

              return (
                <div
                  key={record.id}
                  onClick={() => onEditRecord(record)}
                  className="card-3d"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${isTaken ? '#F87171' : 'var(--primary)'}`,
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
                      <span className={`record-type-badge ${isTaken ? 'type-taken' : 'type-given'}`}>
                        {isTaken ? '🔴 Borrowed' : '🟢 Lent'}
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
                      {isTaken ? 'Taken: ' : 'Given: '}{formatDisplayDate(record.dateGiven)}
                      {record.status === 'partial' && ` • Balance: ${formatINR(remaining)}`}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: record.status === 'repaid' ? 'var(--primary)' : isTaken ? '#F87171' : 'var(--text-main)' }}>
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
