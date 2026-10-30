/**
 * Currency utilities for Udhaari Manager.
 * All internal money calculations are stored as integers in paise (1 INR = 100 paise)
 * to avoid floating-point inaccuracies.
 */

/**
 * Converts a rupee amount (number or string) to paise integer safely.
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.trim().replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }
  if (isNaN(rupees) || rupees <= 0) return 0;
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to rupee floating value for math or input prefilling.
 */
export function paiseToRupees(paise: number): number {
  if (!paise || isNaN(paise) || paise < 0) return 0;
  return paise / 100;
}

/**
 * Formats paise into standard Indian Rupee representation (e.g. ₹500, ₹1,500, ₹1,25,000).
 */
export function formatINR(paise: number, showDecimalsIfAny: boolean = true): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0';
  }

  const rupees = paise / 100;
  const hasDecimals = paise % 100 !== 0;

  try {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: showDecimalsIfAny && hasDecimals ? 2 : 0,
      minimumFractionDigits: showDecimalsIfAny && hasDecimals ? 2 : 0,
    });
    return formatter.format(rupees);
  } catch {
    // Fallback if Intl fails
    return `₹${rupees.toLocaleString('en-IN')}`;
  }
}

/**
 * Converts a rupee value to quick readable text (e.g. 1500 -> "One Thousand Five Hundred Rupees")
 * for friendly feedback while entering amount.
 */
export function amountInWords(rupees: number): string {
  if (!rupees || rupees <= 0) return '';
  if (rupees < 1000) return `₹${rupees}`;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Crore`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} Lakh`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${rupees}`;
}
