import type { BasketappDB } from './schema';
import { buildDefaultBlockTypes } from './defaults';
import { newId } from '../lib/id';
import { cloneBlocks, imageIdsIn } from '../lib/clone';
import type { Drill, Season, Session, Template } from '../types/model';

/**
 * All IndexedDB access goes through these functions; components never call
 * Dexie directly. Each function takes the database so tests can use their own.
 */

const SEEDED_KEY = 'defaultBlockTypesSeeded';
const now = () => new Date().toISOString();

/** Items in the trash are removed for good after this many days (SPEC.md section 6). */
export const TRASH_DAYS = 30;

const live = <T extends { deletedAt?: string }>(x: T) => !x.deletedAt;
const visible = <T extends { deletedAt?: string; archived?: boolean }>(x: T) => !x.deletedAt && !x.archived;

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

/** Deletes for good. In the app, use `moveToTrash` instead. */
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
  const copy: Session = { ...structuredClone(original), ...overrides, id: newId(), items: cloneBlocks(original.items), updatedAt: now() };
  delete copy.deletedAt;
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

/** Most recently changed first, as on the start page. Archived and trashed sessions are left out. */
export async function listRecentSessions(db: BasketappDB, limit = 50): Promise<Session[]> {
  return (await listAllSessions(db)).slice(0, limit);
}

/** All sessions not archived or in the trash, most recently changed first. */
export async function listAllSessions(db: BasketappDB): Promise<Session[]> {
  return (await db.sessions.orderBy('updatedAt').reverse().toArray()).filter(visible);
}

/** Sessions in a season by date and start time; sessions without a date last. */
export async function listSeasonSessions(db: BasketappDB, seasonId: string): Promise<Session[]> {
  const sessions = await db.sessions.where('seasonId').equals(seasonId).toArray();
  return sessions.filter(live).sort(compareByDate);
}

export function compareByDate(a: Session, b: Session): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title);
}

// ---------- Images ----------

/** Stores image data and returns its id (ImageAttachment.localBlobId). */
export async function putImage(db: BasketappDB, blob: Blob, id: string = newId()): Promise<string> {
  await db.images.put({ id, blob, createdAt: now() });
  return id;
}

export async function getImageBlob(db: BasketappDB, id: string): Promise<Blob | undefined> {
  return (await db.images.get(id))?.blob;
}

