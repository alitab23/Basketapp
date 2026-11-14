import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyPlus, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { CourtElement, Diagram, Point } from '../types/model';
import { viewBounds, viewBoxString } from './court';
import { clampZoom, pixelsPerMetre, screenToCourt, visibleBounds, zoomAt, type Viewport } from './coords';
import { CourtBackground } from './CourtBackground';
import { ElementShape } from './ElementShape';
import { useCourtStyle, type CourtStyle } from './courtStyle';
import {
  attachBall,
  cloneElements,
  createPoint,
  finishMove,
  insertLinePoint,
  isLine,
  isPoint,
  LINE_TYPES,
  moveElements,
  numberLines,
  playerAt,
  POINT_TYPES,
  rectFrom,
  removeElements,
  removeLinePoint,
  snap,
  updateElement,
  type LineType,
  type PointType,
} from './elements';
import {
  angleTo,
  commitDrag,
  extendFreehand,
  hasPoints,
  nearestSegment,
  previewElements,
  ROTATE_HANDLE_DISTANCE,
  type Drag,
  type Tool,
} from './interaction';
import { mid, SIZE } from './paths';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { ui } from '../components/ui';
import { newId } from '../lib/id';

export interface DiagramEditorProps {
  diagram: Diagram;
  /** A changed diagram. Same `coalesceKey` close in time = one undo step. */
  onChange: (next: Diagram, coalesceKey?: string | null) => void;
  onCopyToNext?: () => void;
}

const GRID = 0.5;
const HANDLE_PX = 8;
const PASTE_OFFSET = 0.5;

/** Copied objects, shared between all drawings in the app. */
let clipboard: CourtElement[] = [];

