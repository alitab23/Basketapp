import type { CourtElement, Diagram, Point } from '../types/model';
import { newId } from '../lib/id';
import { add, dist, SIZE, sub } from './paths';

export type PointType = 'offense' | 'defense' | 'coach' | 'ball' | 'cone';
export type LineType = 'pass' | 'dribble' | 'cut' | 'screen' | 'handoff' | 'shot' | 'slide';

export type PointElement = Extract<CourtElement, { type: PointType }>;
export type LineElement = Extract<CourtElement, { type: LineType }>;
export type TextElement = Extract<CourtElement, { type: 'text' }>;
export type ZoneElement = Extract<CourtElement, { type: 'zone' }>;
export type FreehandElement = Extract<CourtElement, { type: 'freehand' }>;

export const POINT_TYPES: readonly PointType[] = ['offense', 'defense', 'coach', 'ball', 'cone'];
export const LINE_TYPES: readonly LineType[] = ['pass', 'dribble', 'cut', 'screen', 'handoff', 'shot', 'slide'];
/** Elements a line or a ball can be attached to. */
export const PLAYER_TYPES: readonly PointType[] = ['offense', 'defense', 'coach'];

export const isPoint = (e: CourtElement): e is PointElement => (POINT_TYPES as readonly string[]).includes(e.type);
export const isLine = (e: CourtElement): e is LineElement => (LINE_TYPES as readonly string[]).includes(e.type);
export const isPlayer = (e: CourtElement): e is PointElement => (PLAYER_TYPES as readonly string[]).includes(e.type);

export const DEFAULT_COLOR: Record<CourtElement['type'], string> = {
  offense: '#1d4ed8',
  defense: '#dc2626',
  coach: '#111827',
  ball: '#f97316',
  cone: '#f97316',
  pass: '#111827',
  dribble: '#111827',
  cut: '#111827',
  screen: '#111827',
  handoff: '#111827',
  shot: '#111827',
  slide: '#dc2626',
  text: '#111827',
  zone: '#f59e0b',
  freehand: '#111827',
};

/** How close (metres) a line start or a ball must be to a player to attach. */
export const ATTACH_DISTANCE = 0.7;
/** Where an attached ball sits relative to its player. */
export const BALL_OFFSET: Point = { x: 0.42, y: -0.42 };

export function newDiagram(court: Diagram['court'] = 'half'): Diagram {
  return { id: newId(), court, elements: [] };
}

/** Smallest free number for O/X, as a string ("1", "2" …). */
export function nextLabel(elements: readonly CourtElement[], type: 'offense' | 'defense'): string {
  const used = new Set(elements.filter((e) => e.type === type).map((e) => (e as PointElement).label));
  let n = 1;
  while (used.has(String(n))) n++;
  return String(n);
}

export function createPoint(elements: readonly CourtElement[], type: PointType, at: Point): PointElement {
  const el: PointElement = { id: newId(), type, x: at.x, y: at.y };
  if (type === 'offense' || type === 'defense') el.label = nextLabel(elements, type);
  if (type === 'coach') el.label = 'C';
  return el;
}

export function createLine(type: LineType, points: Point[], fromElementId?: string): LineElement {
  const el: LineElement = { id: newId(), type, points, curved: false };
  if (fromElementId) el.fromElementId = fromElementId;
  return el;
}

/** The nearest player within ATTACH_DISTANCE, if any. */
export function playerAt(elements: readonly CourtElement[], at: Point, exceptId?: string): PointElement | undefined {
  let best: PointElement | undefined;
  let bestDist = ATTACH_DISTANCE;
  for (const e of elements) {
    if (!isPlayer(e) || e.id === exceptId) continue;
    const d = dist(e, at);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

export function updateElement(elements: readonly CourtElement[], id: string, patch: Partial<CourtElement>): CourtElement[] {
  return elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CourtElement) : e));
}

/**
 * Deletes elements. Lines that started on a deleted player stay but are no
 * longer attached; an attached ball is released.
 */
