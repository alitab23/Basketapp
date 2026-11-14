import { describe, expect, it } from 'vitest';
import type { CourtElement } from '../types/model';
import {
  attachBall,
  cloneElements,
  copyDiagram,
  createLine,
  createPoint,
  finishMove,
  idsInRect,
  insertLinePoint,
  moveElements,
  moveLinePoint,
  nextLabel,
  nextOrder,
  numberLines,
  rectFrom,
  removeElements,
  removeLinePoint,
  snap,
  type LineElement,
  type PointElement,
} from './elements';

const find = <T extends CourtElement>(els: CourtElement[], id: string) => els.find((e) => e.id === id) as T;

function setup() {
  const o1 = createPoint([], 'offense', { x: 8, y: 0 });
  const x1 = createPoint([o1], 'defense', { x: 9, y: 0 });
  const cut = createLine('cut', [{ x: 8, y: 0 }, { x: 11, y: 2 }], o1.id);
  return { o1, x1, cut, els: [o1, x1, cut] as CourtElement[] };
}

describe('numbering', () => {
  it('gives O and X the next free number', () => {
    const o1 = createPoint([], 'offense', { x: 0, y: 0 });
    const o2 = createPoint([o1], 'offense', { x: 0, y: 0 });
    expect([o1.label, o2.label]).toEqual(['1', '2']);
    expect(nextLabel([o2], 'offense')).toBe('1');
    expect(createPoint([o1, o2], 'defense', { x: 0, y: 0 }).label).toBe('1');
    expect(createPoint([], 'coach', { x: 0, y: 0 }).label).toBe('C');
  });

  it('numbers arrows in drawing order and can remove the numbers', () => {
    const { els } = setup();
    const withPass = [...els, createLine('pass', [{ x: 0, y: 0 }, { x: 1, y: 1 }])];
    const numbered = numberLines(withPass, true);
    expect(numbered.filter((e) => 'order' in e && e.order).map((e) => (e as LineElement).order)).toEqual([1, 2]);
    expect(nextOrder(numbered)).toBe(3);
    expect(numberLines(numbered, false).some((e) => 'order' in e && e.order)).toBe(false);
  });
});

describe('moving (acceptance: an arrow from O1 follows O1)', () => {
  it('moves the start of an attached arrow with its player', () => {
    const { o1, cut, els } = setup();
    const moved = moveElements(els, new Set([o1.id]), { x: 1, y: -2 });
    expect(find<PointElement>(moved, o1.id)).toMatchObject({ x: 9, y: -2 });
    expect(find<LineElement>(moved, cut.id).points).toEqual([{ x: 9, y: -2 }, { x: 11, y: 2 }]);
  });

  it('moves the whole arrow when both are selected', () => {
    const { o1, cut, els } = setup();
    const moved = moveElements(els, new Set([o1.id, cut.id]), { x: 1, y: 0 });
    expect(find<LineElement>(moved, cut.id).points).toEqual([{ x: 9, y: 0 }, { x: 12, y: 2 }]);
  });

  it('lets an arrow moved on its own go of its player', () => {
    const { cut, els } = setup();
    const moved = finishMove(moveElements(els, new Set([cut.id]), { x: 0, y: 3 }), new Set([cut.id]));
    expect(find<LineElement>(moved, cut.id).fromElementId).toBeUndefined();
  });

  it('does nothing for a zero move', () => {
    const { els } = setup();
    expect(moveElements(els, new Set(['x']), { x: 0, y: 0 })).toBe(els);
  });
});

