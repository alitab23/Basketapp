import type { LibraryKind } from '../db/repository';

/** One card in the Library, whatever kind it is. */
export interface LibraryEntry {
  kind: LibraryKind;
  id: string;
  title: string;
  blocks: number;
  minutes: number;
  updatedAt?: string;
  tags: string[];
  blockTypeIds: string[];
  seasonId?: string | null;
  date?: string;
  archived?: boolean;
  builtIn?: boolean;
  templateKind?: 'season' | 'session' | 'drill';
  /** Number of sessions, for seasons and season templates. */
  sessions?: number;
  /** Lower-case text searched by the search box. */
  text: string;
}

export type SortBy = 'updated' | 'name';

export interface LibraryFilter {
  query?: string;
  tag?: string;
  blockTypeId?: string;
  seasonId?: string;
  templateKind?: string;
  showArchived?: boolean;
  sort?: SortBy;
}

export const searchText = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(' \n ').toLowerCase();

/**
 * Search, filter and sort (SPEC.md section 6). Pure and fast: 1 000 entries
 * take well under the 100 ms budget, so results update while typing.
 */
export function filterEntries(entries: readonly LibraryEntry[], f: LibraryFilter, locale = 'sv'): LibraryEntry[] {
  const words = (f.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = entries.filter(
    (e) =>
      (f.showArchived || !e.archived) &&
      (!f.tag || e.tags.includes(f.tag)) &&
      (!f.blockTypeId || e.blockTypeIds.includes(f.blockTypeId)) &&
      (!f.seasonId || (f.seasonId === 'none' ? !e.seasonId : e.seasonId === f.seasonId)) &&
      (!f.templateKind || e.templateKind === f.templateKind) &&
      words.every((w) => e.text.includes(w)),
  );
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return out.sort((a, b) =>
    f.sort === 'name' ? collator.compare(a.title, b.title) : (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || collator.compare(a.title, b.title),
  );
}

/** All tags used, sorted. */
export function allTags(entries: readonly LibraryEntry[], locale = 'sv'): string[] {
  return [...new Set(entries.flatMap((e) => e.tags))].sort(new Intl.Collator(locale).compare);
}
