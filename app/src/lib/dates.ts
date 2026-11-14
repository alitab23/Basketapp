/** Local calendar dates as "YYYY-MM-DD" strings (no time zone surprises). */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export interface Month {
  year: number;
  /** 0–11 */
  month: number;
}

export function monthOf(iso: string): Month {
  const d = fromISODate(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** 6 weeks × 7 days, starting on Monday, covering the month. */
export function monthGrid({ year, month }: Month): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** Monday-first short weekday names in the given language. */
export function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i))); // 2024-01-01 is a Monday
}

export function formatMonth({ year, month }: Month, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(fromISODate(iso));
}

export function isWithin(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}
