import { describe, expect, it } from 'vitest';
import type { CourtElement } from '../types/model';
import { createLine, createPoint, type LineElement, type PointElement } from './elements';
import { angleTo, commitDrag, extendFreehand, nearestSegment, PREVIEW_ID, previewElements } from './interaction';

const o1 = createPoint([], 'offense', { x: 8, y: 0 });
const pass = createLine('pass', [{ x: 8, y: 0 }, { x: 12, y: 2 }], o1.id);
const els: CourtElement[] = [o1, pass];
const opts = { numbering: false, selection: [] as string[] };

describe('previewElements', () => {
  it('shows a moved player with its attached arrow, without touching other objects', () => {
    const shown = previewElements(els, { kind: 'move', ids: new Set([o1.id]), delta: { x: 1, y: 1 } });
    expect((shown[0] as PointElement).x).toBe(9);
    expect((shown[1] as LineElement).points[0]).toEqual({ x: 9, y: 1 });
    expect(previewElements(els, null)).toBe(els);
  });

  it('shows a line being drawn as a temporary element', () => {
    const shown = previewElements(els, { kind: 'line', type: 'cut', start: { x: 0, y: 0 }, end: { x: 2, y: 0 } });
    expect(shown.at(-1)).toMatchObject({ id: PREVIEW_ID, type: 'cut' });
  });

  it('bends a straight line into a curve', () => {
    const shown = previewElements(els, { kind: 'bend', id: pass.id, index: 0, pos: { x: 10, y: -2 } });
    expect(shown[1]).toMatchObject({ curved: true, points: [{ x: 8, y: 0 }, { x: 10, y: -2 }, { x: 12, y: 2 }] });
  });
});

describe('commitDrag', () => {
  it('creates a line, selects it and numbers it when numbering is on', () => {
    const r = commitDrag(els, { kind: 'line', type: 'dribble', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } }, { ...opts, numbering: true });
    const line = r.elements!.at(-1) as LineElement;
    expect(line).toMatchObject({ type: 'dribble', order: 1 });
    expect(r.select).toEqual([line.id]);
    expect(r.created).toBe(true);
  });

  it('ignores a line that is just a click', () => {
    expect(commitDrag(els, { kind: 'line', type: 'pass', start: { x: 0, y: 0 }, end: { x: 0.1, y: 0 } }, opts).elements).toBeNull();
  });

  it('ignores a move of zero', () => {
    expect(commitDrag(els, { kind: 'move', ids: new Set([o1.id]), delta: { x: 0, y: 0 } }, opts).elements).toBeNull();
  });

  it('selects with a box, adding to the selection with Shift', () => {
    const box = { kind: 'marquee' as const, start: { x: 7, y: -1 }, current: { x: 7.8, y: 1 }, additive: false };
    expect(commitDrag(els, box, opts).select).toEqual([o1.id]);
    expect(commitDrag(els, { ...box, additive: true }, { ...opts, selection: ['z'] }).select).toEqual(['z', o1.id]);
  });

  it('creates a zone from a dragged rectangle in any direction', () => {
    const r = commitDrag([], { kind: 'zone', shape: 'ellipse', start: { x: 3, y: 2 }, end: { x: 1, y: -1 } }, opts);
    expect(r.elements![0]).toMatchObject({ type: 'zone', shape: 'ellipse', x: 1, y: -1, w: 2, h: 3 });
  });
});

describe('helpers', () => {
  it('finds the nearest segment', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }];
    expect(nearestSegment(pts, { x: 2, y: 0.2 })).toBe(0);
    expect(nearestSegment(pts, { x: 4.2, y: 3 })).toBe(1);
  });

  it('measures angles clockwise from up', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(0);
    expect(angleTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
    expect(angleTo({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(270);
  });

  it('skips freehand points that are too close', () => {
    expect(extendFreehand([{ x: 0, y: 0 }], { x: 0.01, y: 0 })).toHaveLength(1);
    expect(extendFreehand([{ x: 0, y: 0 }], { x: 0.5, y: 0 })).toHaveLength(2);
  });
});
