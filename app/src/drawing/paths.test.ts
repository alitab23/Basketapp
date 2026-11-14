import { describe, expect, it } from 'vitest';
import { basePath, dist, drawLine, endDirection, flatten, offsetPolyline, polylineLength, segments, trimEnd, zigzag } from './paths';

const straight = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
];

describe('base path', () => {
  it('is a straight line for two points', () => {
    expect(basePath(straight, false)).toBe('M 0 0 L 4 0');
    expect(basePath(straight, true)).toBe('M 0 0 L 4 0');
  });

  it('is a quadratic Bézier when a middle point is dragged out', () => {
    expect(basePath([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 0 }], true)).toBe('M 0 0 Q 2 2 4 0');
  });

  it('is a polyline with break points when not curved', () => {
    expect(basePath([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 0 }], false)).toBe('M 0 0 L 2 2 L 4 0');
  });

  it('chains smooth curves through many points', () => {
    const segs = segments([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }], true);
    expect(segs).toHaveLength(3);
    expect(segs.every((s) => s.control)).toBe(true);
    expect(segs.at(-1)!.to).toEqual({ x: 4, y: 0 });
  });

  it('flattens a curve that starts and ends at the right points', () => {
    const pts = flatten([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 0 }], true);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts.at(-1)).toEqual({ x: 4, y: 0 });
    expect(polylineLength(pts)).toBeGreaterThan(4);
  });
});

describe('helpers', () => {
  it('finds the end direction', () => {
    expect(endDirection(straight)).toEqual({ x: 1, y: 0 });
  });

  it('trims the end of a line', () => {
    const t = trimEnd(straight, 1);
    expect(t.at(-1)!.x).toBeCloseTo(3);
  });

  it('offsets a line sideways', () => {
    expect(offsetPolyline(straight, 0.5).map((p) => p.y)).toEqual([0.5, 0.5]);
  });

  it('zig-zags around the line and ends on it', () => {
    const z = zigzag(straight);
    expect(z.length).toBeGreaterThan(6);
    expect(z.at(-1)).toEqual({ x: 4, y: 0 });
    expect(Math.max(...z.map((p) => Math.abs(p.y)))).toBeCloseTo(0.14);
  });
});

describe('line types (SPEC.md section 5)', () => {
  it('pass is dashed with an arrowhead', () => {
    const d = drawLine('pass', straight, false);
    expect(d.dashed).toBe(true);
    expect(d.fills).toHaveLength(1);
  });

  it('cut is solid with an arrowhead', () => {
    const d = drawLine('cut', straight, false);
    expect(d.dashed).toBe(false);
    expect(d.fills).toHaveLength(1);
  });

  it('screen ends in a cross bar and has no arrowhead', () => {
    const d = drawLine('screen', straight, false);
    expect(d.fills).toHaveLength(0);
    expect(d.extras).toEqual(['M 4 0.35 L 4 -0.35']);
  });

  it('hand-off has a double tick', () => {
    expect(drawLine('handoff', straight, false).extras).toHaveLength(2);
  });

  it('shot has a double head', () => {
    expect(drawLine('shot', straight, false).fills).toHaveLength(2);
  });

  it('defensive slide is a double line', () => {
    expect(drawLine('slide', straight, false).strokes).toHaveLength(2);
  });

  it('dribble is a zig-zag', () => {
    const d = drawLine('dribble', straight, false);
    expect(d.strokes[0]!.split('L').length).toBeGreaterThan(6);
  });

  it('puts the order number next to the middle of the line', () => {
    const { labelAt } = drawLine('cut', straight, false);
    expect(labelAt.x).toBeCloseTo(2);
    expect(dist(labelAt, { x: 2, y: 0 })).toBeCloseTo(0.35);
  });
});
