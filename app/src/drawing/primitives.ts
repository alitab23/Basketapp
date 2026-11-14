import type { CourtElement, Diagram, Point } from '../types/model';
import { COURT, courtBounds, halfCourtShapes, viewBounds, type Bounds } from './court';
import { COURT_COLORS, type CourtStyle } from './courtStyle';
import { DEFAULT_COLOR } from './elements';
import { basePath, drawLine, SIZE } from './paths';

/**
 * A drawing as plain shapes in metres. The same list becomes an SVG file,
 * a PNG and vector graphics in the PDF (SPEC.md section 7), so a drawing looks
 * the same in every export. The editor itself draws with ElementShape.
 */
interface Paint {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  round?: boolean;
}
export type Primitive =
  | ({ kind: 'path'; d: string } & Paint)
  | ({ kind: 'circle'; cx: number; cy: number; r: number } & Paint)
  | ({ kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint)
  | ({ kind: 'rect'; x: number; y: number; width: number; height: number } & Paint)
  | { kind: 'text'; x: number; y: number; text: string; size: number; fill: string; bold: boolean; halo?: string };

export interface Scene {
  bounds: Bounds;
  primitives: Primitive[];
}

export interface SceneOptions {
  style: CourtStyle;
  /** Black and white: every colour becomes a grey of the same lightness. */
  mono?: boolean;
}

/** "#1d4ed8" → a grey with the same perceived lightness. */
export function toGrey(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const l = Math.round(0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = l.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const pt = (p: Point) => `${r4(p.x)} ${r4(p.y)}`;
const poly = (p: readonly Point[], closed = false) => p.map((q, i) => `${i ? 'L' : 'M'} ${pt(q)}`).join(' ') + (closed ? ' Z' : '');

function rotate(p: Point, centre: Point, degrees: number | undefined): Point {
  if (!degrees) return p;
  const a = (degrees * Math.PI) / 180;
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * Math.cos(a) - dy * Math.sin(a), y: centre.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Text is placed by its baseline; this centres it vertically on y. */
const centred = (y: number, size: number) => r4(y + size * 0.35);

function court(court: Diagram['court'], style: CourtStyle, c: (s: string) => string): Primitive[] {
  const col = COURT_COLORS[style];
  const b = courtBounds(court);
  const v = viewBounds(court);
  const w = COURT.lineWidth;
  const line = { stroke: c(col.line), strokeWidth: w };
  const out: Primitive[] = [
    { kind: 'rect', x: v.minX, y: v.minY, width: v.width, height: v.height, fill: c(col.outside) },
    { kind: 'rect', x: b.minX, y: b.minY, width: b.width, height: b.height, fill: c(col.floor) },
  ];
  for (const side of court === 'full' ? ([1, -1] as const) : ([1] as const)) {
    const s = halfCourtShapes(side);
    out.push(
      { kind: 'path', d: poly(s.paint, true), fill: c(col.paint), ...line },
      { kind: 'path', d: poly(s.threePoint), ...line },
      { kind: 'path', d: poly(s.freeThrowSolid), ...line },
      { kind: 'path', d: poly(s.freeThrowDashed), ...line, dash: '0.3 0.25' },
      { kind: 'path', d: poly(s.noCharge), ...line },
      { kind: 'path', d: poly(s.backboard), stroke: c(col.line), strokeWidth: w * 2 },
      { kind: 'circle', cx: s.rim.centre.x, cy: s.rim.centre.y, r: s.rim.radius, stroke: c('#EA580C'), strokeWidth: w * 1.2 },
    );
  }
  const W = COURT.halfWidth;
  const R = COURT.centreCircleRadius;
  out.push(
    { kind: 'rect', x: b.minX, y: b.minY, width: b.width, height: b.height, ...line },
    { kind: 'path', d: `M 0 ${-W} L 0 ${W}`, ...line },
    court === 'full'
      ? { kind: 'circle', cx: 0, cy: 0, r: R, ...line }
      : { kind: 'path', d: `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R}`, ...line },
  );
  return out;
}

function label(x: number, y: number, text: string, fill: string, size: number = SIZE.labelFont): Primitive {
  return { kind: 'text', x: r4(x), y: centred(y, size), text, size, fill, bold: true };
}

function element(e: CourtElement, c: (s: string) => string): Primitive[] {
  const color = c(('color' in e && e.color) || DEFAULT_COLOR[e.type]);
  switch (e.type) {
    case 'offense':
    case 'defense':
    case 'coach':
    case 'ball':
    case 'cone': {
      const at = { x: e.x, y: e.y };
      const rot = (p: Point) => rotate(p, at, e.rotation);
      const R = SIZE.playerRadius;
      const out: Primitive[] = [];
      if (e.type === 'offense') {
        out.push({ kind: 'circle', cx: e.x, cy: e.y, r: R, fill: '#FFFFFF', stroke: color, strokeWidth: 0.09 }, label(e.x, e.y, e.label ?? '', color));
      } else if (e.type === 'defense') {
        const d = 0.32;
        const a = [rot({ x: e.x - d, y: e.y - d }), rot({ x: e.x + d, y: e.y + d })];
        const b = [rot({ x: e.x + d, y: e.y - d }), rot({ x: e.x - d, y: e.y + d })];
        out.push({ kind: 'path', d: `${poly(a)} ${poly(b)}`, stroke: color, strokeWidth: 0.11, round: true });
        if (e.label) out.push(label(e.x + 0.45, e.y + 0.35, e.label, color, 0.38));
      } else if (e.type === 'coach') {
        const h = SIZE.coachSize / 2;
        const corners = [
          { x: e.x - h, y: e.y - h },
          { x: e.x + h, y: e.y - h },
          { x: e.x + h, y: e.y + h },
          { x: e.x - h, y: e.y + h },
        ].map(rot);
        out.push({ kind: 'path', d: poly(corners, true), fill: color }, label(e.x, e.y, e.label || 'C', '#FFFFFF'));
      } else if (e.type === 'ball') {
        out.push({ kind: 'circle', cx: e.x, cy: e.y, r: SIZE.ballRadius, fill: color, stroke: c('#7C2D12'), strokeWidth: 0.03 });
      } else {
        const s = SIZE.coneSize / 2;
        const tri = [
          { x: e.x, y: e.y - s },
          { x: e.x + s, y: e.y + s },
          { x: e.x - s, y: e.y + s },
        ].map(rot);
        out.push({ kind: 'path', d: poly(tri, true), fill: color, stroke: c('#7C2D12'), strokeWidth: 0.03 });
      }
      if (e.rotation) {
        out.push({ kind: 'path', d: poly([rot({ x: e.x, y: e.y - R }), rot({ x: e.x, y: e.y - R - 0.2 })]), stroke: color, strokeWidth: 0.08 });
      }
      return out;
    }
    case 'text':
      return [{ kind: 'text', x: e.x, y: centred(e.y, e.size), text: e.text, size: e.size, fill: color, bold: true, halo: '#FFFFFF' }];
    case 'zone': {
      const paint = { fill: color, fillOpacity: 0.25, stroke: color, strokeWidth: 0.05 };
      return [
        e.shape === 'rect'
          ? { kind: 'rect', x: e.x, y: e.y, width: e.w, height: e.h, ...paint }
          : { kind: 'ellipse', cx: e.x + e.w / 2, cy: e.y + e.h / 2, rx: e.w / 2, ry: e.h / 2, ...paint },
      ];
    }
    case 'freehand':
      return [{ kind: 'path', d: basePath(e.points, false), stroke: color, strokeWidth: SIZE.lineWidth, round: true }];
    default: {
      const d = drawLine(e.type, e.points, e.curved);
      const out: Primitive[] = [
        ...d.strokes.map((p): Primitive => ({ kind: 'path', d: p, stroke: color, strokeWidth: SIZE.lineWidth, dash: d.dashed ? '0.3 0.2' : undefined, round: true })),
        ...d.extras.map((p): Primitive => ({ kind: 'path', d: p, stroke: color, strokeWidth: SIZE.lineWidth * 1.4, round: true })),
        ...d.fills.map((p): Primitive => ({ kind: 'path', d: p, fill: color })),
      ];
      if (e.order) {
        out.push(
          { kind: 'circle', cx: d.labelAt.x, cy: d.labelAt.y, r: SIZE.orderRadius, fill: '#FFFFFF', stroke: color, strokeWidth: 0.04 },
          label(d.labelAt.x, d.labelAt.y, String(e.order), color, 0.3),
        );
      }
      return out;
    }
  }
}

export function diagramScene(diagram: Diagram, options: SceneOptions): Scene {
  const c = options.mono ? toGrey : (s: string) => s;
  return {
    bounds: viewBounds(diagram.court),
    primitives: [...court(diagram.court, options.style, c), ...diagram.elements.flatMap((e) => element(e, c))],
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function paintAttrs(p: Paint): string {
  const a: string[] = [`fill="${p.fill ?? 'none'}"`];
  if (p.fillOpacity !== undefined) a.push(`fill-opacity="${p.fillOpacity}"`);
  if (p.stroke) a.push(`stroke="${p.stroke}"`, `stroke-width="${r4(p.strokeWidth ?? 0.05)}"`);
  if (p.dash) a.push(`stroke-dasharray="${p.dash}"`);
  if (p.round) a.push('stroke-linecap="round"', 'stroke-linejoin="round"');
  return a.join(' ');
}

/** A stand-alone SVG file. `width` is in pixels; the height follows the court. */
export function sceneToSvg(scene: Scene, width = 1200, title?: string): string {
  const { minX, minY, width: w, height: h } = scene.bounds;
  const body = scene.primitives
    .map((p) => {
      switch (p.kind) {
        case 'path':
          return `<path d="${p.d}" ${paintAttrs(p)}/>`;
        case 'circle':
          return `<circle cx="${r4(p.cx)}" cy="${r4(p.cy)}" r="${r4(p.r)}" ${paintAttrs(p)}/>`;
        case 'ellipse':
          return `<ellipse cx="${r4(p.cx)}" cy="${r4(p.cy)}" rx="${r4(p.rx)}" ry="${r4(p.ry)}" ${paintAttrs(p)}/>`;
        case 'rect':
          return `<rect x="${r4(p.x)}" y="${r4(p.y)}" width="${r4(p.width)}" height="${r4(p.height)}" ${paintAttrs(p)}/>`;
        case 'text': {
          const halo = p.halo ? ` stroke="${p.halo}" stroke-width="${r4(p.size * 0.12)}" paint-order="stroke"` : '';
          return `<text x="${r4(p.x)}" y="${r4(p.y)}" font-size="${p.size}" font-weight="${p.bold ? 700 : 400}" fill="${p.fill}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"${halo}>${esc(p.text)}</text>`;
        }
      }
    })
    .join('');
  const height = Math.round((width * h) / w);
  const t = title ? `<title>${esc(title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${width}" height="${height}">${t}${body}</svg>`;
}

/** Renders the SVG to a PNG in the browser. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
