import type { BasketappDB } from './schema';
import { buildDefaultBlockTypes } from './defaults';
import { newId } from '../lib/id';
import type { Season, Session } from '../types/model';

/**
 * All IndexedDB access goes through these functions; components never call
 * Dexie directly. Each function takes the database so tests can use their own.
 */

const SEEDED_KEY = 'defaultBlockTypesSeeded';
const now = () => new Date().toISOString();

/** Adds the default block types once. Later edits or deletions by the user are kept. */
export async function ensureDefaults(db: BasketappDB, translate: (key: string) => string): Promise<void> {
  await db.transaction('rw', db.meta, db.blockTypes, async () => {
    if (await db.meta.get(SEEDED_KEY)) return;
    await db.blockTypes.bulkPut(buildDefaultBlockTypes(translate));
    await db.meta.put({ key: SEEDED_KEY, value: now() });
  });
}

export function listBlockTypes(db: BasketappDB) {
  return db.blockTypes.toArray();
}

// ---------- Sessions ----------

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
    updatedAt: now(),
  };
  await db.sessions.add(session);
  return session;
}

export function getSession(db: BasketappDB, id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

/** Saves the whole session and stamps `updatedAt`. Returns the stored version. */
export async function saveSession(db: BasketappDB, session: Session): Promise<Session> {
  const stored = { ...session, updatedAt: now() };
  await db.sessions.put(stored);
  return stored;
}

export async function deleteSession(db: BasketappDB, id: string): Promise<void> {
  await db.sessions.delete(id);
}

/** A copy with new ids for the session and its blocks. */
export async function duplicateSession(
  db: BasketappDB,
  id: string,
  overrides: Partial<Pick<Session, 'title' | 'date' | 'seasonId'>> = {},
): Promise<Session | undefined> {
  const original = await db.sessions.get(id);
  if (!original) return undefined;
  const copy: Session = structuredClone(original);
  copy.id = newId();
  copy.items = copy.items.map((b) => ({
    ...b,
    id: newId(),
    diagrams: b.diagrams.map((d) => ({ ...d, id: newId() })),
    images: b.images.map((i) => ({ ...i, id: newId() })),
  }));
  Object.assign(copy, overrides);
  copy.updatedAt = now();
  await db.sessions.add(copy);
  return copy;
}

export async function moveSession(
  db: BasketappDB,
  id: string,
  changes: Partial<Pick<Session, 'seasonId' | 'date'>>,
): Promise<void> {
  await db.sessions.update(id, { ...changes, updatedAt: now() });
}

/** Most recently changed first, as on the start page. */
export function listRecentSessions(db: BasketappDB, limit = 50): Promise<Session[]> {
  return db.sessions.orderBy('updatedAt').reverse().limit(limit).toArray();
}

/** Sessions in a season by date and start time; sessions without a date last. */
export async function listSeasonSessions(db: BasketappDB, seasonId: string): Promise<Session[]> {
  const sessions = await db.sessions.where('seasonId').equals(seasonId).toArray();
  return sessions.sort(compareByDate);
}

export function compareByDate(a: Session, b: Session): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title);
}

// ---------- Seasons ----------

export async function createSeason(
  db: BasketappDB,
  init: Pick<Season, 'name' | 'startDate' | 'endDate'> & Partial<Omit<Season, 'id' | 'updatedAt'>>,
): Promise<Season> {
  const season: Season = { teamId: null, archived: false, ...init, id: newId(), updatedAt: now() };
  await db.seasons.add(season);
  return season;
}

export function getSeason(db: BasketappDB, id: string): Promise<Season | undefined> {
  return db.seasons.get(id);
}

export async function updateSeason(db: BasketappDB, id: string, patch: Partial<Omit<Season, 'id'>>): Promise<void> {
  await db.seasons.update(id, { ...patch, updatedAt: now() });
}

export function listSeasons(db: BasketappDB): Promise<Season[]> {
  return db.seasons.orderBy('updatedAt').reverse().toArray();
}
