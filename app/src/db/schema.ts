import Dexie, { type EntityTable } from 'dexie';
import type {
  BlockType,
  Drill,
  MetaEntry,
  Season,
  Session,
  StoredImage,
  Template,
} from '../types/model';

export const DB_NAME = 'basketapp';

/**
 * Local-first storage (SPEC.md section 3). Everything is saved here first;
 * team sync is added in steps 6–7.
 *
 * Note: IndexedDB does not index `null`, so local content (`teamId: null`)
 * is simply absent from the `teamId` index. Query local content with a filter.
 */
export class BasketappDB extends Dexie {
  seasons!: EntityTable<Season, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  drills!: EntityTable<Drill, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  blockTypes!: EntityTable<BlockType, 'id'>;
  images!: EntityTable<StoredImage, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name: string = DB_NAME) {
    // Dexie's optimistic query cache can return stale results for sorted queries
    // after an update that does not touch the sort key (e.g. moving to the trash),
    // so live queries always read from IndexedDB. Reads are local and fast anyway.
    super(name, { cache: 'disabled' });
    // Add new versions below; never change an existing one.
    this.version(1).stores({
      seasons: 'id, teamId, updatedAt, startDate',
      sessions: 'id, teamId, seasonId, updatedAt, date',
      drills: 'id, teamId, updatedAt, *tags',
      templates: 'id, teamId, kind, builtIn',
      blockTypes: 'id, teamId',
      images: 'id',
      meta: 'key',
    });
  }
}

export const db = new BasketappDB();
