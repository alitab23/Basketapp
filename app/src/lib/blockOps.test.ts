import { describe, expect, it } from 'vitest';
import {
  changeDuration,
  clampDuration,
  duplicateBlock,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
  updateBlock,
} from './blockOps';

const list = () => ['A', 'B', 'C'].map((title) => newBlock({ title, duration: 10 }));
const titles = (items: { title: string }[]) => items.map((b) => b.title);

describe('clampDuration', () => {
  it.each([
    [-5, 0],
    [0, 0],
    [12.4, 12],
    [240, 240],
    [300, 240],
    [Number.NaN, 0],
  ])('%d → %d', (input, expected) => expect(clampDuration(input)).toBe(expected));
});

describe('newBlock', () => {
  it('gives a section row 0 minutes', () => {
    expect(newBlock({ title: 'Uppvärmning', kind: 'section', duration: 30 }).duration).toBe(0);
  });
});

describe('insertBlock', () => {
  it('adds at the end by default', () => {
    expect(titles(insertBlock(list(), newBlock({ title: 'D' })))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('adds right after a given block', () => {
    const items = list();
    expect(titles(insertBlock(items, newBlock({ title: 'D' }), items[0]!.id))).toEqual(['A', 'D', 'B', 'C']);
  });
});

describe('moveBlock', () => {
  it('moves a block down', () => {
    const items = list();
    expect(titles(moveBlock(items, items[0]!.id, items[2]!.id))).toEqual(['B', 'C', 'A']);
  });

  it('moves a block up', () => {
    const items = list();
    expect(titles(moveBlock(items, items[2]!.id, items[0]!.id))).toEqual(['C', 'A', 'B']);
  });

  it('does nothing for unknown ids', () => {
    const items = list();
    expect(moveBlock(items, 'x', items[0]!.id)).toBe(items);
  });
});

describe('duplicateBlock', () => {
  it('places a deep copy with new ids right after the original', () => {
    const items = list();
    items[0]!.diagrams = [{ id: 'd1', court: 'half', elements: [] }];
    const next = duplicateBlock(items, items[0]!.id);
    expect(titles(next)).toEqual(['A', 'A', 'B', 'C']);
    expect(next[1]!.id).not.toBe(next[0]!.id);
    expect(next[1]!.diagrams[0]!.id).not.toBe('d1');
    next[1]!.title = 'changed';
    expect(items[0]!.title).toBe('A');
  });
});

describe('removeBlock / updateBlock / changeDuration', () => {
  it('removes a block', () => {
    const items = list();
    expect(titles(removeBlock(items, items[1]!.id))).toEqual(['A', 'C']);
  });

  it('updates fields and clamps the duration', () => {
    const items = list();
    const next = updateBlock(items, items[0]!.id, { title: 'Ny', duration: 999 });
    expect(next[0]).toMatchObject({ title: 'Ny', duration: 240 });
  });

  it('changes the duration by ±5 without going below 0', () => {
    const items = list();
    expect(changeDuration(items, items[0]!.id, 5)[0]!.duration).toBe(15);
    expect(changeDuration(items, items[0]!.id, -15)[0]!.duration).toBe(0);
  });

  it('does not change the duration of a section row', () => {
    const items = [newBlock({ title: 'S', kind: 'section' })];
    expect(changeDuration(items, items[0]!.id, 5)[0]!.duration).toBe(0);
  });
});
