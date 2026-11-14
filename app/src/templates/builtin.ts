import type { Block, CourtElement, Diagram, DrillContent, Point, SeasonTemplate, SessionContent, Template } from '../types/model';

/**
 * Templates that ship with the app (SPEC.md section 6). They are read-only and
 * built from the translation files, so they follow the chosen language.
 * Coordinates are in metres, origin at the centre of the full court.
 */

type T = (key: string) => string;

// ---------- small drawing helpers (fixed ids: they are copied on use) ----------

const o = (id: string, label: string, x: number, y: number): CourtElement => ({ id, type: 'offense', x, y, label });
const x = (id: string, label: string, px: number, py: number): CourtElement => ({ id, type: 'defense', x: px, y: py, label });
const coach = (id: string, px: number, py: number): CourtElement => ({ id, type: 'coach', x: px, y: py, label: 'C' });
const ball = (id: string, on: CourtElement & { x: number; y: number }): CourtElement => ({ id, type: 'ball', x: on.x + 0.42, y: on.y - 0.42, attachedTo: on.id });
const cone = (id: string, px: number, py: number): CourtElement => ({ id, type: 'cone', x: px, y: py });
const line = (
  id: string,
  type: 'pass' | 'dribble' | 'cut' | 'screen' | 'handoff' | 'shot' | 'slide',
  points: Point[],
  order?: number,
  from?: string,
): CourtElement => {
  const el: CourtElement = { id, type, points, curved: points.length === 3 };
  if (order) el.order = order;
  if (from) el.fromElementId = from;
  return el;
};
const p = (px: number, py: number): Point => ({ x: px, y: py });

function diagram(id: string, court: Diagram['court'], elements: CourtElement[], caption?: string): Diagram {
  const d: Diagram = { id, court, elements };
  if (caption) d.caption = caption;
  return d;
}

// ---------- drills ----------

type DrillKey = 'mikan' | 'weave' | 'fastbreak' | 'shell' | 'closeout' | 'pnr';