const isTextInput = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** The drawing tool (SPEC.md section 5). Loaded only when a block is opened. */
export default function DiagramEditor({ diagram, onChange, onCopyToNext }: DiagramEditorProps) {
  const { t } = useTranslation();
  const [style, setStyle] = useCourtStyle();
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<string[]>([]);
  const [drag, setDragState] = useState<Drag | null>(null);
  const [grid, setGrid] = useState(false);
  const view = useMemo(() => viewBounds(diagram.court), [diagram.court]);
  const [vp, setVp] = useState<Viewport>({ zoom: 1, centre: { x: view.minX + view.width / 2, y: view.minY + view.height / 2 } });
  const visible = visibleBounds(view, vp);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxWidth, setPxWidth] = useState(640);

  // Refs so pointer handlers always see the latest values without re-binding.
  const dragRef = useRef<Drag | null>(null);
  const moveStart = useRef<{ pointer: Point; anchor: Point } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; vp: Viewport } | null>(null);
  const pasteCount = useRef(0);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  const elements = diagram.elements;
  const shown = useMemo(() => previewElements(elements, drag), [elements, drag]);
  const selectedSet = useMemo(() => new Set(selection.filter((id) => elements.some((e) => e.id === id))), [selection, elements]);
  const selectedEls = elements.filter((e) => selectedSet.has(e.id));
  const numbering = elements.some((e) => isLine(e) && e.order);
  const gridSize = grid ? GRID : null;
  const ppm = pxWidth / visible.width;
  const handleR = HANDLE_PX / ppm;

  const setElements = useCallback(
    (next: CourtElement[], key: string | null = null) => onChange({ ...diagram, elements: next }, key),
    [diagram, onChange],
  );

  // Track the drawn width for handle sizes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setPxWidth(entry.contentRect.width || 640));
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Reset zoom when switching between half and full court.
  useEffect(() => {
    setVp({ zoom: 1, centre: { x: view.minX + view.width / 2, y: view.minY + view.height / 2 } });
  }, [view]);

  const toCourt = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      return screenToCourt({ x: clientX, y: clientY }, { left: r.left, top: r.top, width: r.width, height: r.height }, visible);
    },
    [visible],
  );

  // Ctrl/Cmd + wheel zooms around the pointer. Needs a non-passive listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setVp((v) => zoomAt(view, v, e.deltaY < 0 ? 1.15 : 1 / 1.15, toCourt(e.clientX, e.clientY)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [view, toCourt]);

  function addAndSelect(el: CourtElement, list = elements) {
    let next = [...list, el];
    if (el.type === 'ball') next = attachBall(next, el.id);
    setElements(next);
    setSelection([el.id]);
    setTool('select');
  }

  function place(type: PointType | 'text', at: Point) {
    if (type === 'text') {
      addAndSelect({ id: newId(), type: 'text', x: at.x, y: at.y, text: t('drawing.defaultText'), size: SIZE.defaultText });
    } else {
      addAndSelect(createPoint(elements, type, at));
    }
  }

  // ---------- pointer handling ----------

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    svgRef.current?.focus({ preventScroll: true });

    if (pointers.current.size === 2) {
      // Two fingers: pinch to zoom, cancel whatever the first finger started.
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), vp };
      setDrag(null);
      return;
    }

    const p = toCourt(e.clientX, e.clientY);
    const ps = snap(p, gridSize);
    const target = e.target as Element;
    const handle = target.closest('[data-handle]');

    if (handle) {
      const id = handle.getAttribute('data-id')!;
      const index = Number(handle.getAttribute('data-index'));
      switch (handle.getAttribute('data-handle')) {
        case 'vertex':
          return setDrag({ kind: 'vertex', id, index, pos: ps });
        case 'bend':
          return setDrag({ kind: 'bend', id, index, pos: ps });
        case 'rotate': {
          const el = elements.find((x) => x.id === id);
          return el && isPoint(el) ? setDrag({ kind: 'rotate', id, angle: angleTo(el, p) }) : undefined;
        }
        case 'resize':
          return setDrag({ kind: 'resize', id, pos: ps });
      }
    }

    if (tool === 'pan') return setDrag({ kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, startCentre: { x: visible.minX + visible.width / 2, y: visible.minY + visible.height / 2 } });
    if ((POINT_TYPES as readonly string[]).includes(tool) || tool === 'text') return place(tool as PointType | 'text', ps);
    if ((LINE_TYPES as readonly string[]).includes(tool)) {
      const player = playerAt(elements, p);
      const start = player ? { x: player.x, y: player.y } : ps;
      return setDrag({ kind: 'line', type: tool as LineType, start, end: start, fromElementId: player?.id });
    }
    if (tool === 'zoneRect' || tool === 'zoneEllipse') return setDrag({ kind: 'zone', shape: tool === 'zoneRect' ? 'rect' : 'ellipse', start: ps, end: ps });
    if (tool === 'freehand') return setDrag({ kind: 'freehand', points: [p] });

    // Select tool
    const hit = target.closest('[data-element-id]');
    const id = hit?.getAttribute('data-element-id');
    if (id && elements.some((x) => x.id === id)) {
      if (e.shiftKey) {
        setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
        return;
      }
      const ids = selectedSet.has(id) ? new Set(selectedSet) : new Set([id]);
      if (!selectedSet.has(id)) setSelection([id]);
      const el = elements.find((x) => x.id === id)!;
      const anchor = hasPoints(el) ? (el as { points: Point[] }).points[0]! : { x: (el as { x: number }).x, y: (el as { y: number }).y };
      moveStart.current = { pointer: p, anchor };
      return setDrag({ kind: 'move', ids, delta: { x: 0, y: 0 } });
    }
    if (!e.shiftKey) setSelection([]);
    setDrag({ kind: 'marquee', start: p, current: p, additive: e.shiftKey });
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const factor = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance;
      const start = pinch.current.vp;
      setVp(zoomAt(view, start, factor, toCourt((a.x + b.x) / 2, (a.y + b.y) / 2)));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const p = toCourt(e.clientX, e.clientY);
    const ps = snap(p, gridSize);
    switch (d.kind) {
      case 'move': {
        const s = moveStart.current!;
        const raw = { x: s.anchor.x + p.x - s.pointer.x, y: s.anchor.y + p.y - s.pointer.y };
        const to = snap(raw, gridSize);
        return setDrag({ ...d, delta: { x: to.x - s.anchor.x, y: to.y - s.anchor.y } });
      }
      case 'vertex':
      case 'bend':
      case 'resize':
        return setDrag({ ...d, pos: ps });
      case 'rotate': {
        const el = elements.find((x) => x.id === d.id);
        if (!el || !isPoint(el)) return;
        const angle = angleTo(el, p);
        return setDrag({ ...d, angle: grid ? Math.round(angle / 15) * 15 : angle });
      }
      case 'marquee':
        return setDrag({ ...d, current: p });
      case 'line':
      case 'zone':
        return setDrag({ ...d, end: ps });
      case 'freehand':
        return setDrag({ ...d, points: extendFreehand(d.points, p) });
      case 'pan': {
        const r = svgRef.current!.getBoundingClientRect();
        const k = pixelsPerMetre({ left: r.left, top: r.top, width: r.width, height: r.height }, visible);
        setVp((v) => ({ ...v, centre: { x: d.startCentre.x - (e.clientX - d.startClient.x) / k, y: d.startCentre.y - (e.clientY - d.startClient.y) / k } }));
        return;
      }
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    const result = commitDrag(elements, d, { numbering, selection: [...selectedSet] });
    if (result.elements) setElements(result.elements);
    if (result.select) setSelection(result.select);
    if (result.created) setTool('select');
  }

  function onDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    const target = e.target as Element;
    const handle = target.closest('[data-handle="vertex"]');
    if (handle) {
      setElements(removeLinePoint(elements, handle.getAttribute('data-id')!, Number(handle.getAttribute('data-index'))));
      return;
    }
    const id = target.closest('[data-element-id]')?.getAttribute('data-element-id');
    const el = id ? elements.find((x) => x.id === id) : undefined;
    if (el && isLine(el)) {
      const p = snap(toCourt(e.clientX, e.clientY), gridSize);
      setElements(insertLinePoint(elements, el.id, nearestSegment(el.points, p), p));
      setSelection([el.id]);
    }
  }

  // ---------- keyboard ----------

  function deleteSelection() {
    if (selectedSet.size === 0) return;
    setElements(removeElements(elements, selectedSet));
    setSelection([]);
  }

  function pasteElements(source: CourtElement[]) {
    if (source.length === 0) return;
    pasteCount.current += 1;
    const off = PASTE_OFFSET * pasteCount.current;
    const copies = cloneElements(source, { x: off, y: off });
    setElements([...elements, ...copies]);
    setSelection(copies.map((c) => c.id));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (isTextInput(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
    } else if (e.key === 'Escape') {
      setDrag(null);
      setTool('select');
      setSelection([]);
    } else if (mod && key === 'c') {
      clipboard = structuredClone(selectedEls);
      pasteCount.current = 0;
    } else if (mod && key === 'v') {
      e.preventDefault();
      pasteElements(clipboard);
    } else if (mod && key === 'd') {
      e.preventDefault();
      pasteCount.current = 0;
      pasteElements(selectedEls);
    } else if (mod && key === 'a') {
      e.preventDefault();
      setSelection(elements.map((x) => x.id));
    } else if (e.key.startsWith('Arrow') && selectedSet.size > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 0.5 : 0.1;
      const delta = { x: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, y: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0 };
      setElements(finishMove(moveElements(elements, selectedSet, delta), selectedSet), 'nudge');
    } else if (e.key === 'Enter' && ((POINT_TYPES as readonly string[]).includes(tool) || tool === 'text')) {
      // Keyboard placement: in the middle of what is visible.
      place(tool as PointType | 'text', snap({ x: visible.minX + visible.width / 2, y: visible.minY + visible.height / 2 }, gridSize));
    }
  }

  // ---------- render ----------

  const single = selectedEls.length === 1 && tool === 'select' && drag?.kind !== 'move' ? shown.find((x) => x.id === selectedEls[0]!.id) : undefined;
  const creating = tool !== 'select' && tool !== 'pan';

  return (
    <div className="space-y-2" onKeyDown={onKeyDown} data-testid="diagram-editor">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label={t('drawing.court')}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          value={diagram.court}
          onChange={(e) => onChange({ ...diagram, court: e.target.value as Diagram['court'] })}
        >
          <option value="half">{t('drawing.half')}</option>
          <option value="full">{t('drawing.full')}</option>
        </select>
        <select
          aria-label={t('drawing.style')}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          value={style}
          onChange={(e) => setStyle(e.target.value as CourtStyle)}
        >
          <option value="wood">{t('drawing.wood')}</option>
          <option value="white">{t('drawing.white')}</option>
        </select>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-orange-500" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
          {t('drawing.grid')}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-orange-500" checked={numbering} onChange={(e) => setElements(numberLines(elements, e.target.checked))} />
          {t('drawing.numbering')}
        </label>
        <div className="ml-auto flex items-center">
          <button type="button" className={ui.icon} aria-label={t('drawing.zoomOut')} title={t('drawing.zoomOut')} onClick={() => setVp((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.25) }))}>
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} aria-label={t('drawing.zoomIn')} title={t('drawing.zoomIn')} onClick={() => setVp((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.25) }))}>
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={ui.icon} aria-label={t('drawing.zoomReset')} title={t('drawing.zoomReset')} onClick={() => setVp((v) => ({ ...v, zoom: 1 }))}>
            <Maximize className="h-4 w-4" aria-hidden="true" />
          </button>
          {onCopyToNext && (
            <button type="button" className={`${ui.secondary} ml-1 py-1`} onClick={onCopyToNext}>
              <CopyPlus className="h-4 w-4" aria-hidden="true" /> {t('drawing.copyToNext')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Palette tool={tool} onTool={(next) => setTool(next)} />

        <div className="min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={viewBoxString(visible)}
            role="application"
            aria-label={t('drawing.canvas')}
            tabIndex={0}
            data-testid="drawing-canvas"
            className="block w-full touch-none select-none rounded-lg border border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-700"
            style={{ aspectRatio: `${view.width} / ${view.height}`, cursor: tool === 'pan' ? 'grab' : creating ? 'crosshair' : 'default' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            <CourtBackground court={diagram.court} style={style} grid={grid} />
            {shown.map((el) => (
              <ElementShape key={el.id} element={el} selected={selectedSet.has(el.id)} interactive={tool === 'select'} />
            ))}

            {single && <Handles element={single} r={handleR} />}

            {drag?.kind === 'marquee' && (
              <rect
                data-testid="marquee"
                {...(() => {
                  const r = rectFrom(drag.start, drag.current);
                  return { x: r.minX, y: r.minY, width: r.maxX - r.minX, height: r.maxY - r.minY };
                })()}
                fill="#F97316"
                fillOpacity={0.1}
                stroke="#F97316"
                strokeWidth={1.5 / ppm}
                strokeDasharray={`${4 / ppm} ${3 / ppm}`}
                pointerEvents="none"
              />
            )}
          </svg>
        </div>

        <div className="sm:w-56">
          <PropertiesPanel
            selected={selectedEls}
            all={elements}
            onPatch={(id, patch, key) => setElements(updateElement(elements, id, patch), key)}
            onPatchAll={(patch) => setElements(elements.map((x) => (selectedSet.has(x.id) && x.type !== 'text' ? ({ ...x, ...patch } as CourtElement) : x)))}
            onDelete={deleteSelection}
            onDuplicate={() => {
              pasteCount.current = 0;
              pasteElements(selectedEls);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Drag handles for one selected object: line points, bend points, rotation and zone size. */
function Handles({ element: e, r }: { element: CourtElement; r: number }) {
  const handle = (kind: string, p: Point, index = 0, shape: 'circle' | 'diamond' = 'circle') => {
    const common = {
      'data-handle': kind,
      'data-id': e.id,
      'data-index': index,
      'data-testid': `handle-${kind}`,
      fill: '#FFFFFF',
      stroke: '#F97316',
      strokeWidth: r * 0.35,
      style: { cursor: kind === 'rotate' ? 'grab' : 'move' },
    } as const;
    return shape === 'circle' ? (
      <circle key={`${kind}${index}`} cx={p.x} cy={p.y} r={r} {...common} />
    ) : (
      <rect key={`${kind}${index}`} x={p.x - r * 0.8} y={p.y - r * 0.8} width={r * 1.6} height={r * 1.6} transform={`rotate(45 ${p.x} ${p.y})`} {...common} />
    );
  };

  if (isLine(e)) {
    return (
      <g>
        {e.curved && e.points.length > 2 && (
          <polyline points={e.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#F97316" strokeWidth={r * 0.2} strokeDasharray={`${r} ${r * 0.6}`} pointerEvents="none" />
        )}
        {!e.curved && e.points.slice(1).map((p, i) => handle('bend', mid(e.points[i]!, p), i, 'diamond'))}
        {e.points.map((p, i) => handle('vertex', p, i))}
      </g>
    );
  }
  if (isPoint(e) && e.type !== 'ball') {
    const a = ((e.rotation ?? 0) * Math.PI) / 180;
    const p = { x: e.x + Math.sin(a) * ROTATE_HANDLE_DISTANCE, y: e.y - Math.cos(a) * ROTATE_HANDLE_DISTANCE };
    return (
      <g>
        <line x1={e.x} y1={e.y} x2={p.x} y2={p.y} stroke="#F97316" strokeWidth={r * 0.2} pointerEvents="none" />
        {handle('rotate', p)}
      </g>
    );
  }
  if (e.type === 'zone') return <g>{handle('resize', { x: e.x + e.w, y: e.y + e.h })}</g>;
  return null;
}
