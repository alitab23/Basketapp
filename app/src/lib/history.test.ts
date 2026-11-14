import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, HISTORY_LIMIT, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
  });

  it('clears redo after a new edit', () => {
    let h = commit(createHistory(1), 2);
    h = undo(h);
    h = commit(h, 5);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(5);
  });

  it('merges quick edits with the same key into one undo step', () => {
    let h = createHistory('');
    h = commit(h, 'H', 'title', 1000);
    h = commit(h, 'He', 'title', 1300);
    h = commit(h, 'Hej', 'title', 1600);
    expect(undo(h).present).toBe('');
  });

  it('does not merge edits with different keys or after a pause', () => {
    let h = createHistory('');
    h = commit(h, 'a', 'title', 1000);
    h = commit(h, 'ab', 'title', 3000);
    h = commit(h, 'abc', 'location', 3100);
    expect(undo(h).present).toBe('ab');
    expect(undo(undo(h)).present).toBe('a');
  });

  it('ignores a commit of the same value', () => {
    const h = createHistory({ a: 1 });
    expect(commit(h, h.present)).toBe(h);
  });

  it('keeps at most HISTORY_LIMIT steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
