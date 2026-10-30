import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ScheduleOptions } from '@capacitor/local-notifications';
import type { UdhaariRecord, NotificationSettings } from '../types/udhaari';
import { formatINR } from '../utils/currency';
import { normalizeCustomerName } from '../utils/customerKhata';

const SETTINGS_KEY = 'udhaari_notification_settings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyEveningReminder: true,
  dailyReminderTime: '19:00', // 7:00 PM local phone time
  dueDateReminders: true,
  dueDateReminderTime: '09:00', // 9:00 AM local phone time
  noDueDateWeeklyReminders: true, // 7-day recurring from loan date
  notificationPermissionGranted: false,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save notification settings', err);
  }
}

/**
 * Creates high-priority notification channel for heads-up alerts with sound and vibration
 */
export async function setupNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'udhaari_channel',
      name: 'Udhaari Alerts & Reminders',
      description: 'Important Udhaari reminders and due date alerts',
      importance: 5, // High priority (heads-up banner with sound)
      visibility: 1, // Visible on lockscreen
      vibration: true,
    });
  } catch (err) {
    console.warn('Failed to create notification channel', err);
  }
}

/**
 * Checks and requests notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // Supported in web test environment
  }

  try {
    await setupNotificationChannel();
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      return true;
    }
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (err) {
    console.warn('Error checking/requesting notification permissions:', err);
    return false;
  }
}

/**
 * Deterministically generates an integer ID from a string key
 */
export function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 50000);
}

/**
 * Schedules a test notification after specified seconds
 */
export async function scheduleTestNotification(
  secondsFromNow: number = 10,
  title: string = '🔔 Credit Ledger: Notification Test',
  body: string = 'Success! Offline notifications are working properly in the background.'
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log(`[Web Simulation] Test Notification scheduled in ${secondsFromNow}s: "${title}" - ${body}`);
    return true;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return false;

    await setupNotificationChannel();
    const atTime = new Date(Date.now() + Math.max(2, secondsFromNow) * 1000);
    const testId = 90000 + Math.floor(Math.random() * 9999);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title,
          body,
          channelId: 'udhaari_channel',
          schedule: {
            at: atTime,
            allowWhileIdle: true,
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('Failed to schedule test notification', err);
    return false;
  }
}

/**
 * Schedules all local offline notifications:
 * 1. Daily 7:00 PM Reminder (time configurable)
 * 2. Due Date reminders (1 day before & on due date at 9:00 AM, grouped by person)
 * 3. No-Due-Date reminders (every 7 days from loan date, grouped by person)
 */
