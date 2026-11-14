import type { Point } from '../types/model';
import type { LineType } from './elements';

/** Sizes in metres (SPEC.md section 3). */
export const SIZE = {
  playerRadius: 0.45,
  labelFont: 0.5,
  lineWidth: 0.08,
  hitWidth: 0.45,
  arrowLength: 0.4,
  arrowWidth: 0.32,
  dribbleWave: 0.32,
  dribbleAmplitude: 0.14,
  screenBar: 0.7,
  handoffTick: 0.45,
  handoffGap: 0.14,
  slideOffset: 0.09,
  coachSize: 0.8,
  ballRadius: 0.17,
  coneSize: 0.5,
  orderRadius: 0.24,
  defaultText: 0.6,
} as const;

// ---------- vector helpers ----------

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
export const len = (a: Point): number => Math.hypot(a.x, a.y);
export const dist = (a: Point, b: Point): number => len(sub(a, b));
export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const norm = (a: Point): Point => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : scale(a, 1 / l);
};
/** Left-hand normal of a direction. */
export const perp = (a: Point): Point => ({ x: -a.y, y: a.x });
const r = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (p: Point) => `${r(p.x)} ${r(p.y)}`;

// ---------- base path ----------

function quad(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

/**
 * Segments of a line. Straight: a polyline through all points.
 * Curved: interior points are control points of quadratic Béziers
 * (2 points = straight, 3 points = one quadratic curve, more = a smooth chain).
 */
type Segment = { from: Point; to: Point; control?: Point };

export function segments(points: readonly Point[], curved: boolean): Segment[] {
  if (points.length < 2) return [];
  if (!curved || points.length === 2) {
    return points.slice(1).map((to, i) => ({ from: points[i]!, to }));
  }
  if (points.length === 3) return [{ from: points[0]!, control: points[1]!, to: points[2]! }];
  const out: Segment[] = [];
  let from = points[0]!;
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i]!;
    const to = i === points.length - 2 ? points[i + 1]! : mid(points[i]!, points[i + 1]!);
    out.push({ from, control, to });
    from = to;
  }
  return out;
}

/** SVG path data for the base line. */
export function basePath(points: readonly Point[], curved: boolean): string {
  const segs = segments(points, curved);
  if (segs.length === 0) return '';
  return segs.reduce(
    (d, s) => d + (s.control ? ` Q ${fmt(s.control)} ${fmt(s.to)}` : ` L ${fmt(s.to)}`),
    `M ${fmt(segs[0]!.from)}`,
  );
}

/** The line as a dense polyline, for zig-zags, offsets and arrowheads. */
export function flatten(points: readonly Point[], curved: boolean, steps = 16): Point[] {
  const segs = segments(points, curved);
  if (segs.length === 0) return [...points];
  const out: Point[] = [segs[0]!.from];
  for (const s of segs) {
    if (!s.control) out.push(s.to);
    else for (let i = 1; i <= steps; i++) out.push(quad(s.from, s.control, s.to, i / steps));
  }
  return out;
}

export function polylineLength(pts: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  return total;
}

/** Point and direction at a distance along a polyline. */
export function pointAt(pts: readonly Point[], distance: number): { point: Point; dir: Point } {
  let left = Math.max(0, distance);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = dist(a, b);
    if (l > 0 && (left <= l || i === pts.length - 1)) {
      const t = Math.min(1, left / l);
      return { point: add(a, scale(sub(b, a), t)), dir: norm(sub(b, a)) };
    }
    left -= l;
  }
  const last = pts.at(-1) ?? { x: 0, y: 0 };
  return { point: last, dir: { x: 1, y: 0 } };
}

/** Direction at the end of the line (for arrowheads and screen bars). */
export function endDirection(pts: readonly Point[]): Point {
  for (let i = pts.length - 1; i > 0; i--) {
    const d = sub(pts[i]!, pts[i - 1]!);
    if (len(d) > 1e-6) return norm(d);
  }
  return { x: 1, y: 0 };
}

/** Closed triangle arrowhead with its tip at `tip`. */
export function arrowhead(tip: Point, dir: Point, length: number = SIZE.arrowLength, width: number = SIZE.arrowWidth): string {
  const base = sub(tip, scale(dir, length));
  const n = scale(perp(dir), width / 2);
  return `M ${fmt(tip)} L ${fmt(add(base, n))} L ${fmt(sub(base, n))} Z`;
}

