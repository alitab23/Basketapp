import { describe, expect, it } from 'vitest';
import { allTags, filterEntries, searchText, type LibraryEntry } from './search';

const entry = (i: number, extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  kind: 'drill',
  id: `d${i}`,
  title: `Övning ${i}`,
  blocks: 1,
  minutes: 10,
  updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
  tags: i % 2 ? ['skott'] : ['försvar'],
  blockTypeIds: [i % 3 ? 'bt-shooting' : 'bt-defense'],
  text: searchText(`Övning ${i}`, i % 5 === 0 ? 'Closeout mot skytt' : 'Lay-ups', i % 2 ? 'skott' : 'försvar'),
  ...extra,
});

describe('filterEntries', () => {
  const entries = Array.from({ length: 1000 }, (_, i) => entry(i));

  it('searches title and text with all words', () => {
    const r = filterEntries(entries, { query: 'closeout SKYTT' });
    expect(r).toHaveLength(200);
    expect(filterEntries(entries, { query: 'övning 999' }).map((e) => e.id)).toEqual(['d999']);
  });

  it('filters on tag, block type and season', () => {
    expect(filterEntries(entries, { tag: 'skott' })).toHaveLength(500);
    expect(filterEntries(entries, { blockTypeId: 'bt-defense' })).toHaveLength(334);
    const withSeason = [entry(1, { seasonId: 's1' }), entry(2, { seasonId: null })];
    expect(filterEntries(withSeason, { seasonId: 's1' }).map((e) => e.id)).toEqual(['d1']);
    expect(filterEntries(withSeason, { seasonId: 'none' }).map((e) => e.id)).toEqual(['d2']);
  });

  it('hides archived items unless asked', () => {
    const list = [entry(1, { archived: true }), entry(2)];
    expect(filterEntries(list, {})).toHaveLength(1);
    expect(filterEntries(list, { showArchived: true })).toHaveLength(2);
  });

  it('sorts by last changed or by name (numbers in natural order)', () => {
    expect(filterEntries(entries, {}).slice(0, 2).map((e) => e.id)).toEqual(['d999', 'd998']);
    expect(filterEntries(entries.slice(0, 12), { sort: 'name' }).slice(0, 3).map((e) => e.title)).toEqual(['Övning 0', 'Övning 1', 'Övning 2']);
  });

  it('answers within 100 ms for 1 000 entries (SPEC.md section 8)', () => {
    const start = performance.now();
    for (const q of ['c', 'cl', 'clo', 'close', 'closeout', 'closeout s']) filterEntries(entries, { query: q, sort: 'name' });
    expect((performance.now() - start) / 6).toBeLessThan(100);
  });

  it('lists tags', () => {
    expect(allTags(entries)).toEqual(['försvar', 'skott']);
  });
});
