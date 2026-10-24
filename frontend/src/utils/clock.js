/**
 * App Clock & Maturity Calculation Utilities
 * Supports simulated demo clock and threshold-based maturity styling.
 */

// Default reference date for demo consistency (can be overridden via localStorage or custom event)
const DEFAULT_DEMO_DATE = '2024-11-15';

/**
 * Returns the current application 'today' Date object.
 * Checks localStorage for demo simulated clock override.
 */
export function getAppToday() {
  const simulated = localStorage.getItem('aicte_simulated_clock');
  if (simulated) {
    const parsed = new Date(simulated);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  // Check if mock data is centered on 2024-11
  return new Date(DEFAULT_DEMO_DATE);
}

/**
 * Calculates days remaining from today until maturity date.
 */
export function getDaysToMaturity(maturityDateStr, fromDate = getAppToday()) {
  if (!maturityDateStr) return 0;
  const matDate = new Date(maturityDateStr);
  if (isNaN(matDate.getTime())) return 0;

  const diffMs = matDate.getTime() - fromDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Maturity Horizon color helper based on days remaining:
 * - 0 to 1 month (<= 30 days): Red
 * - More than 1 month up to 3 months (31 to 90 days): Yellow
 * - More than 3 months up to 6 months (91 to 180 days): Green
 *
 * Designed to read well in both light and dark mode.
 */
export function maturityColor(daysRemaining) {
  if (daysRemaining <= 30) {
    return {
      tier: '0-1mo',
      label: '1 mo',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-rose-500 dark:bg-rose-400',
      textClass: 'text-rose-700 dark:text-rose-300',
      barClass: 'bg-rose-500',
    };
  }
  if (daysRemaining <= 90) {
    return {
      tier: '2-3mo',
      label: '2-3 mo',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotClass: 'bg-amber-500 dark:bg-amber-400',
      textClass: 'text-amber-700 dark:text-amber-300',
      barClass: 'bg-amber-500',
    };
  }
  return {
    tier: '4-6mo',
    label: '4-6 mo',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    barClass: 'bg-emerald-500',
  };
}
