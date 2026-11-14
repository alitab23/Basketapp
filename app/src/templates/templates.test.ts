import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import type { Session, SessionContent } from '../types/model';
import { newBlock } from '../lib/blockOps';
import { isLine } from '../drawing/elements';
import { builtInTemplates } from './builtin';
import {
  drillFromContent,
  isoWeekday,
  scheduleDates,
  seasonFromTemplate,
  seasonTemplateOf,
  sessionContentOf,
  sessionFromContent,
  templateStats,
} from './apply';

const t = (k: string) => i18n.t(k);

describe('scheduleDates', () => {
  it('lays out sessions on the chosen weekdays', () => {
    // 2026-11-16 is a Monday. Tuesdays and Thursdays:
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(scheduleDates('2026-11-16', [2, 4], 4)).toEqual(['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26']);
  });

  it('returns nothing without weekdays', () => {
    expect(scheduleDates('2026-11-16', [], 4)).toEqual([]);
  });
});

describe('using a template creates independent copies', () => {
  const content: SessionContent = {
    title: 'Mall',
    startTime: '18:00',
    items: [newBlock({ title: 'A', duration: 10, diagrams: [{ id: 'd1', court: 'half', elements: [] }] })],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('gives the session and its blocks new ids and places it', () => {
    const s = sessionFromContent(content, { seasonId: 's1', date: '2026-12-01', startTime: '09:00' }, 'tpl1');
    expect(s).toMatchObject({ seasonId: 's1', date: '2026-12-01', startTime: '09:00', fromTemplateId: 'tpl1', title: 'Mall' });
    expect(s.items[0]!.id).not.toBe(content.items[0]!.id);
    expect(s.items[0]!.diagrams[0]!.id).not.toBe('d1');
    s.items[0]!.title = 'Ändrad';
    expect(content.items[0]!.title).toBe('A');
  });

  it('creates a season with sessions on the chosen weekdays', () => {
    const { season, sessions } = seasonFromTemplate({ name: 'S', weeks: 3, sessionsPerWeek: 2, sessions: [content] }, { name: 'U14', startDate: '2026-11-16', weekdays: [2, 4] });
    expect(sessions).toHaveLength(6);
    expect(sessions.every((s) => s.seasonId === season.id)).toBe(true);
    expect(season).toMatchObject({ name: 'U14', startDate: '2026-11-16', endDate: '2026-12-03' });
    expect(new Set(sessions.map((s) => s.id)).size).toBe(6);
  });

  it('makes a drill from drill content', () => {
    const d = drillFromContent({ title: 'X', tags: ['a'], defaultDuration: 5, instructions: '', diagrams: [], images: [], updatedAt: '' });
    expect(d.id).toBeTruthy();
    expect(d.teamId).toBeNull();
  });
});

describe('saving as a template', () => {
  it('keeps the content but not ids, season or date', () => {
    const session: Session = { id: 's', teamId: null, seasonId: 'x', date: '2026-01-01', title: 'P', startTime: '18:00', items: [], updatedAt: '' };
    const c = sessionContentOf(session) as Partial<Session>;
    expect(c.id).toBeUndefined();
    expect(c.seasonId).toBeUndefined();
    expect(c.date).toBeUndefined();
    expect(c.title).toBe('P');
  });

  it('works out weeks and sessions per week from a season', () => {
    const mk = (date: string): Session => ({ id: date, teamId: null, seasonId: 'x', date, title: date, startTime: '18:00', items: [], updatedAt: '' });
    const tpl = seasonTemplateOf(
      { id: 'x', teamId: null, name: 'S', startDate: '2026-01-05', endDate: '2026-01-18', archived: false, updatedAt: '' },
      ['2026-01-08', '2026-01-06', '2026-01-13', '2026-01-15'].map(mk),
    );
    expect(tpl).toMatchObject({ weeks: 3, sessionsPerWeek: 1 });
    expect(tpl.sessions.map((s) => s.title)).toEqual(['2026-01-06', '2026-01-08', '2026-01-13', '2026-01-15']);
  });
});

describe('built-in templates (SPEC.md section 6)', () => {
  const all = builtInTemplates(t);
  const byId = Object.fromEntries(all.map((x) => [x.id.replace('builtin-', ''), x]));

  it('has the ten templates from the table', () => {
    expect(all).toHaveLength(10);
    expect(all.filter((x) => x.kind === 'session')).toHaveLength(3);
    expect(all.filter((x) => x.kind === 'season')).toHaveLength(1);
    expect(all.filter((x) => x.kind === 'drill')).toHaveLength(6);
    expect(all.every((x) => x.builtIn)).toBe(true);
  });

  it('has the right lengths', () => {
    expect(templateStats(byId['standard-90']!).minutes).toBe(90);
    expect(templateStats(byId['short-60']!).minutes).toBe(60);
    expect(templateStats(byId['gameday-45']!).minutes).toBe(45);
    expect(templateStats(byId['season-2pw']!).sessions).toBe(32);
    expect(['mikan', 'weave', 'fastbreak', 'shell', 'closeout', 'pnr'].map((k) => templateStats(byId[`drill-${k}`]!).minutes)).toEqual([3, 8, 10, 12, 6, 12]);
  });

  it('gives every drill a drawing and instructions', () => {
    for (const tpl of all.filter((x) => x.kind === 'drill')) {
      const c = tpl.content as { diagrams: { elements: unknown[] }[]; instructions: string };
      expect(c.diagrams[0]!.elements.length, tpl.id).toBeGreaterThan(2);
      expect(c.instructions.length, tpl.id).toBeGreaterThan(50);
    }
  });

  it('only links arrows and balls to players that exist in the same drawing', () => {
    for (const tpl of all.filter((x) => x.kind === 'drill')) {
      for (const d of (tpl.content as { diagrams: { elements: import('../types/model').CourtElement[] }[] }).diagrams) {
        const ids = new Set(d.elements.map((e) => e.id));
        for (const e of d.elements) {
          if (isLine(e) && e.fromElementId) expect(ids.has(e.fromElementId), `${tpl.id}/${e.id}`).toBe(true);
          if (e.type === 'ball' && e.attachedTo) expect(ids.has(e.attachedTo), `${tpl.id}/${e.id}`).toBe(true);
        }
      }
    }
  });

  it('follows the language', async () => {
    await i18n.changeLanguage('en');
    expect(builtInTemplates(t).find((x) => x.id === 'builtin-standard-90')!.name).toBe('Standard practice 90 min');
    await i18n.changeLanguage('sv');
    expect(builtInTemplates(t).find((x) => x.id === 'builtin-standard-90')!.name).toBe('Standardpass 90 min');
  });
});