function drillDiagrams(key: DrillKey, t: T): Diagram[] {
  switch (key) {
    case 'mikan': {
      const o1 = o('o1', '1', 12.1, -1.1) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'half', [
          o1,
          ball('b', o1),
          line('l1', 'cut', [p(12.1, -1.1), p(11.0, 0), p(12.1, 1.1)], 1, 'o1'),
          line('l2', 'shot', [p(12.1, 1.1), p(12.35, 0.35)], 2),
          line('l3', 'cut', [p(12.1, 1.1), p(10.6, 0), p(12.1, -1.1)], 3),
          line('l4', 'shot', [p(12.1, -1.1), p(12.35, -0.35)], 4),
        ], t('builtin.mikan.caption')),
      ];
    }
    case 'weave': {
      const o2 = o('o2', '2', -12.5, 0) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'full', [
          o('o1', '1', -12.5, -4.5),
          o2,
          o('o3', '3', -12.5, 4.5),
          ball('b', o2),
          line('l1', 'pass', [p(-12.5, 0), p(-10, -4)], 1, 'o2'),
          line('l2', 'cut', [p(-12.5, 0), p(-11.5, -6), p(-7, -5.5)], 2, 'o2'),
          line('l3', 'cut', [p(-12.5, -4.5), p(-9.5, -0.5)], 2, 'o1'),
          line('l4', 'pass', [p(-9.5, -0.5), p(-6.5, 4)], 3),
          line('l5', 'cut', [p(-12.5, 4.5), p(-6.5, 4)], 3, 'o3'),
          { id: 't1', type: 'text', x: 3, y: -6.6, text: t('builtin.weave.label'), size: 0.6 },
        ], t('builtin.weave.caption')),
      ];
    }
    case 'fastbreak': {
      const o1 = o('o1', '1', -6, 0) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'full', [
          o1,
          o('o2', '2', -6, -5),
          o('o3', '3', -6, 5),
          ball('b', o1),
          x('x1', '1', 8.5, 0),
          x('x2', '2', 11.5, 0.5),
          line('l1', 'dribble', [p(-6, 0), p(6, 0)], 1, 'o1'),
          line('l2', 'cut', [p(-6, -5), p(0, -5.5), p(9.5, -4)], 1, 'o2'),
          line('l3', 'cut', [p(-6, 5), p(0, 5.5), p(9.5, 4)], 1, 'o3'),
          line('l4', 'pass', [p(6, 0), p(9.5, -4)], 2),
          line('l5', 'shot', [p(9.5, -4), p(12.2, -0.4)], 3),
        ], t('builtin.fastbreak.caption')),
      ];
    }
    case 'shell': {
      const o1 = o('o1', '1', 6, -2.5) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'half', [
          o1,
          o('o2', '2', 6, 2.5),
          o('o3', '3', 10.6, -6),
          o('o4', '4', 10.6, 6),
          ball('b', o1),
          x('x1', '1', 7, -2.2),
          x('x2', '2', 7.8, 1.1),
          x('x3', '3', 11.1, -5.1),
          x('x4', '4', 11.4, 2.4),
          line('l1', 'pass', [p(6, -2.5), p(10.6, -6)], 1, 'o1'),
          line('l2', 'slide', [p(7, -2.2), p(8.3, -3.7)], 2),
          line('l3', 'slide', [p(7.8, 1.1), p(8.6, -0.7)], 2),
          line('l4', 'slide', [p(11.4, 2.4), p(11.7, 0.5)], 2),
          line('l5', 'slide', [p(11.1, -5.1), p(11, -5.6)], 2),
        ], t('builtin.shell.caption')),
      ];
    }
    case 'closeout': {
      const c = coach('c', 7, 0) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'half', [
          c,
          ball('b', c),
          o('o1', '1', 12.9, -6.4),
          x('x1', '1', 12.2, -1.4),
          cone('k1', 11.6, -4.6),
          line('l1', 'pass', [p(7, 0), p(12.9, -6.4)], 1, 'c'),
          line('l2', 'cut', [p(12.2, -1.4), p(12.6, -5.4)], 1, 'x1'),
        ], t('builtin.closeout.caption')),
      ];
    }
    case 'pnr': {
      const o1 = o('o1', '1', 5.8, 0.6) as CourtElement & { x: number; y: number };
      return [
        diagram('d1', 'half', [
          o1,
          ball('b', o1),
          x('x1', '1', 6.6, 0.6),
          o('o2', '2', 8.6, -2.4),
          x('x2', '2', 9.2, -2),
          line('l1', 'screen', [p(8.6, -2.4), p(6.7, -0.3)], 1, 'o2'),
          line('l2', 'dribble', [p(5.8, 0.6), p(5.9, -2.2), p(9, -2.8)], 2, 'o1'),
          line('l3', 'cut', [p(6.7, -0.3), p(11.3, 0.2)], 3),
          line('l4', 'pass', [p(9, -2.8), p(11.3, 0.2)], 4),
        ], t('builtin.pnr.caption')),
      ];
    }
  }
}

const DRILLS: Record<DrillKey, { duration: number; blockTypeId: string; tags: string[] }> = {
  mikan: { duration: 3, blockTypeId: 'bt-warmup', tags: ['layup', 'warmup'] },
  weave: { duration: 8, blockTypeId: 'bt-technique', tags: ['passing', 'transition'] },
  fastbreak: { duration: 10, blockTypeId: 'bt-offense', tags: ['transition', 'offense'] },
  shell: { duration: 12, blockTypeId: 'bt-defense', tags: ['defense'] },
  closeout: { duration: 6, blockTypeId: 'bt-defense', tags: ['defense', 'shooting'] },
  pnr: { duration: 12, blockTypeId: 'bt-offense', tags: ['pickandroll', 'offense'] },
};