/** Removes stored photos that no session, drill or template uses any more (also not in the trash). */
export async function removeUnusedImages(db: BasketappDB): Promise<number> {
  const used = new Set<string>();
  for (const table of [db.sessions, db.drills, db.templates] as const) {
    for (const row of await (table as typeof db.sessions).toArray()) imageIdsIn(row, used);
  }
  const unused = (await db.images.toCollection().primaryKeys()).filter((id) => !used.has(id));
  await db.images.bulkDelete(unused);
  return unused.length;
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

/** Seasons not archived or in the trash. */
export async function listSeasons(db: BasketappDB): Promise<Season[]> {
  return (await db.seasons.orderBy('updatedAt').reverse().toArray()).filter(visible);
}

/** A copy of a season with copies of all its sessions. */
export async function duplicateSeason(db: BasketappDB, id: string, name: string): Promise<Season | undefined> {
  const original = await db.seasons.get(id);
  if (!original) return undefined;
  const season = await createSeason(db, { ...original, name, archived: false, deletedAt: undefined });
  for (const s of await listSeasonSessions(db, id)) await duplicateSession(db, s.id, { seasonId: season.id });
  return season;
}

// ---------- Drills (the Library's exercises) ----------

export async function createDrill(db: BasketappDB, init: Partial<Omit<Drill, 'id' | 'updatedAt'>> & Pick<Drill, 'title'>): Promise<Drill> {
  const drill: Drill = {
    teamId: null,
    tags: [],
    defaultDuration: 10,
    instructions: '',
    diagrams: [],
    images: [],
    ...init,
    id: newId(),
    updatedAt: now(),
  };
  await db.drills.add(drill);
  return drill;
}

export function getDrill(db: BasketappDB, id: string): Promise<Drill | undefined> {
  return db.drills.get(id);
}

export async function saveDrill(db: BasketappDB, drill: Drill): Promise<Drill> {
  const stored = { ...drill, updatedAt: now() };
  await db.drills.put(stored);
  return stored;
}

/** Drills not archived or in the trash, most recently changed first. */
export async function listDrills(db: BasketappDB): Promise<Drill[]> {
  return (await db.drills.orderBy('updatedAt').reverse().toArray()).filter(visible);
}

// ---------- Templates (the team's own; built-in ones live in code) ----------

export async function createTemplate(db: BasketappDB, init: Omit<Template, 'id' | 'teamId' | 'builtIn' | 'updatedAt'>): Promise<Template> {
  const template: Template = { teamId: null, ...structuredClone(init), builtIn: false, id: newId(), updatedAt: now() };
  await db.templates.add(template);
  return template;
}

export async function listOwnTemplates(db: BasketappDB): Promise<Template[]> {
  return (await db.templates.toArray()).filter(live).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

// ---------- The whole Library ----------

/** Everything not in the trash, archived included (the Library can show archived items). */
export async function listLibrary(db: BasketappDB) {
  const [seasons, sessions, drills, templates] = await Promise.all([
    db.seasons.toArray(),
    db.sessions.toArray(),
    db.drills.toArray(),
    db.templates.toArray(),
  ]);
  return { seasons: seasons.filter(live), sessions: sessions.filter(live), drills: drills.filter(live), templates: templates.filter(live) };
}

/** Adds already-built objects (from templates or import). */
export async function addSession(db: BasketappDB, session: Session): Promise<void> {
  await db.sessions.add(session);
}
export async function addDrill(db: BasketappDB, drill: Drill): Promise<void> {
  await db.drills.add(drill);
}
export async function addSeasonWithSessions(db: BasketappDB, season: Season, sessions: Session[]): Promise<void> {
  await db.transaction('rw', db.seasons, db.sessions, async () => {
    await db.seasons.add(season);
    await db.sessions.bulkAdd(sessions);
  });
}

// ---------- Archive and trash (SPEC.md section 6) ----------

export type LibraryKind = 'season' | 'session' | 'drill' | 'template';

function tableFor(db: BasketappDB, kind: LibraryKind) {
  return { season: db.seasons, session: db.sessions, drill: db.drills, template: db.templates }[kind] as unknown as typeof db.sessions;
}

export async function setArchived(db: BasketappDB, kind: Exclude<LibraryKind, 'template'>, id: string, archived: boolean): Promise<void> {
  await tableFor(db, kind).update(id, { archived, updatedAt: now() });
}

/**
 * Moves an item to the trash. A season takes its sessions with it, marked
 * with the same time so they come back together.
 */
export async function moveToTrash(db: BasketappDB, kind: LibraryKind, id: string, at: string = now()): Promise<void> {
  await db.transaction('rw', db.seasons, db.sessions, db.drills, db.templates, async () => {
    await tableFor(db, kind).update(id, { deletedAt: at });
    if (kind === 'season') {
      const sessions = (await db.sessions.where('seasonId').equals(id).toArray()).filter(live);
      await Promise.all(sessions.map((s) => db.sessions.update(s.id, { deletedAt: at })));
    }
  });
}

export async function restoreFromTrash(db: BasketappDB, kind: LibraryKind, id: string): Promise<void> {
  await db.transaction('rw', db.seasons, db.sessions, db.drills, db.templates, async () => {
    const item = (await tableFor(db, kind).get(id)) as { deletedAt?: string } | undefined;
    if (!item?.deletedAt) return;
    await tableFor(db, kind).update(id, { deletedAt: undefined });
    if (kind === 'season') {
      const sessions = (await db.sessions.where('seasonId').equals(id).toArray()).filter((s) => s.deletedAt === item.deletedAt);
      await Promise.all(sessions.map((s) => db.sessions.update(s.id, { deletedAt: undefined })));
    }
  });
}

export interface TrashItem {
  kind: LibraryKind;
  id: string;
  title: string;
  deletedAt: string;
}

/** Everything in the trash, newest first. Sessions that left with their season are shown under the season. */
export async function listTrash(db: BasketappDB): Promise<TrashItem[]> {
  const seasons = (await db.seasons.toArray()).filter((s) => s.deletedAt);
  const seasonDeleted = new Map(seasons.map((s) => [s.id, s.deletedAt]));
  const items: TrashItem[] = [
    ...seasons.map((s) => ({ kind: 'season' as const, id: s.id, title: s.name, deletedAt: s.deletedAt! })),
    ...(await db.sessions.toArray())
      .filter((s) => s.deletedAt && !(s.seasonId && seasonDeleted.get(s.seasonId) === s.deletedAt))
      .map((s) => ({ kind: 'session' as const, id: s.id, title: s.title, deletedAt: s.deletedAt! })),
    ...(await db.drills.toArray()).filter((d) => d.deletedAt).map((d) => ({ kind: 'drill' as const, id: d.id, title: d.title, deletedAt: d.deletedAt! })),
    ...(await db.templates.toArray()).filter((t) => t.deletedAt).map((t) => ({ kind: 'template' as const, id: t.id, title: t.name, deletedAt: t.deletedAt! })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Deletes one trashed item for good (a season with the sessions that were trashed with it). */
export async function deleteForever(db: BasketappDB, kind: LibraryKind, id: string): Promise<void> {
  await db.transaction('rw', db.seasons, db.sessions, db.drills, db.templates, async () => {
    const item = (await tableFor(db, kind).get(id)) as { deletedAt?: string } | undefined;
    if (kind === 'season' && item?.deletedAt) {
      const sessions = (await db.sessions.where('seasonId').equals(id).toArray()).filter((s) => s.deletedAt === item.deletedAt);
      await db.sessions.bulkDelete(sessions.map((s) => s.id));
    }
    await tableFor(db, kind).delete(id);
  });
  await removeUnusedImages(db);
}

/** Removes items that have been in the trash longer than TRASH_DAYS (or everything with `all`). */
export async function purgeTrash(db: BasketappDB, { all = false, at = new Date() }: { all?: boolean; at?: Date } = {}): Promise<number> {
  const cutoff = new Date(at.getTime() - TRASH_DAYS * 24 * 3600 * 1000).toISOString();
  const old = (x: { deletedAt?: string }) => !!x.deletedAt && (all || x.deletedAt < cutoff);
  let removed = 0;
  await db.transaction('rw', db.seasons, db.sessions, db.drills, db.templates, async () => {
    for (const table of [db.seasons, db.sessions, db.drills, db.templates] as unknown as (typeof db.sessions)[]) {
      const ids = (await table.toArray()).filter(old).map((x) => x.id);
      removed += ids.length;
      await table.bulkDelete(ids);
    }
  });
  await removeUnusedImages(db);
  return removed;
}

// ---------- Clear all ----------

/** "Rensa allt": empties the whole local database, then puts back the default block types. */
export async function clearAll(db: BasketappDB, translate: (key: string) => string): Promise<void> {
  await db.transaction('rw', [db.seasons, db.sessions, db.drills, db.templates, db.blockTypes, db.images, db.meta], async () => {
    await Promise.all([db.seasons, db.sessions, db.drills, db.templates, db.blockTypes, db.images, db.meta].map((t) => t.clear()));
  });
  await ensureDefaults(db, translate);
}
