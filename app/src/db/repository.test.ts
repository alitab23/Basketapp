import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BasketappDB } from './schema';
import {
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
