import type { Block } from '../types/model';
import { newId } from './id';

/** Allowed block length in minutes (SPEC.md section 3). */
export const MIN_DURATION = 0;
export const MAX_DURATION = 240;

export function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return MIN_DURATION;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(value)));
}

export function newBlock(init: Partial<Omit<Block, 'id'>> & Pick<Block, 'title'>): Block {
  const block: Block = {
    kind: 'block',
    duration: 10,
    instructions: '',
    diagrams: [],
    images: [],
    ...init,
    id: newId(),
  };
  block.duration = block.kind === 'section' ? 0 : clampDuration(block.duration);
  return block;
}

/** Inserts after `afterId`, or at the end when it is missing. */
export function insertBlock(items: readonly Block[], block: Block, afterId?: string): Block[] {
  const index = afterId ? items.findIndex((b) => b.id === afterId) : -1;
  if (index < 0) return [...items, block];
  return [...items.slice(0, index + 1), block, ...items.slice(index + 1)];
}

export function moveBlock(items: readonly Block[], fromId: string, toId: string): Block[] {
  const from = items.findIndex((b) => b.id === fromId);
  const to = items.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0 || from === to) return items as Block[];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** A deep copy with new ids, placed right after the original. */
export function duplicateBlock(items: readonly Block[], id: string): Block[] {
  const original = items.find((b) => b.id === id);
  if (!original) return items as Block[];
  const copy: Block = structuredClone(original);
  copy.id = newId();
  copy.diagrams = copy.diagrams.map((d) => ({ ...d, id: newId() }));
  copy.images = copy.images.map((i) => ({ ...i, id: newId() }));
  return insertBlock(items, copy, id);
}

export function removeBlock(items: readonly Block[], id: string): Block[] {
  return items.filter((b) => b.id !== id);
}

export function updateBlock(items: readonly Block[], id: string, patch: Partial<Omit<Block, 'id'>>): Block[] {
  return items.map((b) => {
    if (b.id !== id) return b;
    const next = { ...b, ...patch };
    if (patch.duration !== undefined) next.duration = next.kind === 'section' ? 0 : clampDuration(patch.duration);
    return next;
  });
}

export function changeDuration(items: readonly Block[], id: string, delta: number): Block[] {
  const block = items.find((b) => b.id === id);
  if (!block || block.kind === 'section') return items as Block[];
  return updateBlock(items, id, { duration: block.duration + delta });
}
