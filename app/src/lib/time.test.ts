import { describe, expect, it } from 'vitest';
import { blockCount, formatRelative, splitMinutes, totalMinutes } from './time';
import type { Block } from '../types/model';

const block = (duration: number, kind: Block['kind'] = 'block'): Block => ({
  id: `${kind}-${duration}-${Math.random()}`,
  kind,
  title: '',
  duration,
  instructions: '',
  diagrams: [],
  images: [],
});

describe('totalMinutes', () => {
  it('sums the blocks from the acceptance criterion (10+15+5+30+20 = 80)', () => {
    expect(totalMinutes([10, 15, 5, 30, 20].map((d) => block(d)))).toBe(80);
  });

  it('counts section rows as 0', () => {
    expect(totalMinutes([block(30, 'section'), block(10), block(20)])).toBe(30);
  });

  it('is 0 for an empty session', () => {
    expect(totalMinutes([])).toBe(0);
  });
});

describe('blockCount', () => {
  it('does not count section rows', () => {
    expect(blockCount([block(0, 'section'), block(10), block(5)])).toBe(2);
  });
});

describe('splitMinutes', () => {
  it.each([
    [80, 1, 20],
    [90, 1, 30],
    [45, 0, 45],
    [120, 2, 0],
    [0, 0, 0],
  ])('%i min → %i h %i min', (total, hours, minutes) => {
    expect(splitMinutes(total)).toEqual({ hours, minutes });
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-14T12:00:00Z');

  it('writes "för 3 dagar sedan" in Swedish', () => {
    expect(formatRelative('2026-11-11T12:00:00Z', now, 'sv')).toBe('för 3 dagar sedan');
  });

  it('writes "3 days ago" in English', () => {
    expect(formatRelative('2026-11-11T12:00:00Z', now, 'en')).toBe('3 days ago');
  });

  it('writes "now" for something just saved', () => {
    expect(formatRelative('2026-11-14T11:59:50Z', now, 'en')).toBe('now');
  });
});