/** Shortens the end of a polyline so a line does not poke through its arrowhead. */
export function trimEnd(pts: readonly Point[], amount: number): Point[] {
  const total = polylineLength(pts);
  if (total <= amount) return [...pts];
  const out: Point[] = [pts[0]!];
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1]!, pts[i]!);
    if (walked + l >= total - amount) {
      out.push(pointAt(pts, total - amount).point);
      return out;
    }
    walked += l;
    out.push(pts[i]!);
  }
  return out;
}

export const polylinePath = (pts: readonly Point[]): string =>
  pts.length ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p)}`).join(' ') : '';

/** A zig-zag along the line, ending with a short straight part for the arrowhead. */
export function zigzag(pts: readonly Point[], wave: number = SIZE.dribbleWave, amplitude: number = SIZE.dribbleAmplitude): Point[] {
  const total = polylineLength(pts);
  const straight = Math.min(SIZE.arrowLength * 1.5, total / 3);
  const waveLength = total - straight;
  const halfWaves = Math.max(2, Math.round(waveLength / (wave / 2)));
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < halfWaves; i++) {
    const { point, dir } = pointAt(pts, (waveLength * i) / halfWaves);
    out.push(add(point, scale(perp(dir), i % 2 ? amplitude : -amplitude)));
  }
  out.push(pointAt(pts, waveLength).point);
  out.push(pts.at(-1)!);
  return out;
}

/** A polyline moved sideways by `offset` (positive = left of the direction). */
export function offsetPolyline(pts: readonly Point[], offset: number): Point[] {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    const n = perp(norm(sub(next, prev)));
    return add(p, scale(n, offset));
  });
}

/** Everything needed to draw one line element. */
export interface LineDrawing {
  /** Main stroke(s). */
  strokes: string[];
  dashed: boolean;
  /** Filled shapes (arrowheads). */
  fills: string[];
  /** Extra strokes (screen bar, hand-off ticks). */
  extras: string[];
  /** Where an order number is shown. */
  labelAt: Point;
}

export function drawLine(type: LineType, points: readonly Point[], curved: boolean): LineDrawing {
  const pts = flatten(points, curved);
  const total = polylineLength(pts);
  const end = pts.at(-1) ?? { x: 0, y: 0 };
  const dir = endDirection(pts);
  const labelAt = add(pointAt(pts, total / 2).point, scale(perp(pointAt(pts, total / 2).dir), 0.35));
  const head = SIZE.arrowLength * 0.8;
  const out: LineDrawing = { strokes: [], dashed: false, fills: [], extras: [], labelAt };

  switch (type) {
    case 'pass':
      out.dashed = true;
      out.strokes.push(polylinePath(trimEnd(pts, head)));
      out.fills.push(arrowhead(end, dir));
      break;
    case 'cut':
      out.strokes.push(polylinePath(trimEnd(pts, head)));
      out.fills.push(arrowhead(end, dir));
      break;
    case 'dribble':
      out.strokes.push(polylinePath(trimEnd(zigzag(pts), head)));
      out.fills.push(arrowhead(end, dir));
      break;
    case 'screen': {
      out.strokes.push(polylinePath(pts));
      const n = scale(perp(dir), SIZE.screenBar / 2);
      out.extras.push(`M ${fmt(add(end, n))} L ${fmt(sub(end, n))}`);
      break;
    }
    case 'handoff': {
      out.strokes.push(polylinePath(trimEnd(pts, head)));
      out.fills.push(arrowhead(end, dir));
      const { point, dir: d } = pointAt(pts, total / 2);
      const n = scale(perp(d), SIZE.handoffTick / 2);
      for (const s of [-1, 1]) {
        const c = add(point, scale(d, (s * SIZE.handoffGap) / 2));
        out.extras.push(`M ${fmt(add(c, n))} L ${fmt(sub(c, n))}`);
      }
      break;
    }
    case 'shot': {
      // Arrow with a double head.
      out.strokes.push(polylinePath(trimEnd(pts, head)));
      out.fills.push(arrowhead(end, dir));
      out.fills.push(arrowhead(sub(end, scale(dir, SIZE.arrowLength * 0.75)), dir));
      break;
    }
    case 'slide': {
      // Defensive slide: double line with an arrowhead.
      const body = trimEnd(pts, head);
      out.strokes.push(polylinePath(offsetPolyline(body, SIZE.slideOffset)));
      out.strokes.push(polylinePath(offsetPolyline(body, -SIZE.slideOffset)));
      out.fills.push(arrowhead(end, dir, SIZE.arrowLength, SIZE.arrowWidth * 1.3));
      break;
    }
  }
  return out;
}
