/**
 * Undo/redo history as an immutable value. Edits with the same `coalesceKey`
 * in quick succession (e.g. typing in one field) become one undo step.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(h: History<T>, next: T, coalesceKey: string | null = null, now = Date.now()): History<T> {
  if (Object.is(next, h.present)) return h;
  const coalesce = coalesceKey !== null && coalesceKey === h.lastKey && now - h.lastAt < COALESCE_MS;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: coalesceKey, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1);
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
