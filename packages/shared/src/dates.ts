// Calendar-date helpers — backend BR4, goal AC1.2–1.4.
// Dates are plain `YYYY-MM-DD` strings with no time zone. "Today" is evaluated in AoE (UTC−12)
// so the rule is never stricter than any user's local date.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const AOE_OFFSET_MS = 12 * 60 * 60 * 1000;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's date in AoE (UTC−12). */
export function todayAoE(now: Date = new Date()): string {
  return fromUtcMs(now.getTime() - AOE_OFFSET_MS);
}

export function addDays(isoDate: string, days: number): string {
  return fromUtcMs(toUtcMs(isoDate) + days * MS_PER_DAY);
}

/** Number of days from `from` to `to`, counting both ends (same day = 1). */
export function dayCountInclusive(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY) + 1;
}

/** Calendar date of a day — `fromDate + (position − 1)` (backend §3.3). */
export function dateForPosition(fromDate: string, position: number): string {
  return addDays(fromDate, position - 1);
}

/** A trip is Completed when its last day is before today (AoE) — backend BR8. */
export function isCompleted(toDate: string, now: Date = new Date()): boolean {
  return toDate < todayAoE(now);
}
