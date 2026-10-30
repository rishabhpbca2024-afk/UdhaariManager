import { rupeesToPaise, paiseToRupees, formatINR, amountInWords } from '../src/utils/currency';
import { getTodayDateString, isDueDatePassed, getDaysOverdue, formatDisplayDate } from '../src/utils/date';
import { validateBackupJson, createBackupPayload } from '../src/services/backup';
import { calculateMetrics } from '../src/services/repository';
import type { UdhaariRecord } from '../src/types/udhaari';

let failures = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    failures++;
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log('--- TEST 1: Currency & Safe Integer (Paise) Conversions ---');
assert(rupeesToPaise(500) === 50000, '500 INR -> 50000 paise');
assert(rupeesToPaise('1,500.50') === 150050, '1,500.50 INR -> 150050 paise');
assert(rupeesToPaise('0') === 0, '0 INR -> 0 paise');
assert(rupeesToPaise(-100) === 0, 'Negative amount guarded -> 0 paise');
assert(paiseToRupees(50000) === 500, '50000 paise -> 500 INR');
assert(formatINR(50000).includes('500'), 'Formatted INR contains 500');
assert(formatINR(150000).includes('1,500'), 'Formatted INR contains 1,500');
assert(amountInWords(1500) === '₹1.5k', 'amountInWords 1500 -> ₹1.5k');

console.log('\n--- TEST 2: Date & Overdue Logic ---');
const today = getTodayDateString();
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `Today is YYYY-MM-DD: ${today}`);
assert(isDueDatePassed('2020-01-01') === true, 'Past date 2020-01-01 is overdue');
assert(isDueDatePassed('2099-01-01') === false, 'Future date 2099-01-01 is not overdue');
assert(getDaysOverdue('2020-01-01') > 1000, 'Overdue days calculated properly');
assert(getDaysOverdue('2099-01-01') === 0, 'Future date overdue days is 0');
assert(formatDisplayDate('2026-10-25').includes('2026'), 'Date formatting works');

