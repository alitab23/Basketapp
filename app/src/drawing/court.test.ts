import { describe, expect, it } from 'vitest';
import { basketCentre, COURT, courtBounds, halfCourtShapes, threePointCorner, viewBounds } from './court';
import { dist } from './paths';

describe('FIBA court geometry', () => {
  it('has the full court 28 × 15 m with origin in the middle', () => {
    expect(courtBounds('full')).toEqual({ minX: -14, minY: -7.5, width: 28, height: 15 });
  });

  it('uses the right half (x 0–14) for the half court', () => {
    expect(courtBounds('half')).toEqual({ minX: 0, minY: -7.5, width: 14, height: 15 });
    expect(viewBounds('half').width).toBeCloseTo(15.2);
  });

  it('places the basket 1.575 m from the baseline', () => {
    expect(basketCentre(1)).toEqual({ x: 12.425, y: 0 });
    expect(basketCentre(-1)).toEqual({ x: -12.425, y: 0 });
  });

  const shapes = halfCourtShapes(1);

  it('draws the three-point arc 6.75 m from the basket', () => {
    const arc = shapes.threePoint.slice(1, -1);
    for (const p of arc) expect(dist(p, basketCentre(1))).toBeCloseTo(6.75, 3);
    // Furthest point straight out from the basket.
    expect(Math.min(...arc.map((p) => p.x))).toBeCloseTo(12.425 - 6.75, 3);
  });

  it('has straight three-point lines 0.9 m from the sideline', () => {
    const corner = threePointCorner();
    expect(corner.y).toBeCloseTo(6.6);
    expect(shapes.threePoint[0]).toEqual({ x: 14, y: -6.6 });
    expect(shapes.threePoint.at(-1)).toEqual({ x: 14, y: 6.6 });
    expect(dist(corner, basketCentre(1))).toBeCloseTo(6.75, 3);
  });

  it('has a 4.9 × 5.8 m restricted area', () => {
    const xs = shapes.paint.map((p) => p.x);
    const ys = shapes.paint.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(COURT.laneWidth);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(COURT.laneLength);
  });

  it('has a 1.25 m no-charge semicircle around the basket', () => {
    const arc = shapes.noCharge.slice(2, -1);
    for (const p of arc) expect(dist(p, basketCentre(1))).toBeCloseTo(1.25, 3);
  });

  it('mirrors the left half', () => {
    const left = halfCourtShapes(-1);
    expect(left.rim.centre).toEqual({ x: -12.425, y: 0 });
    expect(left.threePoint[0]).toEqual({ x: -14, y: -6.6 });
  });
});
