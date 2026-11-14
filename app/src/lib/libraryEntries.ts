import type { BlockType, Drill, Season, SeasonTemplate, Session, Template } from '../types/model';
import { templateStats } from '../templates/apply';
import { blockCount, totalMinutes } from './time';
import { searchText, type LibraryEntry } from './search';

const typesIn = (items: { kind: string; blockTypeId?: string }[]) => [...new Set(items.flatMap((b) => (b.kind !== 'section' && b.blockTypeId ? [b.blockTypeId] : [])))];
const blockText = (items: Session['items']) => items.map((b) => `${b.title} ${b.instructions} ${b.material ?? ''}`).join(' ');

export function seasonEntries(seasons: Season[], sessions: Session[]): LibraryEntry[] {
  return seasons.map((s) => {
    const own = sessions.filter((x) => x.seasonId === s.id);
    return {
      kind: 'season',
      id: s.id,
      title: s.name,
      blocks: own.reduce((n, x) => n + blockCount(x.items), 0),
      minutes: own.reduce((n, x) => n + totalMinutes(x.items), 0),
      sessions: own.length,
      updatedAt: s.updatedAt,
      tags: [],
      blockTypeIds: typesIn(own.flatMap((x) => x.items)),
      archived: s.archived,
      text: searchText(s.name, s.description),
    };
  });
}

export function sessionEntries(sessions: Session[]): LibraryEntry[] {
  return sessions.map((s) => ({
    kind: 'session',
    id: s.id,
    title: s.title,
    blocks: blockCount(s.items),
    minutes: totalMinutes(s.items),
    updatedAt: s.updatedAt,
    date: s.date,
    seasonId: s.seasonId,
    tags: [],
    blockTypeIds: typesIn(s.items),
    archived: s.archived,
    text: searchText(s.title, s.focus, s.description, s.location, blockText(s.items)),
  }));
}

export function drillEntries(drills: Drill[]): LibraryEntry[] {
  return drills.map((d) => ({
    kind: 'drill',
    id: d.id,
    title: d.title,
    blocks: 1,
    minutes: d.defaultDuration,
    updatedAt: d.updatedAt,
    tags: d.tags,
    blockTypeIds: d.blockTypeId ? [d.blockTypeId] : [],
    archived: d.archived,
    text: searchText(d.title, d.instructions, d.material, d.playersNeeded, d.tags.join(' ')),
  }));
}

export function templateEntries(templates: Template[]): LibraryEntry[] {
  return templates.map((t) => {
    const stats = templateStats(t);
    const items =
      t.kind === 'drill'
        ? [{ kind: 'block', blockTypeId: (t.content as { blockTypeId?: string }).blockTypeId }]
        : t.kind === 'session'
          ? (t.content as Session).items
          : (t.content as SeasonTemplate).sessions.flatMap((s) => s.items);
    return {
      kind: 'template',
      id: t.id,
      title: t.name,
      blocks: stats.blocks,
      minutes: stats.minutes,
      sessions: stats.sessions,
      updatedAt: t.updatedAt,
      tags: t.tags,
      blockTypeIds: typesIn(items),
      builtIn: t.builtIn,
      templateKind: t.kind,
      text: searchText(t.name, t.description, t.tags.join(' ')),
    };
  });
}

export const blockTypeName = (types: BlockType[], id: string) => types.find((x) => x.id === id)?.name ?? id;
