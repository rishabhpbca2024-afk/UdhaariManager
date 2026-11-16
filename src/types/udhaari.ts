export type UdhaariStatus = 'pending' | 'partial' | 'repaid';
export type UdhaariType = 'given' | 'taken';

export interface PaymentEntry {
  id: string;
  amountPaise: number;
  date: string; // YYYY-MM-DD
  notes?: string | null;
}

export interface UdhaariRecord {
  id: string;
  personId?: string; // Stable identifier for person/customer
  personName: string;
  type?: UdhaariType; // 'given' (Lent / Receivable) or 'taken' (Borrowed / Payable), default 'given'
  amountPaise: number; // Stored as integer in paise (e.g. ₹500.00 = 50000)
  paidPaise: number; // Amount repaid so far in paise (default 0)
  paymentHistory: PaymentEntry[];
  dateGiven: string; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD or null
  phoneNumber: string | null;
  notes: string | null;
  status: UdhaariStatus;
  repaidDate: string | null; // YYYY-MM-DD or null
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type UdhaariFormData = {
  personName: string;
  type: UdhaariType;
  amountRupees: string; // User input as string
  paidRupees: string; // Optional partial paid amount
  dateGiven: string;
  dueDate: string;
  phoneNumber: string;
  notes: string;
};

export type FormValidationErrors = {
  personName?: string;
  amountRupees?: string;
  paidRupees?: string;
  dateGiven?: string;
  dueDate?: string;
  phoneNumber?: string;
};

export type StatusFilter = 'all' | 'given' | 'taken' | 'pending' | 'partial' | 'overdue' | 'repaid';

export type SortField = 'newest' | 'oldest' | 'dueDate' | 'amountDesc' | 'amountAsc';

export interface DashboardMetrics {
  totalOutstandingPaise: number; // (amountPaise - paidPaise) for all non-repaid records
  totalGivenOutstandingPaise: number; // Total to receive (Given / Receivable)
  totalTakenOutstandingPaise: number; // Total to pay (Borrowed / Payable)
  netBalancePaise: number; // totalGivenOutstandingPaise - totalTakenOutstandingPaise
  givenCount: number;
  takenCount: number;
  pendingCount: number;
  partialCount: number;
  totalOverduePaise: number;
  overdueCount: number;
  totalRepaidPaise: number;
  repaidCount: number;
  totalRecordsCount: number;
}

export interface CustomerKhata {
  personId?: string;
  personName: string;
  phoneNumber?: string | null;
  totalUdhaarPaise: number;
  totalPaidPaise: number;
  remainingPaise: number;
  totalGivenPaise: number;
  totalTakenPaise: number;
  netRemainingPaise: number; // (remaining given) - (remaining taken)
  recordsCount: number;
  givenRecordsCount: number;
  takenRecordsCount: number;
  pendingCount: number;
  partialCount: number;
  repaidCount: number;
  overdueCount: number;
  lastDate: string;
  records: UdhaariRecord[];
}

export interface SettleAllDuesResult {
  customerName: string;
  personId?: string;
  totalSettledPaise: number;
  settledRecordsCount: number;
  settlementDate: string;
  records: UdhaariRecord[];
}

export interface BackupPayload {
  app: 'Udhaari Manager';
  version: number;
  exportedAt: string;
  recordsCount: number;
  records: UdhaariRecord[];
}

export interface NotificationSettings {
  dailyEveningReminder: boolean; // Daily reminder (7:00 PM default)
  dailyReminderTime: string; // e.g. "19:00"
  dueDateReminders: boolean; // 1 day before & on due date (9:00 AM)
  dueDateReminderTime: string; // e.g. "09:00"
  noDueDateWeeklyReminders: boolean; // Every 7 days from dateGiven
  notificationPermissionGranted: boolean;
}