describe('ball', () => {
  it('attaches to a player it is dropped on, and follows it', () => {
    const { o1, els } = setup();
    const ball = createPoint(els, 'ball', { x: 8.2, y: 0.1 });
    let all = attachBall([...els, ball], ball.id);
    expect(find<PointElement>(all, ball.id)).toMatchObject({ attachedTo: o1.id, x: 8.42, y: -0.42 });
    all = moveElements(all, new Set([o1.id]), { x: 2, y: 0 });
    expect(find<PointElement>(all, ball.id).x).toBeCloseTo(10.42);
  });

  it('lets go when moved away from the player', () => {
    const { o1, els } = setup();
    const ball = { ...createPoint(els, 'ball', { x: 8.42, y: -0.42 }), attachedTo: o1.id };
    const all = finishMove(moveElements([...els, ball], new Set([ball.id]), { x: -5, y: 3 }), new Set([ball.id]));
    expect(find<PointElement>(all, ball.id).attachedTo).toBeUndefined();
  });
});

describe('line points', () => {
  it('attaches the start to a player it is dragged onto', () => {
    const { x1, els } = setup();
    const line = createLine('pass', [{ x: 0, y: 0 }, { x: 3, y: 3 }]);
    const out = moveLinePoint([...els, line], line.id, 0, { x: 9.2, y: 0.2 });
    expect(find<LineElement>(out, line.id)).toMatchObject({ fromElementId: x1.id, points: [{ x: 9, y: 0 }, { x: 3, y: 3 }] });
  });

  it('adds a control point to bend a line, and removes it again', () => {
    const { cut, els } = setup();
    const bent = insertLinePoint(els, cut.id, 0, { x: 9, y: 3 }, true);
    expect(find<LineElement>(bent, cut.id)).toMatchObject({ curved: true, points: [{ x: 8, y: 0 }, { x: 9, y: 3 }, { x: 11, y: 2 }] });
    const back = removeLinePoint(bent, cut.id, 1);
    expect(find<LineElement>(back, cut.id)).toMatchObject({ curved: false, points: [{ x: 8, y: 0 }, { x: 11, y: 2 }] });
    expect(removeLinePoint(back, cut.id, 0)).toEqual(back);
  });
});

describe('delete, select, copy', () => {
  it('detaches arrows and balls when their player is deleted', () => {
    const { o1, cut, els } = setup();
    const out = removeElements(els, new Set([o1.id]));
    expect(out).toHaveLength(2);
    expect(find<LineElement>(out, cut.id).fromElementId).toBeUndefined();
  });

  it('selects elements touched by a box', () => {
    const { o1, x1, cut, els } = setup();
    expect(idsInRect(els, rectFrom({ x: 7, y: -1 }, { x: 8.2, y: 1 }))).toEqual([o1.id, cut.id]);
    expect(idsInRect(els, rectFrom({ x: 9.3, y: 0.3 }, { x: 9.2, y: -0.2 }))).toEqual([x1.id, cut.id]);
  });

  it('pastes copies with new ids and keeps links inside the copied group', () => {
    const { o1, cut, els } = setup();
    const copies = cloneElements([o1, cut], { x: 1, y: 1 });
    const [c1, cCut] = copies as [PointElement, LineElement];
    expect(c1.id).not.toBe(o1.id);
    expect(c1).toMatchObject({ x: 9, y: 1, label: '1' });
    expect(cCut.fromElementId).toBe(c1.id);
    expect(cloneElements([cut]).map((e) => (e as LineElement).fromElementId)).toEqual([undefined]);
    expect(els).toHaveLength(3);
  });

  it('copies a diagram to the next step', () => {
    const { o1, els } = setup();
    const next = copyDiagram({ id: 'd1', court: 'full', elements: els });
    expect(next.id).not.toBe('d1');
    expect(next.court).toBe('full');
    expect(next.elements).toHaveLength(3);
    expect(next.elements.map((e) => e.id)).not.toContain(o1.id);
    expect((next.elements[2] as LineElement).fromElementId).toBe(next.elements[0]!.id);
  });

  it('snaps to the grid when on', () => {
    expect(snap({ x: 1.26, y: -0.24 }, 0.5)).toEqual({ x: 1.5, y: -0 });
    expect(snap({ x: 1.26, y: -0.24 }, null)).toEqual({ x: 1.26, y: -0.24 });
  });
});