function drillContent(key: DrillKey, t: T): DrillContent {
  const d = DRILLS[key];
  return {
    title: t(`builtin.${key}.title`),
    tags: d.tags.map((tag) => t(`builtin.tags.${tag}`)),
    defaultDuration: d.duration,
    blockTypeId: d.blockTypeId,
    instructions: t(`builtin.${key}.instructions`),
    material: t(`builtin.${key}.material`),
    playersNeeded: t(`builtin.${key}.players`),
    diagrams: drillDiagrams(key, t),
    images: [],
    updatedAt: '2026-11-14T00:00:00.000Z',
  };
}

// ---------- sessions ----------

let blockSeq = 0;
function fromDrill(key: DrillKey, t: T, duration: number): Block {
  const c = drillContent(key, t);
  return {
    id: `b${++blockSeq}`,
    kind: 'block',
    title: c.title,
    duration,
    blockTypeId: c.blockTypeId,
    instructions: c.instructions,
    material: c.material,
    playersNeeded: c.playersNeeded,
    diagrams: c.diagrams,
    images: [],
  };
}

function textBlock(key: string, t: T, duration: number, blockTypeId: string): Block {
  return { id: `b${++blockSeq}`, kind: 'block', title: t(`builtin.blocks.${key}.title`), duration, blockTypeId, instructions: t(`builtin.blocks.${key}.instructions`), diagrams: [], images: [] };
}

function session(key: 'standard' | 'short' | 'gameday', items: Block[], t: T): SessionContent {
  return { title: t(`builtin.${key}.title`), startTime: '18:00', description: t(`builtin.${key}.description`), focus: t(`builtin.${key}.focus`), items, updatedAt: '2026-11-14T00:00:00.000Z' };
}

function standardSession(t: T): SessionContent {
  return session(
    'standard',
    [
      fromDrill('mikan', t, 15),
      fromDrill('weave', t, 20),
      textBlock('shootingSeries', t, 15, 'bt-shooting'),
      fromDrill('pnr', t, 25),
      textBlock('scrimmage', t, 15, 'bt-scrimmage'),
    ],
    t,
  );
}

// ---------- all built-in templates ----------

export const BUILTIN_PREFIX = 'builtin-';

export function builtInTemplates(t: T): Template[] {
  blockSeq = 0;
  const tpl = (id: string, kind: Template['kind'], key: string, tags: string[], content: Template['content']): Template => ({
    id: `${BUILTIN_PREFIX}${id}`,
    teamId: null,
    builtIn: true,
    kind,
    name: t(`builtin.${key}.title`),
    description: t(`builtin.${key}.description`),
    tags: tags.map((tag) => t(`builtin.tags.${tag}`)),
    content,
  });

  const standard = standardSession(t);
  const season: SeasonTemplate = { name: t('builtin.season.title'), weeks: 16, sessionsPerWeek: 2, sessions: [standard] };

  return [
    tpl('standard-90', 'session', 'standard', ['session'], standard),
    tpl(
      'short-60',
      'session',
      'short',
      ['session'],
      session('short', [fromDrill('mikan', t, 10), fromDrill('fastbreak', t, 15), textBlock('shootingSeries', t, 10, 'bt-shooting'), textBlock('scrimmage', t, 25, 'bt-scrimmage')], t),
    ),
    tpl(
      'gameday-45',
      'session',
      'gameday',
      ['session'],
      session('gameday', [fromDrill('mikan', t, 15), textBlock('gameShots', t, 15, 'bt-shooting'), textBlock('systems', t, 15, 'bt-offense')], t),
    ),
    tpl('season-2pw', 'season', 'season', ['season'], season),
    ...(Object.keys(DRILLS) as DrillKey[]).map((key) => tpl(`drill-${key}`, 'drill', key, DRILLS[key].tags, drillContent(key, t))),
  ];
}
