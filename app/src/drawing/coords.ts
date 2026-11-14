import type { Point } from '../types/model';
import type { Bounds } from './court';

export interface Viewport {
  /** 1 = whole court visible. */
  zoom: number;
  /** Centre of the view in court metres. */
  centre: Point;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** The visible part of the court for a zoom level, kept inside the full view. */
export function visibleBounds(full: Bounds, vp: Viewport): Bounds {
  const zoom = clampZoom(vp.zoom);
  const width = full.width / zoom;
  const height = full.height / zoom;
  const minX = Math.min(full.minX + full.width - width, Math.max(full.minX, vp.centre.x - width / 2));
  const minY = Math.min(full.minY + full.height - height, Math.max(full.minY, vp.centre.y - height / 2));
  return { minX, minY, width, height };
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Screen pixel → court metres for an SVG with `viewBox = view` and the default
 * preserveAspectRatio (xMidYMid meet).
 */
export function screenToCourt(client: Point, rect: ScreenRect, view: Bounds): Point {
  const s = Math.min(rect.width / view.width, rect.height / view.height);
  const offsetX = (rect.width - view.width * s) / 2;
  const offsetY = (rect.height - view.height * s) / 2;
  return {
    x: view.minX + (client.x - rect.left - offsetX) / s,
    y: view.minY + (client.y - rect.top - offsetY) / s,
  };
}

/** Pixels per metre, for sizing handles independent of zoom. */
export function pixelsPerMetre(rect: ScreenRect, view: Bounds): number {
  return Math.min(rect.width / view.width, rect.height / view.height);
}

/** Zooms around a fixed court point (e.g. under the mouse). */
export function zoomAt(full: Bounds, vp: Viewport, factor: number, anchor: Point): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const before = visibleBounds(full, vp);
  const k = vp.zoom / zoom;
  const minX = anchor.x - (anchor.x - before.minX) * k;
  const minY = anchor.y - (anchor.y - before.minY) * k;
  const width = full.width / zoom;
  const height = full.height / zoom;
  return { zoom, centre: { x: minX + width / 2, y: minY + height / 2 } };
}
