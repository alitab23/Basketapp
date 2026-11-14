import { describe, expect, it } from 'vitest';
import { pixelsPerMetre, screenToCourt, visibleBounds, zoomAt } from './coords';

const full = { minX: 0, minY: -8, width: 16, height: 16 };

describe('screenToCourt', () => {
  it('maps pixels to metres with letterboxing (xMidYMid meet)', () => {
    // 800 × 400 px box showing a 16 × 16 m view → 25 px/m, centred horizontally.
    const rect = { left: 100, top: 50, width: 800, height: 400 };
    expect(pixelsPerMetre(rect, full)).toBe(25);
    expect(screenToCourt({ x: 300, y: 50 }, rect, full)).toEqual({ x: 0, y: -8 });
    expect(screenToCourt({ x: 500, y: 250 }, rect, full)).toEqual({ x: 8, y: 0 });
  });
});

describe('zoom', () => {
  it('shows the whole court at zoom 1', () => {
    expect(visibleBounds(full, { zoom: 1, centre: { x: 3, y: 3 } })).toEqual(full);
  });

  it('keeps the view inside the court when zoomed', () => {
    // Centre x = 0 would show x −4…4; it is pushed right to start at the edge (0).
    expect(visibleBounds(full, { zoom: 2, centre: { x: 0, y: 0 } })).toEqual({ minX: 0, minY: -4, width: 8, height: 8 });
  });

  it('keeps the point under the mouse in place when zooming', () => {
    const vp = zoomAt(full, { zoom: 1, centre: { x: 8, y: 0 } }, 2, { x: 4, y: -4 });
    const v = visibleBounds(full, vp);
    // The anchor stays at the same relative position (25 % across, 25 % down).
    expect((4 - v.minX) / v.width).toBeCloseTo(0.25);
    expect((-4 - v.minY) / v.height).toBeCloseTo(0.25);
  });

  it('does not zoom out beyond the whole court', () => {
    expect(zoomAt(full, { zoom: 1, centre: { x: 8, y: 0 } }, 0.5, { x: 8, y: 0 }).zoom).toBe(1);
  });
});
