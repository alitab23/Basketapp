import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BasketappDB } from './schema';
import { createSession, ensureDefaults, getSession, listBlockTypes, listRecentSessions } from './repository';
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
