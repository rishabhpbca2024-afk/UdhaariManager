/**
 * Date utilities for Udhaari Manager.
 */

/**
 * Returns today's date in local YYYY-MM-DD format.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given due date has passed compared to today.
 * Only applies if dueDate is non-empty.
 */
export function isDueDatePassed(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const today = getTodayDateString();
  return dueDate < today;
}

/**
 * Calculates how many days overdue a record is.
 */
export function getDaysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate || !isDueDatePassed(dueDate)) return 0;
  const today = new Date(getTodayDateString()).getTime();
  const due = new Date(dueDate).getTime();
  const diffTime = today - due;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculates how many days remain until repayment date.
 */
export function getDaysRemaining(dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  const today = new Date(getTodayDateString()).getTime();
  const due = new Date(dueDate).getTime();
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Formats YYYY-MM-DD date into a readable string like "24 Oct 2026".
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
