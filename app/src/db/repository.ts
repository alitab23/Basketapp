import type { BasketappDB } from './schema';
import { buildDefaultBlockTypes } from './defaults';
import { newId } from '../lib/id';
import type { Session } from '../types/model';

/**
 * All IndexedDB access goes through these functions; components never call
 * Dexie directly. Each function takes the database so tests can use their own.
 */

const SEEDED_KEY = 'defaultBlockTypesSeeded';

/** Adds the default block types once. Later edits or deletions by the user are kept. */
export async function ensureDefaults(db: BasketappDB, translate: (key: string) => string): Promise<void> {
  await db.transaction('rw', db.meta, db.blockTypes, async () => {
    if (await db.meta.get(SEEDED_KEY)) return;
    await db.blockTypes.bulkPut(buildDefaultBlockTypes(translate));
    await db.meta.put({ key: SEEDED_KEY, value: new Date().toISOString() });
  });
}

export async function createSession(
  db: BasketappDB,
  init: Pick<Session, 'title'> & Partial<Omit<Session, 'id' | 'updatedAt'>>,
): Promise<Session> {
  const session: Session = {
    teamId: null,
    seasonId: null,
    startTime: '18:00',
    items: [],
    ...init,
    id: newId(),
    updatedAt: new Date().toISOString(),
  };
  await db.sessions.add(session);
  return session;
}

export function getSession(db: BasketappDB, id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

/** Most recently changed first, as on the start page. */
export function listRecentSessions(db: BasketappDB, limit = 50): Promise<Session[]> {
  return db.sessions.orderBy('updatedAt').reverse().limit(limit).toArray();
}

export function listBlockTypes(db: BasketappDB) {
  return db.blockTypes.toArray();
}