export async function syncAllNotifications(
  records: UdhaariRecord[],
  settings?: NotificationSettings
): Promise<void> {
  const currentSettings = settings || getNotificationSettings();

  if (!Capacitor.isNativePlatform()) {
    console.log('Udhaari Notifications: Running in browser dev mode (Simulated sync)');
    return;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    // Cancel previously scheduled scheduled batch notifications (IDs below 90000)
    // preserving any user-triggered test notifications (IDs 90000+)
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter((n) => n.id < 90000)
      .map((n) => ({ id: n.id }));

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }

    const notificationsToSchedule: ScheduleOptions['notifications'] = [];
    const now = new Date();

    // -------------------------------------------------------------
    // 1. Daily Reminder (Default: 7:00 PM / 19:00 local phone time)
    // -------------------------------------------------------------
    if (currentSettings.dailyEveningReminder) {
      const [dailyHStr, dailyMStr] = (currentSettings.dailyReminderTime || '19:00').split(':');
      const dailyHour = parseInt(dailyHStr || '19', 10);
      const dailyMinute = parseInt(dailyMStr || '0', 10);

      // Schedule exact RTC_WAKEUP alarms for the next 14 days without `repeats: true`.
      // Modern Android (Doze mode & killed/cleared app state) only wakes the device
      // when `allowWhileIdle: true` is set on non-repeating `at: Date` alarms.
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + dayOffset);
        scheduledTime.setHours(dailyHour, dailyMinute, 0, 0);

        if (scheduledTime.getTime() > now.getTime()) {
          notificationsToSchedule.push({
            id: 1001 + dayOffset, // IDs 1001 to 1014
            title: 'Credit Ledger — Daily Reminder',
            body: 'Did you issue credit or collect payments today? Remember to keep your records updated.',
            channelId: 'udhaari_channel',
            schedule: {
              at: scheduledTime,
              allowWhileIdle: true,
            },
          });
        }
      }
    }

    // Filter to active loans that have remaining unpaid balance
    const activeRecords = records.filter((r) => {
      if (!r || r.status === 'repaid') return false;
      const rem = Math.max(0, (r.amountPaise || 0) - (r.paidPaise || 0));
      return rem > 0;
    });

    const [dueHStr, dueMStr] = (currentSettings.dueDateReminderTime || '09:00').split(':');
    const dueHour = parseInt(dueHStr || '9', 10);
    const dueMinute = parseInt(dueMStr || '0', 10);

    // -------------------------------------------------------------
    // 2. Due Date Reminders (Grouped by person & date)
    // -------------------------------------------------------------
    if (currentSettings.dueDateReminders) {
      // Grouping map for 1-day-before and on-due-date
      // Key: `dateStr_type_normName` -> { personName, dateStr, type: 'before' | 'on_due', totalRemainingPaise, count }
      interface DueGroup {
        personName: string;
        targetDate: Date;
        type: 'before' | 'on_due';
        totalRemainingPaise: number;
        count: number;
      }
      const dueGroups = new Map<string, DueGroup>();

      for (const record of activeRecords) {
        if (!record.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(record.dueDate)) continue;

        const rem = Math.max(0, record.amountPaise - (record.paidPaise || 0));
        if (rem <= 0) continue;

        const [y, m, d] = record.dueDate.split('-').map(Number);
        const norm = normalizeCustomerName(record.personName);

        // Date of due date at dueHour:dueMinute
        const onDueDate = new Date(y, m - 1, d, dueHour, dueMinute, 0, 0);

        // Date 1 day before due date at dueHour:dueMinute
        const dayBeforeDate = new Date(y, m - 1, d - 1, dueHour, dueMinute, 0, 0);

        // 1 Day Before: only if in the future
        if (dayBeforeDate.getTime() > now.getTime()) {
          const beforeKey = `before_${dayBeforeDate.toISOString().split('T')[0]}_${norm}`;
          const existing = dueGroups.get(beforeKey);
          if (existing) {
            existing.totalRemainingPaise += rem;
            existing.count += 1;
          } else {
            dueGroups.set(beforeKey, {
              personName: record.personName,
              targetDate: dayBeforeDate,
              type: 'before',
              totalRemainingPaise: rem,
              count: 1,
            });
          }
        }

        // On Due Date: only if in the future
        if (onDueDate.getTime() > now.getTime()) {
          const onKey = `on_${record.dueDate}_${norm}`;
          const existing = dueGroups.get(onKey);
          if (existing) {
            existing.totalRemainingPaise += rem;
            existing.count += 1;
          } else {
            dueGroups.set(onKey, {
              personName: record.personName,
              targetDate: onDueDate,
              type: 'on_due',
              totalRemainingPaise: rem,
              count: 1,
            });
          }
        }
      }

      for (const [key, group] of dueGroups) {
        const hash = hashStringToInt(key);
        const notifId = group.type === 'before' ? 20000 + (hash % 10000) : 30000 + (hash % 10000);
        const formattedAmount = formatINR(group.totalRemainingPaise);

        const body =
          group.type === 'before'
            ? `${group.personName} owes you ${formattedAmount}${
                group.count > 1 ? ` across ${group.count} loans` : ''
              }. The repayment due date is tomorrow.`
            : `${group.personName} owes you ${formattedAmount}${
                group.count > 1 ? ` across ${group.count} loans` : ''
              }. The repayment due date is today.`;

        notificationsToSchedule.push({
          id: notifId,
          title: `${group.personName}’s Repayment Reminder`,
          body,
          channelId: 'udhaari_channel',
          schedule: {
            at: group.targetDate,
            allowWhileIdle: true,
          },
        });
      }
    }

    // -------------------------------------------------------------
    // 3. No Due Date Specified: 7-Day Recurring Reminders
    // -------------------------------------------------------------
    if (currentSettings.noDueDateWeeklyReminders) {
      // Grouping map for weekly intervals
      // Key: `dateStr_normName` -> { personName, targetDate, totalRemainingPaise }
      const weeklyGroups = new Map<string, { personName: string; targetDate: Date; totalRemainingPaise: number }>();

      for (const record of activeRecords) {
        // Only loans with NO due date
        if (record.dueDate && record.dueDate.trim().length > 0) continue;

        const rem = Math.max(0, record.amountPaise - (record.paidPaise || 0));
        if (rem <= 0) continue;

        if (!record.dateGiven || !/^\d{4}-\d{2}-\d{2}$/.test(record.dateGiven)) continue;

        const [y, m, d] = record.dateGiven.split('-').map(Number);
        const norm = normalizeCustomerName(record.personName);

        // Schedule recurring intervals: 7, 14, 21, 28, 35, 42, 49, 56 days from loan date
        const intervalsDays = [7, 14, 21, 28, 35, 42, 49, 56];

        for (const daysOffset of intervalsDays) {
          const reminderDate = new Date(y, m - 1, d + daysOffset, dueHour, dueMinute, 0, 0);
          if (reminderDate.getTime() > now.getTime()) {
            const dateStr = reminderDate.toISOString().split('T')[0];
            const groupKey = `${dateStr}_${norm}`;
            const existing = weeklyGroups.get(groupKey);
            if (existing) {
              existing.totalRemainingPaise += rem;
            } else {
              weeklyGroups.set(groupKey, {
                personName: record.personName,
                targetDate: reminderDate,
                totalRemainingPaise: rem,
              });
            }
          }
        }
      }

      for (const [key, group] of weeklyGroups) {
        const hash = hashStringToInt(key);
        const notifId = 40000 + (hash % 20000);
        const formattedAmount = formatINR(group.totalRemainingPaise);

        notificationsToSchedule.push({
          id: notifId,
          title: `Pending Credit — ${group.personName}`,
          body: `${group.personName} still owes you ${formattedAmount}. Review the outstanding payment in Udhaari Manager.`,
          channelId: 'udhaari_channel',
          schedule: {
            at: group.targetDate,
            allowWhileIdle: true,
          },
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
      console.log(`Scheduled ${notificationsToSchedule.length} local notifications successfully.`);
    }
  } catch (err) {
    console.error('Error in syncAllNotifications:', err);
  }
}