export function removeElements(elements: readonly CourtElement[], ids: ReadonlySet<string>): CourtElement[] {
  return elements
    .filter((e) => !ids.has(e.id))
    .map((e) => {
      if (isLine(e) && e.fromElementId && ids.has(e.fromElementId)) return { ...e, fromElementId: undefined };
      if (e.type === 'ball' && e.attachedTo && ids.has(e.attachedTo)) return { ...e, attachedTo: undefined };
      return e;
    });
}

function translate(e: CourtElement, d: Point): CourtElement {
  switch (e.type) {
    case 'pass':
    case 'dribble':
    case 'cut':
    case 'screen':
    case 'handoff':
    case 'shot':
    case 'slide':
    case 'freehand':
      return { ...e, points: e.points.map((p) => add(p, d)) } as CourtElement;
    default:
      return { ...e, x: e.x + d.x, y: e.y + d.y };
  }
}

/**
 * Moves the given elements by `delta`. Lines that start on a moved player
 * follow with their start point, and an attached ball follows its player
 * (SPEC.md acceptance: "En pil som startar på O1 följer med när O1 flyttas").
 */
export function moveElements(elements: readonly CourtElement[], ids: ReadonlySet<string>, delta: Point): CourtElement[] {
  if (delta.x === 0 && delta.y === 0) return elements as CourtElement[];
  return elements.map((e) => {
    if (ids.has(e.id)) return translate(e, delta);
    if (isLine(e) && e.fromElementId && ids.has(e.fromElementId)) {
      const [first, ...rest] = e.points;
      return first ? { ...e, points: [add(first, delta), ...rest] } : e;
    }
    if (e.type === 'ball' && e.attachedTo && ids.has(e.attachedTo)) return translate(e, delta);
    return e;
  });
}

/**
 * Tidies up after a move: a line moved on its own lets go of its player;
 * a ball moved on its own attaches to the nearest player, or lets go.
 */
export function finishMove(elements: readonly CourtElement[], movedIds: ReadonlySet<string>): CourtElement[] {
  let out = elements.map((e) => {
    if (!movedIds.has(e.id)) return e;
    if (isLine(e) && e.fromElementId && !movedIds.has(e.fromElementId)) return { ...e, fromElementId: undefined };
    return e;
  });
  for (const e of out) {
    if (e.type !== 'ball' || !movedIds.has(e.id)) continue;
    if (e.attachedTo && movedIds.has(e.attachedTo)) continue;
    out = attachBall(out, e.id);
  }
  return out;
}

/** Attaches a ball to the player it lies on (and snaps it next to the player), or releases it. */
export function attachBall(elements: readonly CourtElement[], ballId: string): CourtElement[] {
  const ball = elements.find((e) => e.id === ballId);
  if (!ball || ball.type !== 'ball') return elements as CourtElement[];
  const player = playerAt(elements, ball) ?? playerAt(elements, sub(ball, BALL_OFFSET));
  if (!player) return updateElement(elements, ballId, { attachedTo: undefined });
  return updateElement(elements, ballId, { attachedTo: player.id, ...add(player, BALL_OFFSET) });
}

/** Moves one point of a line. Dragging the start onto a player attaches the line to it. */
export function moveLinePoint(elements: readonly CourtElement[], lineId: string, index: number, to: Point): CourtElement[] {
  return elements.map((e) => {
    if (e.id !== lineId || !isLine(e)) return e;
    const points = e.points.map((p, i) => (i === index ? to : p));
    if (index !== 0) return { ...e, points };
    const player = playerAt(elements, to);
    return player
      ? { ...e, points: [{ x: player.x, y: player.y }, ...points.slice(1)], fromElementId: player.id }
      : { ...e, points, fromElementId: undefined };
  });
}

