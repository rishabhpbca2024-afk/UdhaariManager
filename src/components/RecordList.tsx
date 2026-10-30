import React, { useState, useMemo } from 'react';
import { Search, X, ArrowUpDown, UserPlus, Filter, User } from 'lucide-react';
import type { UdhaariRecord, StatusFilter, SortField } from '../types/udhaari';
import { RecordCard } from './RecordCard';
import { isDueDatePassed } from '../utils/date';
import { getCustomerSummary } from '../utils/customerKhata';
import { formatINR } from '../utils/currency';

interface RecordListProps {
  records: UdhaariRecord[];
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  onAddClick: (prefillName?: string, prefillPhone?: string | null) => void;
  onEditRecord: (record: UdhaariRecord) => void;
  onDeleteRecord: (record: UdhaariRecord) => void;
  onToggleRepaid: (record: UdhaariRecord) => void;
  onOpenPartialPayment: (record: UdhaariRecord) => void;
  onOpenLedger?: (personName: string) => void;
  onOpenSettleAll?: (personName: string) => void;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  activeFilter,
  onFilterChange,
  onAddClick,
  onEditRecord,
  onDeleteRecord,
  onToggleRepaid,
  onOpenPartialPayment,
  onOpenLedger,
  onOpenSettleAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('newest');

  // Search customer grand total summary (if user searches e.g. "Aman")
  const searchCustomerSummary = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) return null;
    return getCustomerSummary(records, q);
  }, [records, searchQuery]);

  // Compute counts for filter badges
  const counts = useMemo(() => {
    let pending = 0;
    let partial = 0;
    let overdue = 0;
    let repaid = 0;

    for (const r of records) {
      if (!r) continue;
      if (r.status === 'repaid') {
        repaid++;
      } else {
        if (r.status === 'partial') {
          partial++;
        } else {
          pending++;
        }

        if (r.dueDate && isDueDatePassed(r.dueDate)) {
          overdue++;
        }
      }
    }

    return { all: records.length, pending, partial, overdue, repaid };
  }, [records]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (!record) return false;
        // Search by person name, notes, or phone
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          const name = String(record.personName || '').toLowerCase();
          const notes = String(record.notes || '').toLowerCase();
          const phone = String(record.phoneNumber || '');
          if (!name.includes(q) && !notes.includes(q) && !phone.includes(q)) {
            return false;
          }
        }

        // Status Filter
        if (activeFilter === 'pending') {
          return record.status === 'pending';
        }
        if (activeFilter === 'partial') {
          return record.status === 'partial';
        }
        if (activeFilter === 'overdue') {
          return record.status !== 'repaid' && record.dueDate && isDueDatePassed(record.dueDate);
        }
        if (activeFilter === 'repaid') {
          return record.status === 'repaid';
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'newest') {
          return (b.dateGiven || '').localeCompare(a.dateGiven || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        if (sortField === 'oldest') {
          return (a.dateGiven || '').localeCompare(b.dateGiven || '') || (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        if (sortField === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (sortField === 'amountDesc') {
          const remA = (a.amountPaise || 0) - (a.paidPaise || 0);
          const remB = (b.amountPaise || 0) - (b.paidPaise || 0);
          return remB - remA;
        }
        if (sortField === 'amountAsc') {
          const remA = (a.amountPaise || 0) - (a.paidPaise || 0);
          const remB = (b.amountPaise || 0) - (b.paidPaise || 0);
          return remA - remB;
        }
        return 0;
      });
  }, [records, searchQuery, activeFilter, sortField]);

  return (
    <div className="record-list-container">
      {/* Search Bar */}
      <div className="search-filter-box">
        <div className="search-input-wrapper">
          <Search size={18} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer name, phone, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* If user searched a person, show their grand total across all entries */}
        {searchCustomerSummary && searchCustomerSummary.recordsCount > 0 && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginTop: 4,
              fontSize: '0.84rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} color="var(--primary)" />
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Total balance for "{searchQuery.trim()}":
                </span>
              </div>
              <div style={{ fontWeight: 700, color: searchCustomerSummary.totalRemainingPaise > 0 ? 'var(--status-overdue-text)' : 'var(--primary)' }}>
                {formatINR(searchCustomerSummary.totalRemainingPaise)} Pending ({searchCustomerSummary.recordsCount} loan{searchCustomerSummary.recordsCount > 1 ? 's' : ''})
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 36 }}
                onClick={() => onOpenLedger?.(searchQuery.trim())}
              >
                View Ledger
              </button>

              {searchCustomerSummary.totalRemainingPaise > 0 && onOpenSettleAll && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    minHeight: 36,
                  }}
                  onClick={() => onOpenSettleAll(searchQuery.trim())}
                >
                  Settle All ({formatINR(searchCustomerSummary.totalRemainingPaise)})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status Filter Pills */}
        <div className="filter-pills-row" style={{ marginTop: 4 }}>
          <button
            type="button"
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All <span className="filter-pill-badge">{counts.all}</span>
          </button>

          <button
            type="button"
            className={`filter-pill ${activeFilter === 'pending' ? 'active' : ''}`}
            onClick={() => onFilterChange('pending')}
          >
            Pending <span className="filter-pill-badge">{counts.pending}</span>
          </button>

          <button
            type="button"
            className={`filter-pill ${activeFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => onFilterChange('overdue')}
          >
            Overdue <span className="filter-pill-badge">{counts.overdue}</span>
          </button>

          <button
            type="button"
            className={`filter-pill ${activeFilter === 'repaid' ? 'active' : ''}`}
            onClick={() => onFilterChange('repaid')}
          >
            Settled <span className="filter-pill-badge">{counts.repaid}</span>
          </button>
        </div>

        {/* Sort Row */}
        <div className="sort-select-wrapper">
          <ArrowUpDown size={14} />
          <span>Sort by:</span>
          <select
            className="sort-select"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="newest">Newest first</option>
            <option value="dueDate">Due Date first</option>
            <option value="oldest">Oldest first</option>
            <option value="amountDesc">Highest Amount (₹)</option>
            <option value="amountAsc">Lowest Amount (₹)</option>
          </select>
        </div>
      </div>

      {/* List of Records */}
      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Filter size={24} />
          </div>
          <div className="empty-state-title">No records found</div>
          <p className="empty-state-desc">
            {searchQuery
              ? `No records matching "${searchQuery}".`
              : `No records found in the ${activeFilter} filter.`}
          </p>
          {searchQuery ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ display: 'inline-flex', margin: '0 auto' }}
              onClick={() => setSearchQuery('')}
            >
              Clear Search
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'inline-flex', margin: '0 auto' }}
              onClick={() => onAddClick()}
            >
              <UserPlus size={16} />
              <span>+ Add Credit</span>
            </button>
          )}
        </div>
      ) : (
        <div className="records-list">
          {filteredRecords.map((record) => {
            const summary = getCustomerSummary(records, record.personName);
            return (
              <RecordCard
                key={record.id}
                record={record}
                customerGrandTotal={
                  summary && summary.recordsCount > 1
                    ? { remainingPaise: summary.totalRemainingPaise, count: summary.recordsCount }
                    : null
                }
                onEdit={onEditRecord}
                onDelete={onDeleteRecord}
                onToggleRepaid={onToggleRepaid}
                onOpenPartialPayment={onOpenPartialPayment}
                onOpenLedger={onOpenLedger}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecordList;
