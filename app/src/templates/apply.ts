import type { Block, Drill, DrillContent, Season, SeasonTemplate, Session, SessionContent, Template } from '../types/model';
import { newId } from '../lib/id';
import { blockFromDrill, cloneBlocks, cloneDiagram, cloneImage } from '../lib/clone';
import { addDays, fromISODate } from '../lib/dates';
import { compareByDate } from '../db/repository';

/**
 * "Använd template" always creates a new copy with new ids (SPEC.md section 6),
 * so changing the result never changes the template.
 */

const now = () => new Date().toISOString();

export const isSeasonTemplate = (t: Template): t is Template & { content: SeasonTemplate } => t.kind === 'season';
export const isSessionTemplate = (t: Template): t is Template & { content: SessionContent } => t.kind === 'session';
export const isDrillTemplate = (t: Template): t is Template & { content: DrillContent } => t.kind === 'drill';

export interface SessionPlacement {
  seasonId: string | null;
  date?: string;
  startTime?: string;
}

/** A new session from session content (template content, or a session inside a season template). */
export function sessionFromContent(content: SessionContent, placement: SessionPlacement, templateId?: string): Session {
  const copy = structuredClone(content);
  const session: Session = {
    ...copy,
    id: newId(),
    teamId: null,
    seasonId: placement.seasonId,
    startTime: placement.startTime ?? copy.startTime,
    items: cloneBlocks(copy.items),
    updatedAt: now(),
  };
  if (placement.date) session.date = placement.date;
  else delete session.date;
  if (templateId) session.fromTemplateId = templateId;
  delete session.archived;
  delete session.deletedAt;
  return session;
}

export function drillFromContent(content: DrillContent): Drill {
  const copy = structuredClone(content);
  const drill: Drill = {
    ...copy,
    id: newId(),
    teamId: null,
    diagrams: copy.diagrams.map(cloneDiagram),
    images: copy.images.map(cloneImage),
    updatedAt: now(),
  };
  delete drill.archived;
  delete drill.deletedAt;
  return drill;
}

/** A drill template → a block for a session. */
export const blockFromDrillContent = (content: DrillContent): Block => blockFromDrill(content);

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  return ((fromISODate(iso).getDay() + 6) % 7) + 1;
}

/**
 * The dates for `count` sessions from `startDate`, on the chosen weekdays
 * (e.g. [2, 4] = Tuesdays and Thursdays).
 */
export function scheduleDates(startDate: string, weekdays: readonly number[], count: number): string[] {
  if (weekdays.length === 0 || count <= 0) return [];
  const days = new Set(weekdays);
  const out: string[] = [];
  for (let d = startDate; out.length < count; d = addDays(d, 1)) if (days.has(isoWeekday(d))) out.push(d);
  return out;
}

export interface SeasonPlacement {
  name: string;
  startDate: string;
  weekdays: number[];
  startTime?: string;
}

/**
 * A season template → a season with sessions laid out weekly on the chosen
 * weekdays. The template's sessions are used in turn.
 */
export function seasonFromTemplate(tpl: SeasonTemplate, placement: SeasonPlacement, templateId?: string): { season: Season; sessions: Session[] } {
  const count = tpl.weeks * placement.weekdays.length;
  const dates = scheduleDates(placement.startDate, placement.weekdays, count);
  const season: Season = {
    id: newId(),
    teamId: null,
    name: placement.name,
    startDate: placement.startDate,
    endDate: dates.at(-1) ?? placement.startDate,
    archived: false,
    updatedAt: now(),
  };
  const sessions = tpl.sessions.length
    ? dates.map((date, i) => sessionFromContent(tpl.sessions[i % tpl.sessions.length]!, { seasonId: season.id, date, startTime: placement.startTime }, templateId))
    : [];
  return { season, sessions };
}

// ---------- "Spara som template" ----------

function contentOf<T extends { id: string; teamId: unknown; updatedAt: string; deletedAt?: string; archived?: boolean }>(x: T) {
  const copy = structuredClone(x) as Partial<T>;
  delete copy.id;
  delete copy.teamId;
  delete copy.deletedAt;
  delete copy.archived;
  return copy;
}

export function sessionContentOf(session: Session): SessionContent {
  const c = contentOf(session) as Partial<Session>;
  delete c.seasonId;
  delete c.date;
  delete c.fromTemplateId;
  return c as SessionContent;
}

export function drillContentOf(drill: Drill): DrillContent {
  return contentOf(drill) as DrillContent;
}

/** A season and its sessions → a season template (weeks and sessions per week from the dates). */
export function seasonTemplateOf(season: Season, sessions: readonly Session[]): SeasonTemplate {
  const sorted = [...sessions].sort(compareByDate);
  const start = fromISODate(season.startDate).getTime();
  const end = fromISODate(season.endDate).getTime();
  const weeks = Math.max(1, Math.round((end - start) / (7 * 24 * 3600 * 1000)) + 1);
  return {
    name: season.name,
    weeks,
    sessionsPerWeek: Math.max(1, Math.round(sorted.length / weeks)),
    sessions: sorted.map(sessionContentOf),
  };
}

/** Number of blocks and total minutes of a template, for library cards. */
export function templateStats(t: Template): { blocks: number; minutes: number; sessions?: number } {
  const blocks = (items: Block[]) => items.filter((b) => b.kind !== 'section');
  const minutes = (items: Block[]) => blocks(items).reduce((s, b) => s + b.duration, 0);
  if (isSeasonTemplate(t)) {
    const all = t.content.sessions.flatMap((s) => s.items);
    return { blocks: blocks(all).length, minutes: minutes(all), sessions: t.content.weeks * t.content.sessionsPerWeek };
  }
  if (isSessionTemplate(t)) return { blocks: blocks(t.content.items).length, minutes: minutes(t.content.items) };
  if (isDrillTemplate(t)) return { blocks: 1, minutes: t.content.defaultDuration };
  return { blocks: 0, minutes: 0 };
}
