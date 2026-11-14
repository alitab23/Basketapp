import type { BasketappDB } from '../db/schema';
import { newId } from '../lib/id';
import type { Drill, Season, Session, Template } from '../types/model';
import { countsOf, type ExportFile, type ImportCounts } from './format';

export type ImportMode = 'copies' | 'replace';

export function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Replaces every localBlobId using the map (deep). */
function relinkImages<T>(value: T, map: Map<string, string>): T {
  if (map.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, k === 'localBlobId' && typeof x === 'string' ? (map.get(x) ?? x) : walk(x)]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * Prepares what to write (pure, so it can be tested without a database).
 * "copies" (the default) gives everything new ids, so nothing already in the
 * app is touched; "replace" keeps the ids and overwrites items with the same id.
 */
export function planImport(file: ExportFile, mode: ImportMode, existingSeasonIds: ReadonlySet<string>) {
  const now = new Date().toISOString();
  const imageIds = new Map<string, string>();
  if (mode === 'copies') for (const img of file.images) imageIds.set(img.id, newId());

  const seasonIds = new Map<string, string>(file.seasons.map((s) => [s.id, mode === 'copies' ? newId() : s.id]));

  const seasons: Season[] = file.seasons.map((s) => ({ ...s, id: seasonIds.get(s.id)!, teamId: null, deletedAt: undefined, updatedAt: mode === 'copies' ? now : s.updatedAt }));
  const sessions: Session[] = file.sessions.map((s) => {
    const seasonId = s.seasonId === null ? null : (seasonIds.get(s.seasonId) ?? (existingSeasonIds.has(s.seasonId) ? s.seasonId : null));
    return relinkImages({ ...s, id: mode === 'copies' ? newId() : s.id, teamId: null, seasonId, deletedAt: undefined, updatedAt: mode === 'copies' ? now : s.updatedAt }, imageIds);
  });
  const drills: Drill[] = file.drills.map((d) =>
    relinkImages({ ...d, id: mode === 'copies' ? newId() : d.id, teamId: null, deletedAt: undefined, updatedAt: mode === 'copies' ? now : d.updatedAt }, imageIds),
  );
  const templates: Template[] = file.templates
    .filter((t) => !(t.builtIn && t.id.startsWith('builtin-')))
    .map((t) => relinkImages({ ...t, id: mode === 'copies' ? newId() : t.id, teamId: null, builtIn: false, deletedAt: undefined, updatedAt: mode === 'copies' ? now : t.updatedAt }, imageIds));
  const images = file.images.map((img) => ({ id: imageIds.get(img.id) ?? img.id, mime: img.mime, data: img.data }));

  return { seasons, sessions, drills, templates, images, blockTypes: file.blockTypes };
}

/**
 * Writes an import to the local database (works without an account, SPEC.md section 7).
 * Block types are merged: a type that already exists keeps its local name and colour
 * when adding copies, and is overwritten when replacing.
 */
export async function applyImport(db: BasketappDB, file: ExportFile, mode: ImportMode): Promise<{ counts: ImportCounts; sessionIds: string[] }> {
  const existingSeasons = new Set(await db.seasons.toCollection().primaryKeys());
  const plan = planImport(file, mode, existingSeasons);
  const existingTypes = new Set(await db.blockTypes.toCollection().primaryKeys());
  const blockTypes = mode === 'replace' ? plan.blockTypes : plan.blockTypes.filter((bt) => !existingTypes.has(bt.id));

  await db.transaction('rw', [db.seasons, db.sessions, db.drills, db.templates, db.blockTypes, db.images], async () => {
    await db.blockTypes.bulkPut(blockTypes);
    await db.images.bulkPut(plan.images.map((img) => ({ id: img.id, blob: base64ToBlob(img.data, img.mime), createdAt: new Date().toISOString() })));
    await db.seasons.bulkPut(plan.seasons);
    await db.sessions.bulkPut(plan.sessions);
    await db.drills.bulkPut(plan.drills);
    await db.templates.bulkPut(plan.templates);
  });
  return { counts: countsOf(plan), sessionIds: plan.sessions.map((x) => x.id) };
}
