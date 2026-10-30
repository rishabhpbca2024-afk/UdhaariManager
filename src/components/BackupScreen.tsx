import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  FileText,
  MessageCircle,
  Download,
  Repeat,
} from 'lucide-react';
import type { UdhaariRecord, NotificationSettings } from '../types/udhaari';
import { downloadPdfReport, sharePdfReport } from '../services/documentExport';
import {
  syncAllNotifications,
  requestNotificationPermission,
} from '../services/notifications';

interface BackupScreenProps {
  records: UdhaariRecord[];
  showToast: (msg: string, type: 'success' | 'error') => void;
  notificationSettings: NotificationSettings;
  onUpdateNotificationSettings: (settings: NotificationSettings) => void;
  onRefreshRecords?: () => Promise<void>;
}

export const BackupScreen: React.FC<BackupScreenProps> = ({
  records,
  showToast,
  notificationSettings,
  onUpdateNotificationSettings,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  // 1. Export PDF
  const handleExportPdf = async () => {
    if (records.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      await downloadPdfReport(records);
      showToast('PDF report downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF Export error', err);
      showToast('Failed to download PDF report.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Share PDF on WhatsApp
  const handleSharePdf = async () => {
    if (records.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      await sharePdfReport(records);
    } catch (err) {
      console.error('PDF Share error', err);
      showToast('Failed to share PDF report.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Toggle Daily Reminder
  const handleToggleDailyReminder = async (checked: boolean) => {
    const updated: NotificationSettings = {
      ...notificationSettings,
      dailyEveningReminder: checked,
    };
    onUpdateNotificationSettings(updated);

    if (checked) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast('Please grant notification permission to receive alerts.', 'error');
      } else {
        await syncAllNotifications(records, updated);
        showToast('Daily reminder enabled.', 'success');
      }
    } else {
      await syncAllNotifications(records, updated);
      showToast('Daily reminder disabled.', 'success');
    }
  };

  // 4. Change Daily Reminder Time
  const handleChangeDailyTime = async (timeStr: string) => {
    const updated: NotificationSettings = {
      ...notificationSettings,
      dailyReminderTime: timeStr,
    };
    onUpdateNotificationSettings(updated);
    if (updated.dailyEveningReminder) {
      await syncAllNotifications(records, updated);
      showToast(`Daily reminder time set to ${timeStr}.`, 'success');
    }
  };

  // 5. Toggle Due Date Reminders
  const handleToggleDueDateReminder = async (checked: boolean) => {
    const updated: NotificationSettings = {
      ...notificationSettings,
      dueDateReminders: checked,
    };
    onUpdateNotificationSettings(updated);

    if (checked) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast('Please grant notification permission to receive alerts.', 'error');
      } else {
        await syncAllNotifications(records, updated);
        showToast('Due date reminder enabled.', 'success');
      }
    } else {
      await syncAllNotifications(records, updated);
      showToast('Due date reminder disabled.', 'success');
    }
  };

  // 6. Change Due Date Reminder Time
  const handleChangeDueDateTime = async (timeStr: string) => {
    const updated: NotificationSettings = {
      ...notificationSettings,
      dueDateReminderTime: timeStr,
    };
    onUpdateNotificationSettings(updated);
    if (updated.dueDateReminders) {
      await syncAllNotifications(records, updated);
      showToast(`Due date reminder time set to ${timeStr}.`, 'success');
    }
  };

  // 7. Toggle No-Due-Date 7-Day Weekly Reminders
  const handleToggleWeeklyReminders = async (checked: boolean) => {
    const updated: NotificationSettings = {
      ...notificationSettings,
      noDueDateWeeklyReminders: checked,
    };
    onUpdateNotificationSettings(updated);

    if (checked) {
      await requestNotificationPermission();
      await syncAllNotifications(records, updated);
      showToast('7-day recurring reminders enabled.', 'success');
    } else {
      await syncAllNotifications(records, updated);
      showToast('7-day recurring reminders disabled.', 'success');
    }
  };

  return (
    <div className="backup-screen-container" style={{ padding: '0', maxWidth: 640, margin: '0 auto' }}>
      {/* CARD 1: PDF REPORT DOWNLOAD & SHARE */}
      <div className="backup-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <FileText size={22} color="var(--primary)" />
          <h3 className="backup-card-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
            Export Credit Reports
          </h3>
        </div>
        <p className="backup-card-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
          Download a clean, structured PDF statement of all credit records ({records.length}) or share it directly via WhatsApp.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={isExporting}
            onClick={handleExportPdf}
            style={{
              flex: 1,
              minWidth: 140,
            }}
          >
            <Download size={18} />
            <span>{isExporting ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={isExporting}
            onClick={handleSharePdf}
            style={{
              flex: 1,
              minWidth: 140,
            }}
          >
            <MessageCircle size={18} color="#25D366" />
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>

      {/* CARD 2: REMINDERS & NOTIFICATION SETTINGS */}
      <div className="backup-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Bell size={22} color="var(--primary)" />
          <h3 className="backup-card-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
            Reminders & Offline Alerts
          </h3>
        </div>
        <p className="backup-card-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
          Scheduled alerts arrive on time even when the app is closed or the device is asleep.
        </p>

        {/* 1. Daily Evening Reminder */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: 12,
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-main)' }}>
                Daily Evening Reminder
              </span>
            </div>
            <label className="toggle-switch" style={{ cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={notificationSettings.dailyEveningReminder}
                onChange={(e) => handleToggleDailyReminder(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Reminds you to record new credits or repayments before wrapping up for the day.
          </div>

          {notificationSettings.dailyEveningReminder && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                Reminder Time:
              </span>
              <input
                type="time"
                value={notificationSettings.dailyReminderTime || '19:00'}
                onChange={(e) => handleChangeDailyTime(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* 2. Due Date Reminders */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: 12,
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="var(--status-partial-text)" />
              <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-main)' }}>
                Due Date Reminders
              </span>
            </div>
            <label className="toggle-switch" style={{ cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={notificationSettings.dueDateReminders}
                onChange={(e) => handleToggleDueDateReminder(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Sends an alert 1 day before and on the morning of repayment due dates.
          </div>

          {notificationSettings.dueDateReminders && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                Alert Time:
              </span>
              <input
                type="time"
                value={notificationSettings.dueDateReminderTime || '09:00'}
                onChange={(e) => handleChangeDueDateTime(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* 3. 7-Day Recurring Reminders for No Due Date */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Repeat size={18} color="var(--status-pending-text)" />
              <span style={{ fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-main)' }}>
                7-Day Weekly Reminders (No Due Date)
              </span>
            </div>
            <label className="toggle-switch" style={{ cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={notificationSettings.noDueDateWeeklyReminders}
                onChange={(e) => handleToggleWeeklyReminders(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Sends an alert every 7 days for open credits that don't have a specific due date until settled.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupScreen;
