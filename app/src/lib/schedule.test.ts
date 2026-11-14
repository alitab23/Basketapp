import { describe, expect, it } from 'vitest';
import { calculateSchedule, formatClock, minutesByBlockType, parseClock } from './schedule';
import { newBlock } from './blockOps';

const blocks = (...durations: number[]) => durations.map((d, i) => newBlock({ title: `B${i}`, duration: d }));
const section = (title: string) => newBlock({ title, kind: 'section' });

describe('calculateSchedule – acceptance criterion (SPEC.md section 10)', () => {
  const s = calculateSchedule('18:00', blocks(10, 15, 5, 30, 20));

  it('gives the start times 18:00, 18:10, 18:25, 18:30, 19:00', () => {
    expect(s.rows.map((r) => r.startLabel)).toEqual(['18:00', '18:10', '18:25', '18:30', '19:00']);
  });

  it('gives the end times', () => {
    expect(s.rows.map((r) => r.endLabel)).toEqual(['18:10', '18:25', '18:30', '19:00', '19:20']);
  });

  it('has a total of 80 minutes and ends at 19:20', () => {
    expect(s.total).toBe(80);
    expect(s.startLabel).toBe('18:00');
    expect(s.endLabel).toBe('19:20');
  });
});

describe('calculateSchedule – rules', () => {
  it('counts section rows as 0 and sums each section', () => {
    const items = [section('Uppvärmning'), ...blocks(10, 5), section('Huvuddel'), ...blocks(30)];
    const s = calculateSchedule('09:00', items);
    expect(s.total).toBe(45);
    expect(s.rows.map((r) => r.startLabel)).toEqual(['09:00', '09:00', '09:10', '09:15', '09:15']);
    expect(s.rows[0]!.sectionMinutes).toBe(15);
    expect(s.rows[3]!.sectionMinutes).toBe(30);
    expect(s.rows[1]!.sectionMinutes).toBeUndefined();
  });

  it('ignores a duration on a section row', () => {
    const items = [{ ...section('X'), duration: 50 }, ...blocks(10)];
    expect(calculateSchedule('18:00', items).total).toBe(10);
  });

  it('handles an empty session', () => {
    const s = calculateSchedule('18:00', []);
    expect(s).toMatchObject({ total: 0, startLabel: '18:00', endLabel: '18:00', rows: [] });
  });

  it('wraps past midnight and marks the next day', () => {
    const s = calculateSchedule('23:30', blocks(20, 30));
    expect(s.rows.map((r) => [r.startLabel, r.dayOffset])).toEqual([
      ['23:30', 0],
      ['23:50', 0],
    ]);
    expect(s.endLabel).toBe('00:20');
    expect(s.endDayOffset).toBe(1);
  });

  it('recalculates when blocks change order', () => {
    const items = blocks(10, 30);
    const reordered = [items[1]!, items[0]!];
    expect(calculateSchedule('18:00', reordered).rows.map((r) => r.startLabel)).toEqual(['18:00', '18:30']);
  });

  it('treats an invalid start time as 00:00', () => {
    expect(calculateSchedule('abc', blocks(5)).startLabel).toBe('00:00');
  });
});

describe('parseClock / formatClock', () => {
  it.each([
    ['18:00', 1080],
    ['9:05', 545],
    ['00:00', 0],
    ['23:59', 1439],
  ])('%s → %i', (text, minutes) => {
    expect(parseClock(text)).toBe(minutes);
    expect(formatClock(minutes)).toBe(text.padStart(5, '0'));
  });

  it.each(['24:00', '12:60', '', '1800'])('rejects %j', (text) => {
    expect(parseClock(text)).toBeNull();
  });
});

describe('minutesByBlockType', () => {
  it('sums minutes per block type and skips sections and zero-length blocks', () => {
    const items = [
      newBlock({ title: 'a', duration: 10, blockTypeId: 'bt-warmup' }),
      section('S'),
      newBlock({ title: 'b', duration: 20, blockTypeId: 'bt-shooting' }),
      newBlock({ title: 'c', duration: 5, blockTypeId: 'bt-warmup' }),
      newBlock({ title: 'd', duration: 0, blockTypeId: 'bt-break' }),
      newBlock({ title: 'e', duration: 7 }),
    ];
    expect(minutesByBlockType(items)).toEqual([
      { blockTypeId: 'bt-warmup', minutes: 15 },
      { blockTypeId: 'bt-shooting', minutes: 20 },
      { blockTypeId: null, minutes: 7 },
    ]);
  });
});
