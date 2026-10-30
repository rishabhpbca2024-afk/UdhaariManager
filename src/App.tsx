import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import type { UdhaariRecord, StatusFilter, NotificationSettings, CustomerKhata } from './types/udhaari';
import {
  getAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  setRecordRepaidStatus,
  recordPartialPayment,
  settleAllDuesForCustomer,
  calculateMetrics,
} from './services/repository';
import { initializeDatabase } from './services/db';
import { formatINR } from './utils/currency';
import { groupRecordsByCustomer, normalizeCustomerName } from './utils/customerKhata';
import {
  getNotificationSettings,
  saveNotificationSettings,
  syncAllNotifications,
  requestNotificationPermission,
} from './services/notifications';

import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { RecordList } from './components/RecordList';
import { BackupScreen } from './components/BackupScreen';
import { UdhaariFormModal } from './components/UdhaariFormModal';
import { PartialPaymentModal } from './components/PartialPaymentModal';
import { CustomerLedgerModal } from './components/CustomerLedgerModal';
import { SettleAllModal } from './components/SettleAllModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast, type ToastData } from './components/Toast';

type ActiveTab = 'dashboard' | 'records' | 'backup';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [records, setRecords] = useState<UdhaariRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Filter state for records tab
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    getNotificationSettings()
  );

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<UdhaariRecord | null>(null);
  const [addPrefill, setAddPrefill] = useState<{ name?: string; phone?: string | null }>({});
  const [partialTargetRecord, setPartialTargetRecord] = useState<UdhaariRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<UdhaariRecord | null>(null);

  // Customer Ledger & Person-Level Settle All Modals
  const [activeLedgerCustomer, setActiveLedgerCustomer] = useState<CustomerKhata | null>(null);
  const [activeSettleKhata, setActiveSettleKhata] = useState<CustomerKhata | null>(null);

  // Toast state
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  // Load records from DB
  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setDbError(null);
      await initializeDatabase();
      const data = await getAllRecords();
      setRecords(data);

      // Synchronize offline local notifications
      try {
        syncAllNotifications(data, notificationSettings);
      } catch (e) {
        console.warn('Sync notification note', e);
      }
    } catch (err) {
      console.error('Error loading Udhaari records', err);
      setDbError(err instanceof Error ? err.message : 'Failed to connect to local database');
      showToast('Could not connect to local database.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, notificationSettings]);

  useEffect(() => {
    loadRecords();
    requestNotificationPermission();
  }, [loadRecords]);

  // Derived metrics
  const metrics = useMemo(() => calculateMetrics(records), [records]);

  // Form submit handler (Add / Edit)
  const handleFormSubmit = async (
    data: Omit<UdhaariRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      if (editingRecord) {
        await updateRecord(editingRecord.id, data);
        showToast(`Record updated for ${data.personName}!`, 'success');
      } else {
        await createRecord(data);
        showToast(`Added ${formatINR(data.amountPaise)} credit for ${data.personName}!`, 'success');
      }
      setIsFormOpen(false);
      setEditingRecord(null);
      setAddPrefill({});
      await loadRecords();
    } catch (err) {
      console.error('Failed to save record', err);
      showToast('Failed to save record to local database.', 'error');
    }
  };

  // Partial Payment submit handler
  const handlePartialPaymentSubmit = async (
    paymentAmountPaise: number,
    newDueDate?: string | null,
    notes?: string | null
  ) => {
    if (!partialTargetRecord) return;
    try {
      const updated = await recordPartialPayment(
        partialTargetRecord.id,
        paymentAmountPaise,
        newDueDate,
        notes
      );
      const remaining = Math.max(0, updated.amountPaise - (updated.paidPaise || 0));
      showToast(
        remaining === 0
          ? `All dues fully settled for ${updated.personName}!`
          : `Received ${formatINR(paymentAmountPaise)}. Remaining balance: ${formatINR(remaining)}`,
        'success'
      );
      setPartialTargetRecord(null);
      await loadRecords();
    } catch (err) {
      console.error('Failed to record partial payment', err);
      showToast('Failed to record payment.', 'error');
    }
  };

  // Open Edit Form
  const handleOpenEdit = (record: UdhaariRecord) => {
    setEditingRecord(record);
    setAddPrefill({});
    setIsFormOpen(true);
  };

  // Open Add Form (Defensively guards against React MouseEvent)
  const handleOpenAdd = (nameOrEvent?: unknown, phone?: unknown) => {
    setEditingRecord(null);
    const cleanName = typeof nameOrEvent === 'string' ? nameOrEvent : '';
    const cleanPhone = typeof phone === 'string' ? phone : '';
    setAddPrefill({ name: cleanName, phone: cleanPhone });
    setIsFormOpen(true);
  };

  // Open Partial Payment Form
  const handleOpenPartial = (record: UdhaariRecord) => {
    setPartialTargetRecord(record);
  };

  // Delete Record Confirmation
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      await deleteRecord(recordToDelete.id);
      showToast(`Credit record deleted for ${recordToDelete.personName}.`, 'success');
      setRecordToDelete(null);
      await loadRecords();
    } catch (err) {
      console.error('Failed to delete record', err);
      showToast('Failed to delete record.', 'error');
    }
  };

  // Toggle Repaid status
  const handleToggleRepaid = async (record: UdhaariRecord) => {
    try {
      const willBeRepaid = record.status !== 'repaid';
      await setRecordRepaidStatus(record.id, willBeRepaid);
      showToast(
        willBeRepaid
          ? `Marked ${record.personName} as Settled.`
          : `Marked ${record.personName} as Pending.`,
        'success'
      );
      await loadRecords();
    } catch (err) {
      console.error('Failed to toggle status', err);
      showToast('Failed to update status.', 'error');
    }
  };

  // Open Customer Khata Detail Sheet
  const handleOpenLedger = useCallback(
    (personName: string) => {
      const khatas = groupRecordsByCustomer(records);
      const target = khatas.find(
        (k) => normalizeCustomerName(k.personName) === normalizeCustomerName(personName)
      );
      if (target) {
        setActiveLedgerCustomer(target);
      } else {
        showToast(`Customer ledger not found for ${personName}.`, 'error');
      }
    },
    [records, showToast]
  );

  // Open Settle All Dues Confirmation Modal
  const handleOpenSettleAll = useCallback(
    (khataOrName: CustomerKhata | string) => {
      if (typeof khataOrName === 'string') {
        const khatas = groupRecordsByCustomer(records);
        const target = khatas.find(
          (k) => normalizeCustomerName(k.personName) === normalizeCustomerName(khataOrName)
        );
        if (target) {
          setActiveSettleKhata(target);
        }
      } else {
        setActiveSettleKhata(khataOrName);
      }
    },
    [records]
  );

  // Confirm Settle All Dues Action
  const handleConfirmSettleAll = async (
    personName: string,
    personId?: string,
    settlementDate?: string,
    notes?: string
  ) => {
    try {
      const result = await settleAllDuesForCustomer(
        personName,
        personId,
        settlementDate,
        notes
      );
      showToast(
        `${personName}: All ${result.settledRecordsCount} loans (${formatINR(
          result.totalSettledPaise
        )}) settled!`,
        'success'
      );
      await loadRecords();

      // If Customer Ledger was open, refresh its data
      setActiveLedgerCustomer((prev) => {
        if (!prev) return null;
        const updatedKhatas = groupRecordsByCustomer(result.records);
        return (
          updatedKhatas.find(
            (k) => normalizeCustomerName(k.personName) === normalizeCustomerName(personName)
          ) || null
        );
      });
    } catch (err) {
      console.error('Failed to settle all dues', err);
      showToast('Failed to settle dues.', 'error');
    }
  };

  // Quick jump from Dashboard filter clicks
  const handleDashboardFilterSelect = (filter: 'pending' | 'partial' | 'overdue' | 'repaid') => {
    setActiveFilter(filter);
    setActiveTab('records');
  };

  const handleUpdateNotificationSettings = (newSettings: NotificationSettings) => {
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);
    syncAllNotifications(records, newSettings);
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      <Toast toast={toast} />

      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="main-content">
        {dbError && (
          <div className="warning-alert-box">
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Database Note</div>
              <div>{dbError}</div>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 8, padding: '4px 10px', fontSize: '0.75rem', minHeight: 32 }}
                onClick={loadRecords}
              >
                <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} /> Try Again
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Loading Credit Ledger...</div>
            <p style={{ fontSize: '0.80rem', marginTop: 4 }}>100% offline & secure local database</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                metrics={metrics}
                records={records}
                onAddClick={() => handleOpenAdd()}
                onFilterSelect={handleDashboardFilterSelect}
                onEditRecord={handleOpenEdit}
                onToggleRepaid={handleToggleRepaid}
                onOpenPartialPayment={handleOpenPartial}
                onOpenLedger={handleOpenLedger}
              />
            )}

            {activeTab === 'records' && (
              <RecordList
                records={records}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                onAddClick={(name, phone) => handleOpenAdd(name, phone)}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={(rec) => setRecordToDelete(rec)}
                onToggleRepaid={handleToggleRepaid}
                onOpenPartialPayment={handleOpenPartial}
                onOpenLedger={handleOpenLedger}
                onOpenSettleAll={handleOpenSettleAll}
              />
            )}

            {activeTab === 'backup' && (
              <BackupScreen
                records={records}
                showToast={showToast}
                notificationSettings={notificationSettings}
                onUpdateNotificationSettings={handleUpdateNotificationSettings}
                onRefreshRecords={loadRecords}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar with Integrated Add (+) Button */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span className="nav-tab-label">Dashboard</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <Receipt size={20} />
          <span className="nav-tab-label">
            Records {records.length > 0 && `(${records.length})`}
          </span>
        </button>

        <button
          type="button"
          className="nav-tab-btn nav-add-btn"
          onClick={() => handleOpenAdd()}
          title="Record New Credit (+)"
          aria-label="Record New Credit"
        >
          <div className="nav-add-icon-circle">
            <Plus size={20} strokeWidth={2.5} />
          </div>
          <span className="nav-tab-label nav-add-label">Add Credit</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          <FileText size={20} />
          <span className="nav-tab-label">Reports & Alerts</span>
        </button>
      </nav>

      {/* Add / Edit Credit Modal */}
      <UdhaariFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRecord(null);
          setAddPrefill({});
        }}
        onSubmit={handleFormSubmit}
        editingRecord={editingRecord}
        initialPersonName={addPrefill.name}
        initialPhoneNumber={addPrefill.phone}
      />

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        isOpen={Boolean(partialTargetRecord)}
        record={partialTargetRecord}
        onClose={() => setPartialTargetRecord(null)}
        onSubmit={handlePartialPaymentSubmit}
      />

      {/* Customer Ledger Statement Sheet */}
      {activeLedgerCustomer && (
        <CustomerLedgerModal
          isOpen={Boolean(activeLedgerCustomer)}
          khata={activeLedgerCustomer}
          onClose={() => setActiveLedgerCustomer(null)}
          onAddUdhaarForCustomer={(name, phone) => handleOpenAdd(name, phone)}
          onEditRecord={handleOpenEdit}
          onDeleteRecord={(rec) => setRecordToDelete(rec)}
          onToggleRepaid={handleToggleRepaid}
          onOpenPartialPayment={handleOpenPartial}
          onOpenSettleAll={(khata) => setActiveSettleKhata(khata)}
        />
      )}

      {/* Person-Level Settle All Dues Modal */}
      {activeSettleKhata && (
        <SettleAllModal
          isOpen={Boolean(activeSettleKhata)}
          khata={activeSettleKhata}
          onClose={() => setActiveSettleKhata(null)}
          onConfirmSettle={handleConfirmSettleAll}
        />
      )}

      {/* Deletion Confirmation Modal */}
      {recordToDelete && (
        <ConfirmModal
          isOpen={Boolean(recordToDelete)}
          title="Delete Credit Record?"
          message={`Are you sure you want to delete the ${formatINR(
            recordToDelete.amountPaise
          )} credit record for "${recordToDelete.personName}"?`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setRecordToDelete(null)}
        />
      )}
    </div>
  );
};

export default App;
