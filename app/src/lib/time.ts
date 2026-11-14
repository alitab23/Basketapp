import type { Block } from '../types/model';

/** Total minutes of a session. Section rows count as 0 (SPEC.md section 4). */
export function totalMinutes(items: readonly Block[]): number {
  return items.reduce((sum, b) => (b.kind === 'section' ? sum : sum + b.duration), 0);
}

/** Number of real blocks (section rows excluded). */
export function blockCount(items: readonly Block[]): number {
  return items.filter((b) => b.kind !== 'section').length;
}

/** Splits minutes into hours and minutes for display, e.g. 80 → { hours: 1, minutes: 20 }. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "för 3 dagar sedan" / "3 days ago". Anything under a minute is "nu" / "now". */
export function formatRelative(thenIso: string, now: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffSec = (new Date(thenIso).getTime() - now.getTime()) / 1000;
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
  }
  return rtf.format(0, 'second');
}
