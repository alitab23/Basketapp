import type { CourtElement, Point } from '../types/model';
import { newId } from '../lib/id';
import {
  createLine,
  finishMove,
  idsInRect,
  insertLinePoint,
  moveElements,
  moveLinePoint,
  nextOrder,
  rectFrom,
  updateElement,
  isLine,
  type LineType,
  type PointType,
} from './elements';
import { dist, SIZE, sub } from './paths';

export type ZoneTool = 'zoneRect' | 'zoneEllipse';
export type Tool = 'select' | 'pan' | PointType | LineType | 'text' | ZoneTool | 'freehand';

export const TOOL_GROUPS: readonly (readonly Tool[])[] = [
  ['select', 'pan'],
  ['offense', 'defense', 'coach', 'ball', 'cone'],
  ['pass', 'dribble', 'cut', 'screen', 'handoff', 'shot', 'slide'],
  ['text', 'zoneRect', 'zoneEllipse', 'freehand'],
];

/** Lines shorter than this (metres) are treated as a mis-click. */
export const MIN_LINE = 0.3;
/** Freehand points closer than this are skipped. */
export const FREEHAND_STEP = 0.08;

export type Drag =
  | { kind: 'move'; ids: ReadonlySet<string>; delta: Point }
  | { kind: 'vertex'; id: string; index: number; pos: Point }
  | { kind: 'bend'; id: string; index: number; pos: Point }
  | { kind: 'rotate'; id: string; angle: number }
  | { kind: 'resize'; id: string; pos: Point }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean }
  | { kind: 'line'; type: LineType; start: Point; end: Point; fromElementId?: string }
  | { kind: 'zone'; shape: 'rect' | 'ellipse'; start: Point; end: Point }
  | { kind: 'freehand'; points: Point[] }
  | { kind: 'pan'; startClient: Point; startCentre: Point };

export const PREVIEW_ID = '__preview__';

function zoneFrom(id: string, shape: 'rect' | 'ellipse', a: Point, b: Point): CourtElement {
  const r = rectFrom(a, b);
  return { id, type: 'zone', shape, x: r.minX, y: r.minY, w: r.maxX - r.minX, h: r.maxY - r.minY, color: '#f59e0b' };
}

/** What the court shows while a drag is in progress. Unchanged elements keep their identity. */
export function previewElements(elements: CourtElement[], drag: Drag | null): CourtElement[] {
  if (!drag) return elements;
  switch (drag.kind) {
    case 'move':
      return moveElements(elements, drag.ids, drag.delta);
    case 'vertex':
      return moveLinePoint(elements, drag.id, drag.index, drag.pos);
    case 'bend':
      return insertLinePoint(elements, drag.id, drag.index, drag.pos, true);
    case 'rotate':
      return updateElement(elements, drag.id, { rotation: Math.round(drag.angle) });
    case 'resize': {
      const z = elements.find((e) => e.id === drag.id);
      if (!z || z.type !== 'zone') return elements;
      return updateElement(elements, drag.id, { w: Math.max(0.3, drag.pos.x - z.x), h: Math.max(0.3, drag.pos.y - z.y) });
    }
    case 'line':
      return [...elements, { ...createLine(drag.type, [drag.start, drag.end], drag.fromElementId), id: PREVIEW_ID }];
    case 'zone':
      return [...elements, zoneFrom(PREVIEW_ID, drag.shape, drag.start, drag.end)];
    case 'freehand':
      return drag.points.length > 1 ? [...elements, { id: PREVIEW_ID, type: 'freehand', points: drag.points, color: '#111827' }] : elements;
    default:
      return elements;
  }
}

export interface CommitResult {
  /** New elements, or null when nothing changed. */
  elements: CourtElement[] | null;
  /** New selection, when it should change. */
  select?: string[];
  /** True when a new object was created (the tool goes back to Select). */
  created?: boolean;
}

/** Finishes a drag: the change to store (one undo step) and the new selection. */
export function commitDrag(
  elements: CourtElement[],
  drag: Drag,
  options: { numbering: boolean; selection: readonly string[] },
): CommitResult {
  switch (drag.kind) {
    case 'move':
      if (drag.delta.x === 0 && drag.delta.y === 0) return { elements: null };
      return { elements: finishMove(moveElements(elements, drag.ids, drag.delta), drag.ids) };
    case 'vertex':
    case 'bend':
    case 'rotate':
    case 'resize':
      return { elements: previewElements(elements, drag) };
    case 'marquee': {
      const ids = idsInRect(elements, rectFrom(drag.start, drag.current));
      return { elements: null, select: drag.additive ? [...new Set([...options.selection, ...ids])] : ids };
    }
    case 'line': {
      if (dist(drag.start, drag.end) < MIN_LINE) return { elements: null };
      const line = createLine(drag.type, [drag.start, drag.end], drag.fromElementId);
      if (options.numbering) line.order = nextOrder(elements);
      return { elements: [...elements, line], select: [line.id], created: true };
    }
    case 'zone': {
      const d = sub(drag.end, drag.start);
      if (Math.abs(d.x) < MIN_LINE || Math.abs(d.y) < MIN_LINE) return { elements: null };
      const zone = zoneFrom(newId(), drag.shape, drag.start, drag.end);
      return { elements: [...elements, zone], select: [zone.id], created: true };
    }
    case 'freehand': {
      if (drag.points.length < 2) return { elements: null };
      const el: CourtElement = { id: newId(), type: 'freehand', points: drag.points, color: '#111827' };
      return { elements: [...elements, el], select: [el.id], created: true };
    }
    default:
      return { elements: null };
  }
}

/** Index of the line segment nearest to a point (for adding a break point). */
export function nearestSegment(points: readonly Point[], at: Point): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - a.x) * ab.x + (at.y - a.y) * ab.y) / l2));
    const d = dist(at, { x: a.x + ab.x * t, y: a.y + ab.y * t });
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/** Angle in degrees from a centre to a point, 0 = up. */
export function angleTo(centre: Point, p: Point): number {
  const deg = (Math.atan2(p.x - centre.x, -(p.y - centre.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Adds a point to a freehand stroke unless it is too close to the last one. */
export function extendFreehand(points: Point[], p: Point): Point[] {
  const last = points.at(-1);
  return last && dist(last, p) < FREEHAND_STEP ? points : [...points, p];
}

/** True for line elements – used to decide which handles to show. */
export const hasPoints = (e: CourtElement) => isLine(e) || e.type === 'freehand';

export const ROTATE_HANDLE_DISTANCE = SIZE.playerRadius + 0.55;
