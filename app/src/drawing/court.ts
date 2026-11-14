import type { Diagram, Point } from '../types/model';

/**
 * FIBA court geometry in metres (SPEC.md sections 3 and 5).
 * Origin is the centre of the full court; x runs along the length, y across.
 * The half court is the right half (x 0–14), so objects keep their place
 * when switching between half and full court.
 */
export const COURT = {
  length: 28,
  width: 15,
  halfLength: 14,
  halfWidth: 7.5,
  /** Basket centre, from the baseline. */
  basketFromBaseline: 1.575,
  rimRadius: 0.225,
  /** Backboard face, from the baseline. */
  backboardFromBaseline: 1.2,
  backboardWidth: 1.8,
  threePointRadius: 6.75,
  /** Straight part of the three-point line, from the sideline. */
  threePointSideDistance: 0.9,
  /** Restricted area (paint). */
  laneWidth: 4.9,
  laneLength: 5.8,
  freeThrowCircleRadius: 1.8,
  centreCircleRadius: 1.8,
  noChargeRadius: 1.25,
  /** No-charge lines run this far towards the baseline from the basket centre. */
  noChargeLineLength: 0.375,
  lineWidth: 0.05,
} as const;

/** Margin around the court in the view, in metres. */
export const COURT_MARGIN = 0.6;

export interface Bounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export function courtBounds(court: Diagram['court']): Bounds {
  const minX = court === 'full' ? -COURT.halfLength : 0;
  return { minX, minY: -COURT.halfWidth, width: court === 'full' ? COURT.length : COURT.halfLength, height: COURT.width };
}

export function viewBounds(court: Diagram['court']): Bounds {
  const b = courtBounds(court);
  return { minX: b.minX - COURT_MARGIN, minY: b.minY - COURT_MARGIN, width: b.width + 2 * COURT_MARGIN, height: b.height + 2 * COURT_MARGIN };
}

export function viewBoxString(b: Bounds): string {
  return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
}

/** Basket centre on the right (side = 1) or left (side = -1). */
export function basketCentre(side: 1 | -1 = 1): Point {
  return { x: side * (COURT.halfLength - COURT.basketFromBaseline), y: 0 };
}

/** Points on a circular arc, angles in radians. */
export function arcPoints(centre: Point, radius: number, from: number, to: number, segments = 32): Point[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / segments;
    return { x: round(centre.x + radius * Math.cos(a)), y: round(centre.y + radius * Math.sin(a)) };
  });
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Where the straight three-point lines meet the arc (right side). */
export function threePointCorner(): Point {
  const yLine = COURT.halfWidth - COURT.threePointSideDistance;
  const b = basketCentre(1);
  const dx = Math.sqrt(COURT.threePointRadius ** 2 - yLine ** 2);
  return { x: round(b.x - dx), y: yLine };
}

export interface CourtShapes {
  /** Polylines/polygons as point lists. */
  outline: Point[];
  paint: Point[];
  threePoint: Point[];
  freeThrowSolid: Point[];
  freeThrowDashed: Point[];
  noCharge: Point[];
  backboard: [Point, Point];
  rim: { centre: Point; radius: number };
}

/** All lines of one half, built for the right side and mirrored for the left. */
export function halfCourtShapes(side: 1 | -1 = 1): CourtShapes {
  const m = (p: Point): Point => ({ x: round(side * p.x), y: p.y });
  const L = COURT.halfLength;
  const W = COURT.halfWidth;
  const basket = basketCentre(1);
  const corner = threePointCorner();
  const cornerAngle = Math.atan2(corner.y, corner.x - basket.x); // ≈ 102°
  const ftX = L - COURT.laneLength;
  const lane = COURT.laneWidth / 2;
  const backboardX = L - COURT.backboardFromBaseline;

  return {
    outline: [{ x: 0, y: -W }, { x: L, y: -W }, { x: L, y: W }, { x: 0, y: W }].map(m),
    paint: [{ x: L, y: -lane }, { x: ftX, y: -lane }, { x: ftX, y: lane }, { x: L, y: lane }].map(m),
    threePoint: [
      { x: L, y: -corner.y },
      ...arcPoints(basket, COURT.threePointRadius, -cornerAngle, -(2 * Math.PI - cornerAngle), 48),
      { x: L, y: corner.y },
    ].map(m),
    freeThrowSolid: arcPoints({ x: ftX, y: 0 }, COURT.freeThrowCircleRadius, Math.PI / 2, (3 * Math.PI) / 2, 24).map(m),
    freeThrowDashed: arcPoints({ x: ftX, y: 0 }, COURT.freeThrowCircleRadius, -Math.PI / 2, Math.PI / 2, 24).map(m),
    noCharge: [
      { x: backboardX, y: -COURT.noChargeRadius },
      { x: basket.x, y: -COURT.noChargeRadius },
      ...arcPoints(basket, COURT.noChargeRadius, -Math.PI / 2, -(3 * Math.PI) / 2, 24),
      { x: backboardX, y: COURT.noChargeRadius },
    ].map(m),
    backboard: [m({ x: backboardX, y: -COURT.backboardWidth / 2 }), m({ x: backboardX, y: COURT.backboardWidth / 2 })],
    rim: { centre: m(basket), radius: COURT.rimRadius },
  };
}
