// @vitest-environment node
// Node has a complete Blob (jsdom's lacks arrayBuffer); this file needs no DOM.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BasketappDB } from '../db/schema';
import { clearAll, createDrill, createSeason, createSession, createTemplate, ensureDefaults, moveToTrash, putImage } from '../db/repository';
import { newBlock } from '../lib/blockOps';
import { newId } from '../lib/id';
import { buildExport } from './export';
import { applyImport, planImport } from './applyImport';
import { exportFileName } from './format';
import { migrate, parseImport } from './parse';
import { convertNotes, decodeSessionplan, encodeSessionplanLink, sessionFromSessionplan, type SessionplanData } from './sessionplan';

const identity = (k: string) => k;
let db: BasketappDB;

beforeEach(async () => {
  db = new BasketappDB(`test-${newId()}`);
  await db.open();
  await ensureDefaults(db, identity);
});
afterEach(async () => {
  await db.delete();
});

async function fill() {
  const season = await createSeason(db, { name: 'U16', startDate: '2026-08-01', endDate: '2027-04-30' });
  const imageId = await putImage(db, new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/png' }));
  const block = newBlock({
    title: 'Shell',
    duration: 12,
    diagrams: [{ id: 'd', court: 'half', elements: [{ id: 'o1', type: 'offense', x: 8, y: 0, label: '1' }, { id: 'l', type: 'cut', points: [{ x: 8, y: 0 }, { x: 10, y: 2 }], curved: false, fromElementId: 'o1' }] }],
    images: [{ id: 'att', fileName: 'a.png', mime: 'image/png', width: 1, height: 1, localBlobId: imageId }],
  });
  const session = await createSession(db, { title: 'Tisdag', seasonId: season.id, date: '2026-09-01', items: [block] });
  const drill = await createDrill(db, { title: 'Closeout', tags: ['försvar'] });
  const tpl = await createTemplate(db, { kind: 'drill', name: 'Mall', tags: [], content: { title: 'x', tags: [], defaultDuration: 5, instructions: '', diagrams: [], images: [], updatedAt: '' } });
  const trashed = await createSession(db, { title: 'Raderad' });
  await moveToTrash(db, 'session', trashed.id);
  return { season, session, drill, tpl, imageId };
}

describe('export', () => {
  it('names the file basketapp-<title>-<date>.json', () => {
    expect(exportFileName('Tisdagspass Hall Ö', new Date(2026, 10, 14))).toBe('basketapp-tisdagspass-hall-o-2026-11-14.json');
  });

  it('exports everything except the trash, with the envelope and photos as base64', async () => {
    await fill();
    const f = await buildExport(db, 'all');
    expect(f).toMatchObject({ format: 'basketapp', version: 1, scope: 'all' });
    expect([f.seasons.length, f.sessions.length, f.drills.length, f.templates.length, f.images.length]).toEqual([1, 1, 1, 1, 1]);
    expect(f.images[0]!.data).toBe(btoa(String.fromCharCode(1, 2, 3, 250)));
    expect(f.blockTypes).toHaveLength(8);
  });

  it('exports one season with its sessions', async () => {
    const { season } = await fill();
    const f = await buildExport(db, 'season', season.id);
    expect(f.seasons).toHaveLength(1);
    expect(f.sessions.map((s) => s.title)).toEqual(['Tisdag']);
    expect(f.drills).toHaveLength(0);
  });
});

describe('import (acceptance: export all, clear all, import – everything is back)', () => {
  it('brings everything back, including drawings and photos', async () => {
    const { session } = await fill();
    const file = await buildExport(db, 'all');
    const text = JSON.stringify(file);

    await clearAll(db, identity);
    expect(await db.sessions.count()).toBe(0);

    const parsed = parseImport(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    expect(parsed.counts).toEqual({ seasons: 1, sessions: 1, drills: 1, templates: 1, images: 1 });
    await applyImport(db, parsed.file, 'replace');

    const back = (await db.sessions.get(session.id))!;
    expect(back.items[0]!.diagrams[0]!.elements).toHaveLength(2);
    const blobId = back.items[0]!.images[0]!.localBlobId!;
    const blob = (await db.images.get(blobId))!.blob;
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    expect(await db.drills.count()).toBe(1);
    expect(await db.templates.count()).toBe(1);
  });

  it('adds copies with new ids by default, keeping links inside the file', async () => {
    const { season, session } = await fill();
    const file = await buildExport(db, 'season', season.id);
    await applyImport(db, file, 'copies');
    const sessions = await db.sessions.toArray();
    const copy = sessions.find((s) => s.title === 'Tisdag' && s.id !== session.id)!;
    expect(copy).toBeDefined();
    expect(copy.seasonId).not.toBe(season.id);
    expect(await db.seasons.get(copy.seasonId!)).toMatchObject({ name: 'U16' });
    // The photo was copied under a new id.
    expect(copy.items[0]!.images[0]!.localBlobId).not.toBe(session.items[0]!.images[0]!.localBlobId);
    expect(await db.images.count()).toBe(2);
  });

  it('keeps a single exported session in its season when that season exists here', () => {
    const plan = planImport(
      { format: 'basketapp', version: 1, exportedAt: '', scope: 'session', blockTypes: [], seasons: [], drills: [], templates: [], images: [], sessions: [{ id: 's', teamId: null, seasonId: 'here', title: 'x', startTime: '18:00', items: [], updatedAt: '' }] },
      'copies',
      new Set(['here']),
    );
    expect(plan.sessions[0]!.seasonId).toBe('here');
    expect(planImport({ ...{ format: 'basketapp', version: 1, exportedAt: '', scope: 'session', blockTypes: [], seasons: [], drills: [], templates: [], images: [] }, sessions: [{ id: 's', teamId: null, seasonId: 'gone', title: 'x', startTime: '18:00', items: [], updatedAt: '' }] } as never, 'copies', new Set()).sessions[0]!.seasonId).toBeNull();
  });
});

describe('import errors (SPEC.md section 7)', () => {
  it('rejects text that is not JSON', () => {
    expect(parseImport('{nope')).toEqual({ ok: false, error: { code: 'invalidJson' } });
  });

  it('rejects JSON that is not a Basketapp file', () => {
    expect(parseImport('{"hello": 1}')).toEqual({ ok: false, error: { code: 'notBasketapp' } });
  });

  it('rejects a newer version with a clear message', () => {
    expect(parseImport(JSON.stringify({ format: 'basketapp', version: 99 }))).toEqual({ ok: false, error: { code: 'unknownVersion', version: 99 } });
  });

  it('says where the content is wrong', () => {
    const r = parseImport(JSON.stringify({ format: 'basketapp', version: 1, exportedAt: '', scope: 'all', sessions: [{ id: 1 }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'invalid', detail: expect.stringContaining('sessions.0') });
  });

  it('rejects an empty file', () => {
    expect(parseImport(JSON.stringify({ format: 'basketapp', version: 1, exportedAt: '', scope: 'all' }))).toEqual({ ok: false, error: { code: 'empty' } });
  });

  it('runs migrations up to the current version', () => {
    expect(migrate({ version: 1 })).toEqual({ version: 1 });
    expect(migrate({ version: 0 })).toMatchObject({ code: 'invalid' });
  });

  it('drops unknown fields so nothing unexpected reaches the database', async () => {
    const { session } = await fill();
    const file = await buildExport(db, 'session', session.id);
    (file.sessions[0] as unknown as Record<string, unknown>).evil = '<script>';
    const r = parseImport(JSON.stringify(file));
    if (!r.ok) throw new Error('parse failed');
    expect('evil' in r.file.sessions[0]!).toBe(false);
  });
});

describe('sessionplan import', () => {
  const data: SessionplanData = {
    version: '1.0',
    workshop: { title: 'Workshop', description: '*Viktigt*', date: '2026-09-15', startTime: '09:00', targetDuration: 90 },
    blockTypes: [
      { id: 'input', name: '🎤 Input', color: '#2C8DFE' },
      { id: 'break', name: '☕ Paus', color: '#6B7280' },
    ],
    items: [
      { id: 'i1', type: 'block', blockTypeId: 'input', title: 'Intro', duration: 30, notes: '*bold* and _italic_', material: 'Slides' },
      { id: 'g', type: 'group', title: 'Del 2', duration: 25, children: [{ id: 'i2', type: 'block', blockTypeId: 'break', title: 'Kaffe', duration: 15, notes: '', material: '' }, { id: 'i3', type: 'block', title: 'Diskussion', duration: 10 }] },
      { id: 'b', type: 'breakout', title: 'Grupper', duration: 20, children: [{ id: 'l1', type: 'block', title: 'A', duration: 20, laneIndex: 0 }, { id: 'l2', type: 'block', title: 'B', duration: 15, laneIndex: 1 }] },
    ],
  };

  it('reads a share link (#data=v2: + lz-string) and JSON', () => {
    const link = encodeSessionplanLink(data);
    expect(link).toMatch(/#data=v2:/);
    expect(decodeSessionplan(link)).toEqual(data);
    expect(decodeSessionplan(JSON.stringify(data))).toEqual(data);
    expect(decodeSessionplan('```json\n' + JSON.stringify(data) + '\n```')).toEqual(data);
    expect(decodeSessionplan('nonsense')).toBeNull();
  });

  it('reads the older base64 link', () => {
    const legacy = `https://sessionplan.de/#data=${btoa(encodeURIComponent(JSON.stringify(data)))}`;
    expect(decodeSessionplan(legacy)?.workshop.title).toBe('Workshop');
  });

  it('turns it into a session: groups become headings, breakouts one block', () => {
    const { session, blockTypes } = sessionFromSessionplan(data, 'x');
    expect(session).toMatchObject({ title: 'Workshop', date: '2026-09-15', startTime: '09:00', maxDuration: 90, description: '**Viktigt**' });
    expect(session.items.map((b) => [b.kind, b.title, b.duration])).toEqual([
      ['block', 'Intro', 30],
      ['section', 'Del 2', 0],
      ['block', 'Kaffe', 15],
      ['block', 'Diskussion', 10],
      ['block', 'Grupper', 20],
    ]);
    expect(session.items[0]).toMatchObject({ blockTypeId: 'sp-input', material: 'Slides', instructions: '**bold** and _italic_' });
    expect(session.items[4]!.instructions).toContain('**1.** A (20 min)');
    expect(blockTypes.map((b) => b.name)).toEqual(['🎤 Input', '☕ Paus']);
  });

  it('is detected by the importer, from a link or a file', () => {
    const fromLink = parseImport(encodeSessionplanLink(data));
    expect(fromLink).toMatchObject({ ok: true, source: 'sessionplan', title: 'Workshop', counts: { sessions: 1 } });
    expect(parseImport(JSON.stringify(data))).toMatchObject({ ok: true, source: 'sessionplan' });
  });

  it('converts sessionplan bold to Markdown bold', () => {
    expect(convertNotes('*a* **b** _c_')).toBe('**a** **b** _c_');
  });
});