console.log('\n--- TEST 3: Business Calculations & Partial Repayment ---');
const mockRecords: UdhaariRecord[] = [
  {
    id: '1',
    personName: 'Ramesh Sharma',
    amountPaise: 200000, // ₹2,000 total loan
    paidPaise: 100000,   // ₹1,000 partially paid (50%)
    paymentHistory: [
      { id: 'p1', amountPaise: 100000, date: '2026-10-24', notes: 'Cash payment 50%' }
    ],
    dateGiven: '2026-10-01',
    dueDate: '2026-10-20', // Overdue
    phoneNumber: '9876543210',
    notes: 'Shop loan',
    status: 'partial',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    personName: 'Suresh Patel',
    amountPaise: 200000, // ₹2,000
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-15',
    dueDate: '2099-10-20', // Not overdue
    phoneNumber: null,
    notes: null,
    status: 'pending',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    personName: 'Geeta Devi',
    amountPaise: 50000, // ₹500
    paidPaise: 50000,
    paymentHistory: [],
    dateGiven: '2026-09-01',
    dueDate: '2026-09-15',
    phoneNumber: null,
    notes: 'Settled already',
    status: 'repaid', // Fully repaid
    repaidDate: '2026-09-14',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const metrics = calculateMetrics(mockRecords);
// Outstanding must be: (200000 - 100000) [Ramesh] + 200000 [Suresh] = 300000 paise (₹3,000)
assert(metrics.totalOutstandingPaise === 300000, 'Total outstanding only counts remaining balance: ₹3,000');
assert(metrics.pendingCount === 1, 'Pending count is 1 (Suresh)');
assert(metrics.partialCount === 1, 'Partial count is 1 (Ramesh)');
// Overdue remaining must be 100000 (Ramesh remaining balance)
assert(metrics.totalOverduePaise === 100000, 'Overdue amount counts remaining unpaid balance: ₹1,000');
assert(metrics.overdueCount === 1, 'Overdue count is 1');
// Total repaid must be: 100000 (Ramesh partial) + 50000 (Geeta full) = 150000 paise (₹1,500)
assert(metrics.totalRepaidPaise === 150000, 'Total repaid includes partial payments + full repayments: ₹1,500');

console.log('\n--- TEST 4: Backup Export and Strict Validation ---');
const backupPayload = createBackupPayload(mockRecords);
assert(backupPayload.recordsCount === 3, 'Backup payload has 3 records');
assert(backupPayload.app === 'Udhaari Manager', 'Backup payload has valid app tag');

const validJson = JSON.stringify(backupPayload);
const valResult = validateBackupJson(validJson);
assert(valResult.success === true && valResult.count === 3, 'Valid backup passes verification');
assert(valResult.records[0].paidPaise === 100000, 'Backup correctly restores paidPaise');
assert(valResult.records[0].status === 'partial', 'Backup correctly restores partial status');

const invalidJson1 = '{"corrupted": true}';
const invalidRes1 = validateBackupJson(invalidJson1);
assert(invalidRes1.success === false, 'Invalid format rejected');

const invalidJson2 = JSON.stringify({ records: [{ personName: '', amountPaise: -10 }] });
const invalidRes2 = validateBackupJson(invalidJson2);
assert(invalidRes2.success === false, 'Negative amount / missing name rejected');

console.log('\n--- TEST 5: Indian Mobile Number Validation ---');
import { validateIndianMobile } from '../src/utils/validation';
assert(validateIndianMobile('1234567892').isValid === false, 'Dummy number 1234567892 is rejected');
assert(validateIndianMobile('9876543210').isValid === true, 'Standard 10-digit mobile 9876543210 is accepted');
assert(validateIndianMobile('+91 98765 43210').isValid === true, '+91 format is accepted');
assert(validateIndianMobile('09876543210').isValid === true, '0 prefix format is accepted');
assert(validateIndianMobile('').isValid === true, 'Empty phone is valid (optional field)');
assert(validateIndianMobile('9999999999').isValid === false, 'Repeating digits 9999999999 is rejected');
assert(validateIndianMobile('12345').isValid === false, 'Short number 12345 is rejected');

console.log('\n--- TEST 6: Person-Level Customer Khata Grouping & Stable IDs ---');
import { groupRecordsByCustomer, getStablePersonId, normalizeCustomerName } from '../src/utils/customerKhata';
const pId1 = getStablePersonId('Aman', '9876543210');
const pId2 = getStablePersonId('Aman', '9876543210');
const pId3 = getStablePersonId('  aman  ', '9876543210');
assert(pId1 === pId2, 'Stable person ID is deterministic for identical input');
assert(pId1 === pId3, 'Stable person ID handles whitespace and casing');
assert(normalizeCustomerName('  Aman Sharma  ') === 'aman sharma', 'normalizeCustomerName trims and lowercases');

const amanRecords: UdhaariRecord[] = [
  {
    id: 'l1',
    personId: pId1,
    personName: 'Aman',
    amountPaise: 200000, // ₹2,000
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-01',
    dueDate: '2026-10-30',
    phoneNumber: '9876543210',
    notes: 'Loan 1',
    status: 'pending',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l2',
    personId: pId1,
    personName: 'Aman',
    amountPaise: 300000, // ₹3,000
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-05',
    dueDate: '2026-10-30',
    phoneNumber: '9876543210',
    notes: 'Loan 2',
    status: 'pending',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l3',
    personId: pId1,
    personName: 'Aman',
    amountPaise: 100000, // ₹1,000
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-10',
    dueDate: null, // No due date
    phoneNumber: '9876543210',
    notes: 'Loan 3',
    status: 'pending',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l4',
    personId: getStablePersonId('Suresh', null),
    personName: 'Suresh',
    amountPaise: 500000, // ₹5,000
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-15',
    dueDate: '2026-11-01',
    phoneNumber: null,
    notes: 'Other customer loan',
    status: 'pending',
    repaidDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const customerKhatas = groupRecordsByCustomer(amanRecords);
assert(customerKhatas.length === 2, 'Grouped into 2 customer accounts (Aman and Suresh)');
const amanKhata = customerKhatas.find((k) => normalizeCustomerName(k.personName) === 'aman');
assert(!!amanKhata, 'Aman khata found');
assert(amanKhata?.records.length === 3, 'Aman has 3 separate loan entries');
assert(amanKhata?.totalUdhaarPaise === 600000, 'Aman total lent is ₹6,000 (600000 paise)');
assert(amanKhata?.remainingPaise === 600000, 'Aman total outstanding is ₹6,000 (600000 paise)');
assert(amanKhata?.totalPaidPaise === 0, 'Aman total repaid is 0');

console.log('\n--- TEST 7: Settle All Dues — Exact Allocation & Isolation ---');
// Simulate settle all dues for Aman:
// Outstanding loans: l1 (₹2000), l2 (₹3000), l3 (₹1000) = ₹6000
// Settling should allocate exact remaining to each loan, record in paymentHistory, mark status as repaid
const settlementDate = '2026-10-25';
const settlementNote = 'Full account settlement';
let totalSettledPaise = 0;
const settledRecords = amanRecords.map((rec) => {
  if (rec.personName === 'Aman') {
    const remaining = Math.max(0, rec.amountPaise - (rec.paidPaise || 0));
    totalSettledPaise += remaining;
    return {
      ...rec,
      paidPaise: rec.amountPaise,
      status: 'repaid' as const,
      repaidDate: settlementDate,
      paymentHistory: [
        ...rec.paymentHistory,
        {
          id: `pay_${rec.id}`,
          amountPaise: remaining,
          date: settlementDate,
          notes: settlementNote,
        },
      ],
    };
  }
  return rec; // Suresh untouched
});

assert(totalSettledPaise === 600000, 'Settle all dues recorded exactly remaining ₹6,000 (no double count)');
const updatedAmanKhata = groupRecordsByCustomer(settledRecords).find((k) => normalizeCustomerName(k.personName) === 'aman');
assert(updatedAmanKhata?.remainingPaise === 0, 'Aman outstanding balance is now 0 after Settle All Dues');
assert(updatedAmanKhata?.totalPaidPaise === 600000, 'Aman total repaid is now ₹6,000');
assert(updatedAmanKhata?.pendingCount === 0 && updatedAmanKhata?.partialCount === 0, 'Aman has 0 active loans remaining');
const sureshRecord = settledRecords.find((r) => r.personName === 'Suresh');
assert(sureshRecord?.paidPaise === 0 && sureshRecord?.status === 'pending', 'Suresh loan remains completely untouched');

console.log('\n--- TEST 8: Settle All Dues with Prior Partial Repayment ---');
// Suppose Aman had already returned ₹2,000 on Loan 2 before settling all dues
const amanWithPartial: UdhaariRecord[] = [
  { ...amanRecords[0] }, // ₹2,000 unpaid
  {
    ...amanRecords[1],   // ₹3,000 loan with ₹2,000 already repaid -> ₹1,000 remaining
    paidPaise: 200000,
    status: 'partial',
    paymentHistory: [{ id: 'p1', amountPaise: 200000, date: '2026-10-20', notes: 'Partial cash' }],
  },
  { ...amanRecords[2] }, // ₹1,000 unpaid
];

// Remaining: Loan 1 (2000) + Loan 2 (1000) + Loan 3 (1000) = ₹4,000
let partialSettleTotal = 0;
const settledPartialRecords = amanWithPartial.map((rec) => {
  const remaining = Math.max(0, rec.amountPaise - (rec.paidPaise || 0));
  partialSettleTotal += remaining;
  return {
    ...rec,
    paidPaise: rec.amountPaise,
    status: 'repaid' as const,
    repaidDate: settlementDate,
    paymentHistory: [
      ...rec.paymentHistory,
      {
        id: `pay_settle_${rec.id}`,
        amountPaise: remaining,
        date: settlementDate,
        notes: 'Final settlement of remaining dues',
      },
    ],
  };
});

assert(partialSettleTotal === 400000, 'Only remaining ₹4,000 was settled (never double-counting the prior ₹2,000)');
assert(settledPartialRecords[1].paymentHistory.length === 2, 'Prior payment history preserved + new settlement recorded');
assert(settledPartialRecords[1].paidPaise === 300000, 'Loan 2 now reflects full 300000 paid');

console.log('\n--- TEST 9: Notification Defaults & Time Configurations ---');
import { DEFAULT_NOTIFICATION_SETTINGS } from '../src/services/notifications';
assert(DEFAULT_NOTIFICATION_SETTINGS.dailyEveningReminder === true, 'Daily reminder enabled by default');
assert(DEFAULT_NOTIFICATION_SETTINGS.dailyReminderTime === '19:00', 'Daily reminder scheduled for 7:00 PM local time');
assert(DEFAULT_NOTIFICATION_SETTINGS.dueDateReminders === true, 'Due date reminders enabled by default');
assert(DEFAULT_NOTIFICATION_SETTINGS.dueDateReminderTime === '09:00', 'Due date reminders scheduled for 9:00 AM local time');
assert(DEFAULT_NOTIFICATION_SETTINGS.noDueDateWeeklyReminders === true, 'No due date weekly reminders enabled by default');

console.log('\n--- TEST 10: Potential Test/Demo Data Detection Logic ---');
// Test the scanner heuristics for identifying sample or test data safely
const mixedData: UdhaariRecord[] = [
  {
    id: 'demo-1',
    personName: 'Test Customer',
    amountPaise: 100000,
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-01',
    dueDate: null,
    phoneNumber: null,
    notes: 'demo entry',
    status: 'pending',
    repaidDate: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'demo-2',
    personName: 'Ramesh Sharma',
    amountPaise: 50000,
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-01',
    dueDate: null,
    phoneNumber: '9999999999', // Dummy phone
    notes: 'Sample seed',
    status: 'pending',
    repaidDate: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'real-1',
    personName: 'Gopal Verma',
    amountPaise: 500000,
    paidPaise: 0,
    paymentHistory: [],
    dateGiven: '2026-10-15',
    dueDate: '2026-10-30',
    phoneNumber: '9826123456',
    notes: 'Kirana ration udhari',
    status: 'pending',
    repaidDate: null,
    createdAt: '',
    updatedAt: '',
  },
];

const testKeywords = ['test', 'demo', 'sample', 'fake', 'dummy', 'mock', 'placeholder'];
const flagged = mixedData.filter((r) => {
  const normName = r.personName.toLowerCase();
  const normNotes = (r.notes || '').toLowerCase();
  const phone = (r.phoneNumber || '').trim();
  const hasKeyword = testKeywords.some((kw) => normName.includes(kw) || normNotes.includes(kw));
  const isDummyPhone = phone === '9999999999' || phone === '1234567890' || phone === '0000000000';
  return hasKeyword || isDummyPhone;
});

assert(flagged.length === 2, 'Scanner detected both test records without false positives');
assert(flagged.some((r) => r.id === 'demo-1'), 'Test Customer flagged');
assert(flagged.some((r) => r.id === 'demo-2'), 'Sample seed with dummy phone flagged');
assert(!flagged.some((r) => r.id === 'real-1'), 'Real financial record (Gopal Verma) is NOT flagged');

console.log('\n--- TEST 11: Backup Restore — Merge vs Replace Semantics ---');
const existingDB: UdhaariRecord[] = [
  { ...amanRecords[0], id: 'rec-1', personName: 'Aman' },
  { ...amanRecords[3], id: 'rec-2', personName: 'Suresh' },
];

const backupToRestore: UdhaariRecord[] = [
  { ...amanRecords[0], id: 'rec-1', personName: 'Aman', notes: 'Updated from backup' },
  { ...amanRecords[2], id: 'rec-3', personName: 'Priya' },
];

// Test Merge: replaces matching ID rec-1, adds rec-3, keeps existing rec-2
const mergedMap = new Map<string, UdhaariRecord>();
for (const r of existingDB) mergedMap.set(r.id, r);
for (const r of backupToRestore) mergedMap.set(r.id, r);
const mergedList = Array.from(mergedMap.values());
assert(mergedList.length === 3, 'Merge contains 3 total records (rec-1 updated, rec-2 retained, rec-3 added)');
assert(mergedList.find((r) => r.id === 'rec-1')?.notes === 'Updated from backup', 'Merged record updated correctly');
assert(mergedList.some((r) => r.id === 'rec-2'), 'Existing record preserved in merge');

// Test Replace: completely replaces with backup set
const replacedList = [...backupToRestore];
assert(replacedList.length === 2, 'Replace contains exactly the 2 records from backup');
assert(!replacedList.some((r) => r.id === 'rec-2'), 'Old records not in backup are replaced in replace mode');

console.log(`\n========================================`);
if (failures === 0) {
  console.log('🎉 ALL UNIT & INTEGRATION TESTS PASSED!');
  process.exit(0);
} else {
  console.error(`💥 ${failures} TESTS FAILED!`);
  process.exit(1);
}