/** Adds a point after `index` (a break point, or the control point when bending a line). */
export function insertLinePoint(elements: readonly CourtElement[], lineId: string, index: number, at: Point, curved?: boolean): CourtElement[] {
  return elements.map((e) => {
    if (e.id !== lineId || !isLine(e)) return e;
    const points = [...e.points.slice(0, index + 1), at, ...e.points.slice(index + 1)];
    return { ...e, points, curved: curved ?? e.curved };
  });
}

/** Removes a point from a line, keeping at least two. */
export function removeLinePoint(elements: readonly CourtElement[], lineId: string, index: number): CourtElement[] {
  return elements.map((e) => {
    if (e.id !== lineId || !isLine(e) || e.points.length <= 2) return e;
    const points = e.points.filter((_, i) => i !== index);
    return { ...e, points, curved: points.length > 2 ? e.curved : false };
  });
}

/** Numbers all lines 1, 2, 3 … in drawing order, or removes the numbers. */
export function numberLines(elements: readonly CourtElement[], on: boolean): CourtElement[] {
  let n = 0;
  return elements.map((e) => (isLine(e) ? { ...e, order: on ? ++n : undefined } : e));
}

/** Next free arrow number, for a new line when numbering is on. */
export function nextOrder(elements: readonly CourtElement[]): number {
  return elements.reduce((max, e) => (isLine(e) && e.order ? Math.max(max, e.order) : max), 0) + 1;
}

// ---------- bounds and selection ----------

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rectFrom(a: Point, b: Point): Rect {
  return { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
}

export function elementBounds(e: CourtElement): Rect {
  switch (e.type) {
    case 'zone':
      return rectFrom({ x: e.x, y: e.y }, { x: e.x + e.w, y: e.y + e.h });
    case 'text': {
      const w = Math.max(1, e.text.length) * e.size * 0.55;
      return { minX: e.x - w / 2, minY: e.y - e.size / 2, maxX: e.x + w / 2, maxY: e.y + e.size / 2 };
    }
    case 'offense':
    case 'defense':
    case 'coach':
    case 'ball':
    case 'cone': {
      const rad = e.type === 'ball' ? SIZE.ballRadius : SIZE.playerRadius;
      return { minX: e.x - rad, minY: e.y - rad, maxX: e.x + rad, maxY: e.y + rad };
    }
    default: {
      const xs = e.points.map((p) => p.x);
      const ys = e.points.map((p) => p.y);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
  }
}

const intersects = (a: Rect, b: Rect) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Ids of elements touched by a selection box. */
export function idsInRect(elements: readonly CourtElement[], rect: Rect): string[] {
  return elements.filter((e) => intersects(elementBounds(e), rect)).map((e) => e.id);
}

// ---------- copy, paste and steps ----------

/**
 * Deep copies with new ids. Links between copied elements (arrow → player,
 * ball → player) point to the new copies; links to elements not copied are kept
 * only when `keepOutsideLinks` is set (copy to next step), otherwise dropped.
 */
export function cloneElements(elements: readonly CourtElement[], offset: Point = { x: 0, y: 0 }, keepOutsideLinks = false): CourtElement[] {
  const idMap = new Map(elements.map((e) => [e.id, newId()]));
  const relink = (id: string | undefined) => (id === undefined ? undefined : (idMap.get(id) ?? (keepOutsideLinks ? id : undefined)));
  return elements.map((e) => {
    const copy = translate(structuredClone(e), offset);
    copy.id = idMap.get(e.id)!;
    if (isLine(copy)) copy.fromElementId = relink(copy.fromElementId);
    if (copy.type === 'ball') copy.attachedTo = relink(copy.attachedTo);
    return copy;
  });
}

/** "Kopiera till nästa steg": a new diagram with the same court and copies of all elements. */
export function copyDiagram(diagram: Diagram): Diagram {
  return { id: newId(), court: diagram.court, elements: cloneElements(diagram.elements) };
}

/** Places a point on the grid when snapping is on. */
export function snap(p: Point, grid: number | null): Point {
  if (!grid) return p;
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}
