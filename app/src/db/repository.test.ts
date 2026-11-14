import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BasketappDB } from './schema';
import {
  clearAll,
  createDrill,
  createTemplate,
  deleteForever,
  getDrill,
  listAllSessions,
  listDrills,
  listOwnTemplates,
  listSeasons,
  listTrash,
  moveToTrash,
  purgeTrash,
  putImage,
  restoreFromTrash,
  setArchived,
  createSeason,
  createSession,
  deleteSession,
  duplicateSession,
  ensureDefaults,
  getSeason,
  getSession,
  listBlockTypes,
  listRecentSessions,
  listSeasonSessions,
  moveSession,
  saveSession,
  updateSeason,
} from './repository';
import { newBlock } from '../lib/blockOps';
import { DEFAULT_BLOCK_TYPES } from './defaults';
import { newId } from '../lib/id';

const identity = (key: string) => key;
let db: BasketappDB;

beforeEach(async () => {
  db = new BasketappDB(`test-${newId()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('sessions', () => {
  it('saves a session and reads it back unchanged', async () => {
    const created = await createSession(db, { title: 'Tisdagspass', location: 'Hall A' });
    const loaded = await getSession(db, created.id);
    expect(loaded).toEqual(created);
    expect(loaded).toMatchObject({ teamId: null, seasonId: null, startTime: '18:00', items: [] });
  });

  it('survives reopening the database (same as a page reload)', async () => {
    const created = await createSession(db, { title: 'Kvar efter omladdning' });
    db.close();
    const reopened = new BasketappDB(db.name);
    expect(await getSession(reopened, created.id)).toEqual(created);
    reopened.close();
    await db.open();
  });

  it('lists the most recently changed session first', async () => {
    const a = await createSession(db, { title: 'A' });
    await db.sessions.update(a.id, { updatedAt: '2020-01-01T00:00:00.000Z' });
    const b = await createSession(db, { title: 'B' });
    expect((await listRecentSessions(db)).map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it('gives each session a unique id', async () => {
    const a = await createSession(db, { title: 'A' });
    const b = await createSession(db, { title: 'A' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('default block types', () => {
  it('adds the eight basketball block types with their colours', async () => {
    await ensureDefaults(db, identity);
    const types = await listBlockTypes(db);
    expect(types).toHaveLength(8);
    expect(types.find((t) => t.id === 'bt-warmup')).toMatchObject({
      name: 'blockTypes.warmup',
      color: '#F59E0B',
      teamId: null,
    });
  });

  it('does not add them twice', async () => {
    await ensureDefaults(db, identity);
    await ensureDefaults(db, identity);
    expect(await listBlockTypes(db)).toHaveLength(DEFAULT_BLOCK_TYPES.length);
  });

  it('keeps a block type the user deleted deleted', async () => {
    await ensureDefaults(db, identity);
    await db.blockTypes.delete('bt-break');
    await ensureDefaults(db, identity);
    expect(await db.blockTypes.get('bt-break')).toBeUndefined();
  });

  it('runs safely when called twice at the same time', async () => {
    await Promise.all([ensureDefaults(db, identity), ensureDefaults(db, identity)]);
    expect(await listBlockTypes(db)).toHaveLength(8);
  });
});

describe('saving and changing sessions', () => {
  it('saves edits and stamps updatedAt', async () => {
    const s = await createSession(db, { title: 'A' });
    const before = s.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const saved = await saveSession(db, { ...s, title: 'B', items: [newBlock({ title: 'X', duration: 15 })] });
    expect(saved.updatedAt > before).toBe(true);
    expect(await getSession(db, s.id)).toMatchObject({ title: 'B', items: [{ title: 'X', duration: 15 }] });
  });

  it('deletes a session', async () => {
    const s = await createSession(db, { title: 'A' });
    await deleteSession(db, s.id);
    expect(await getSession(db, s.id)).toBeUndefined();
  });

  it('duplicates a session with new ids, leaving the original untouched', async () => {
    const s = await createSession(db, { title: 'A', items: [newBlock({ title: 'X' })] });
    const copy = (await duplicateSession(db, s.id, { title: 'A (kopia)', date: '2026-12-01' }))!;
    expect(copy.id).not.toBe(s.id);
    expect(copy.items[0]!.id).not.toBe(s.items[0]!.id);
    expect(copy).toMatchObject({ title: 'A (kopia)', date: '2026-12-01' });
    expect(await getSession(db, s.id)).toEqual(s);
  });

  it('moves a session to another season and date', async () => {
    const season = await createSeason(db, { name: 'S', startDate: '2026-08-01', endDate: '2027-04-30' });
    const s = await createSession(db, { title: 'A' });
    await moveSession(db, s.id, { seasonId: season.id, date: '2026-09-02' });
    expect(await getSession(db, s.id)).toMatchObject({ seasonId: season.id, date: '2026-09-02' });
  });
});

describe('seasons', () => {
  it('creates and updates a season', async () => {
    const season = await createSeason(db, { name: 'U16', startDate: '2026-08-01', endDate: '2027-04-30' });
    expect(season).toMatchObject({ teamId: null, archived: false });
    await updateSeason(db, season.id, { name: 'U16 Flickor' });
    expect((await getSeason(db, season.id))!.name).toBe('U16 Flickor');
  });

  it('lists a season’s sessions by date and time, undated last', async () => {
    const season = await createSeason(db, { name: 'S', startDate: '2026-08-01', endDate: '2027-04-30' });
    const seasonId = season.id;
    await createSession(db, { title: 'utan datum', seasonId });
    await createSession(db, { title: 'sep 18', seasonId, date: '2026-09-01', startTime: '18:00' });
    await createSession(db, { title: 'aug', seasonId, date: '2026-08-20' });
    await createSession(db, { title: 'sep 09', seasonId, date: '2026-09-01', startTime: '09:00' });
    await createSession(db, { title: 'annan säsong', date: '2026-08-01' });
    expect((await listSeasonSessions(db, seasonId)).map((s) => s.title)).toEqual([
      'aug',
      'sep 09',
      'sep 18',
      'utan datum',
    ]);
  });
});

describe('trash and archive (SPEC.md section 6)', () => {
  it('moves a session to the trash and back', async () => {
    const s = await createSession(db, { title: 'A' });
    await moveToTrash(db, 'session', s.id);
    expect(await listAllSessions(db)).toHaveLength(0);
    expect((await listTrash(db)).map((x) => x.title)).toEqual(['A']);
    await restoreFromTrash(db, 'session', s.id);
    expect(await listAllSessions(db)).toHaveLength(1);
  });

  it('takes a season’s sessions with it and brings them back together', async () => {
    const season = await createSeason(db, { name: 'S', startDate: '2026-08-01', endDate: '2027-04-30' });
    const inSeason = await createSession(db, { title: 'I säsongen', seasonId: season.id });
    const alreadyTrashed = await createSession(db, { title: 'Redan raderat', seasonId: season.id });
    await moveToTrash(db, 'session', alreadyTrashed.id, '2026-01-01T00:00:00.000Z');
    await moveToTrash(db, 'season', season.id);
    expect(await listSeasons(db)).toHaveLength(0);
    // The season shows in the trash; its sessions are listed under it, not separately.
    expect((await listTrash(db)).map((x) => x.title)).toEqual(['S', 'Redan raderat']);
    await restoreFromTrash(db, 'season', season.id);
    expect((await listSeasonSessions(db, season.id)).map((s) => s.id)).toEqual([inSeason.id]);
  });

  it('removes items older than 30 days, and photos nobody uses', async () => {
    const old = await createSession(db, { title: 'Gammal', items: [newBlock({ title: 'x', images: [{ id: 'i', fileName: 'a', mime: 'image/png', width: 1, height: 1, localBlobId: 'blob1' }] })] });
    const recent = await createDrill(db, { title: 'Ny' });
    await putImage(db, new Blob(['x']), 'blob1');
    await putImage(db, new Blob(['y']), 'orphan');
    await moveToTrash(db, 'session', old.id, '2026-01-01T00:00:00.000Z');
    await moveToTrash(db, 'drill', recent.id, '2026-02-20T00:00:00.000Z');
    expect(await db.images.count()).toBe(2);

    const removed = await purgeTrash(db, { at: new Date('2026-02-25T00:00:00.000Z') });
    expect(removed).toBe(1);
    expect(await getSession(db, old.id)).toBeUndefined();
    expect(await getDrill(db, recent.id)).toBeDefined();
    expect(await db.images.count()).toBe(0);
  });

  it('archives without deleting', async () => {
    const d = await createDrill(db, { title: 'D' });
    await setArchived(db, 'drill', d.id, true);
    expect(await listDrills(db)).toHaveLength(0);
    expect((await getDrill(db, d.id))!.archived).toBe(true);
  });

  it('deletes one trashed item for good', async () => {
    const tpl = await createTemplate(db, { kind: 'drill', name: 'T', tags: [], content: { title: 'x', tags: [], defaultDuration: 5, instructions: '', diagrams: [], images: [], updatedAt: '' } });
    await moveToTrash(db, 'template', tpl.id);
    await deleteForever(db, 'template', tpl.id);
    expect(await db.templates.count()).toBe(0);
    expect(await listOwnTemplates(db)).toHaveLength(0);
  });
});

describe('clear all', () => {
  it('empties everything and puts back the default block types', async () => {
    await createSession(db, { title: 'A' });
    await createDrill(db, { title: 'B' });
    await putImage(db, new Blob(['x']));
    await clearAll(db, identity);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.drills.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
    expect(await db.blockTypes.count()).toBe(8);
  });
});
