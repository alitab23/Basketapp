import { describe, expect, it } from 'vitest';
import { addDays, formatMonth, isWithin, monthGrid, monthOf, shiftMonth, toISODate, weekdayNames } from './dates';

describe('dates', () => {
  it('formats a local date', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('shifts months across years', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('builds a Monday-first 6-week grid', () => {
    const grid = monthGrid(monthOf('2026-11-14')); // 1 Nov 2026 is a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid[6]).toBe('2026-11-01');
    expect(grid).toContain('2026-11-30');
  });

  it('names weekdays from Monday', () => {
    expect(weekdayNames('en')[0]).toMatch(/^Mon/);
    expect(weekdayNames('sv')[0]).toMatch(/^mån/);
  });

  it('formats a month', () => {
    expect(formatMonth({ year: 2026, month: 10 }, 'sv')).toBe('november 2026');
  });

  it('checks a date range inclusively', () => {
    expect(isWithin('2026-08-01', '2026-08-01', '2027-04-30')).toBe(true);
    expect(isWithin('2027-05-01', '2026-08-01', '2027-04-30')).toBe(false);
  });
});
