import { marked, type Token, type Tokens } from 'marked';
import { calculateSchedule } from '../lib/schedule';
import { blockTypeName } from '../lib/blockTypeName';
import { formatMinutes } from '../lib/time';
import { diagramScene, toGrey, type Scene } from '../drawing/primitives';
import type { Block, BlockType, Season, Session } from '../types/model';

/**
 * Everything the PDF shows, worked out before rendering (SPEC.md section 7,
 * "Snygg PDF av ett pass"). Pure and serialisable, so it is built on the page
 * (where the database and translations are) and rendered in a Web Worker.
 */

export type Orientation = 'portrait' | 'landscape';
export type PerRow = 1 | 2 | 3;

export interface PdfOptions {
  orientation: Orientation;
  color: boolean;
  instructions: boolean;
  perRow: PerRow;
  language: 'sv' | 'en';
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { orientation: 'portrait', color: true, instructions: true, perRow: 2, language: 'sv' };

/** A run of text; bold and italic come from the markdown. */
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
export type TextBlock = { kind: 'heading'; spans: Span[] } | { kind: 'paragraph'; spans: Span[] } | { kind: 'item'; marker: string; spans: Span[]; depth: number };

export type PdfMedia =
  | { kind: 'diagram'; scene: Scene; caption: string }
  | { kind: 'image'; src: string; width: number; height: number; caption: string };

export interface PdfDrill {
  number: number;
  title: string;
  time: string;
  minutes: string;
  typeName: string;
  color: string;
  text: TextBlock[];
  facts: { label: string; value: string }[];
  /** Media in rows of 1–3; a row is never split over two pages. */
  rows: PdfMedia[][];
}

export interface PdfScheduleRow {
  section: boolean;
  time: string;
  title: string;
  typeName: string;
  color: string;
  minutes: string;
  /** Number of the drill section, when the block has one. */
  number?: number;
}

export interface PdfSession {
  title: string;
  subtitle: string;
  facts: { label: string; value: string }[];
  description: TextBlock[];
  schedule: PdfScheduleRow[];
  total: string;
  drills: PdfDrill[];
}

export interface PdfLabels {
  schedule: string;
  time: string;
  drill: string;
  type: string;
  minutes: string;
  total: string;
  /** "Sida {{page}} av {{total}}" */
  page: string;
}

export interface PdfDocumentModel {
  /** Shown in the page header next to the date. */
  header: string;
  headerDate: string;
  sessions: PdfSession[];
  labels: PdfLabels;
  options: PdfOptions;
  documentTitle: string;
  language: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Photos as data URLs, keyed by localBlobId. */
export type ImageSources = ReadonlyMap<string, string>;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function spans(tokens: readonly Token[] | undefined, style: Omit<Span, 'text'> = {}): Span[] {
  const out: Span[] = [];
  for (const tok of tokens ?? []) {
    switch (tok.type) {
      case 'strong':
        out.push(...spans((tok as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case 'em':
        out.push(...spans((tok as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case 'link':
        out.push(...spans((tok as Tokens.Link).tokens, style));
        break;
      case 'br':
        out.push({ ...style, text: '\n' });
        break;
      case 'text': {
        const t = tok as Tokens.Text;
        if (t.tokens?.length) out.push(...spans(t.tokens, style));
        else out.push({ ...style, text: decode(t.text) });
        break;
      }
      default:
        if ('text' in tok && typeof tok.text === 'string') out.push({ ...style, text: decode(tok.text) });
    }
  }
  return out;
}

/** No line breaks or spaces at the ends of a block (they would add empty lines). */
function tidy(list: Span[]): Span[] {
  const out = list.map((sp) => ({ ...sp }));
  if (out[0]) out[0].text = out[0].text.replace(/^\s+/, '');
  const last = out.at(-1);
  if (last) last.text = last.text.replace(/\s+$/, '');
  return out.filter((sp) => sp.text.length > 0);
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Markdown → headings, paragraphs and list items (what the instructions use). */
export function markdownBlocks(markdown: string): TextBlock[] {
  const out: TextBlock[] = [];
  const walk = (tokens: readonly Token[], depth: number) => {
    for (const tok of tokens) {
      if (tok.type === 'heading') out.push({ kind: 'heading', spans: tidy(spans((tok as Tokens.Heading).tokens)) });
      else if (tok.type === 'paragraph') out.push({ kind: 'paragraph', spans: tidy(spans((tok as Tokens.Paragraph).tokens)) });
      else if (tok.type === 'list') {
        const list = tok as Tokens.List;
        list.items.forEach((item, i) => {
          const marker = list.ordered ? `${Number(list.start || 1) + i}.` : '•';
          const inline = item.tokens.filter((t) => t.type !== 'list');
          const text = inline.flatMap((t) => ('tokens' in t && t.tokens ? spans(t.tokens) : 'text' in t ? [{ text: decode(String(t.text)) }] : []));
          out.push({ kind: 'item', marker, spans: tidy(text), depth });
          walk(item.tokens.filter((t) => t.type === 'list'), depth + 1);
        });
      } else if (tok.type === 'blockquote') walk((tok as Tokens.Blockquote).tokens, depth);
      else if (tok.type === 'code') out.push({ kind: 'paragraph', spans: [{ text: (tok as Tokens.Code).text }] });
    }
  };
  if (markdown.trim()) walk(marked.lexer(markdown, { gfm: true, breaks: true }), 0);
  return out;
}

const hasContent = (b: Block) => !!(b.instructions.trim() || b.material?.trim() || b.playersNeeded?.trim() || b.diagrams.length || b.images.length);

function formatDate(date: string | undefined, language: string): string {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(language === 'en' ? 'en-GB' : 'sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function sessionModel(session: Session, blockTypes: readonly BlockType[], images: ImageSources, options: PdfOptions, t: Translate): PdfSession {
  const types = new Map(blockTypes.map((b) => [b.id, b]));
  const colour = (c: string) => (options.color ? c : toGrey(c));
  const schedule = calculateSchedule(session.startTime, session.items);
  const minutes = (m: number) => formatMinutes(m, (k, o) => t(k, o));
  const style = 'white' as const;

  const drills: PdfDrill[] = [];
  const rows: PdfScheduleRow[] = session.items.map((b, i) => {
    const r = schedule.rows[i]!;
    const type = b.blockTypeId ? types.get(b.blockTypeId) : undefined;
    const typeName = type ? blockTypeName(type, t) : '';
    const color = colour(type?.color ?? '#94A3B8');
    if (b.kind === 'section') {
      return { section: true, time: r.startLabel, title: b.title, typeName: '', color, minutes: r.sectionMinutes ? minutes(r.sectionMinutes) : '' };
    }
    let number: number | undefined;
    if (hasContent(b)) {
      number = drills.length + 1;
      const media: PdfMedia[] = [
        ...b.diagrams.map((d, n): PdfMedia => ({ kind: 'diagram', scene: diagramScene(d, { style, mono: !options.color }), caption: d.caption || t('drawing.step', { n: n + 1 }) })),
        ...b.images.flatMap((img): PdfMedia[] => {
          const src = img.localBlobId ? images.get(img.localBlobId) : img.url;
          return src ? [{ kind: 'image', src, width: img.width || 4, height: img.height || 3, caption: img.caption ?? '' }] : [];
        }),
      ];
      drills.push({
        number,
        title: b.title,
        time: `${r.startLabel}–${r.endLabel}`,
        minutes: minutes(b.duration),
        typeName,
        color,
        text: options.instructions ? markdownBlocks(b.instructions) : [],
        facts: options.instructions
          ? [
              ...(b.material?.trim() ? [{ label: t('block.material'), value: b.material.trim() }] : []),
              ...(b.playersNeeded?.trim() ? [{ label: t('block.playersNeeded'), value: b.playersNeeded.trim() }] : []),
            ]
          : [],
        rows: chunk(media, options.perRow),
      });
    }
    return { section: false, time: `${r.startLabel}–${r.endLabel}`, title: b.title, typeName, color, minutes: minutes(b.duration), number };
  });

  const range = `${schedule.startLabel}–${schedule.endLabel}`;
  const facts = [
    { label: t('session.date'), value: formatDate(session.date, options.language) },
    { label: t('pdf.time'), value: range },
    { label: t('session.location'), value: session.location ?? '' },
    { label: t('session.coach'), value: session.coach ?? '' },
    { label: t('session.focus'), value: session.focus ?? '' },
    { label: t('session.participants'), value: session.participants ? String(session.participants) : '' },
  ].filter((f) => f.value);

  return {
    title: session.title || t('session.untitled'),
    subtitle: [formatDate(session.date, options.language), range].filter(Boolean).join(' · '),
    facts,
    description: options.instructions && session.description ? markdownBlocks(session.description) : [],
    schedule: rows,
    total: minutes(schedule.total),
    drills,
  };
}

export function labelsFor(t: Translate): PdfLabels {
  return {
    schedule: t('pdf.schedule'),
    time: t('pdf.time'),
    drill: t('pdf.drill'),
    type: t('pdf.type'),
    minutes: t('pdf.minutes'),
    total: t('session.total'),
    page: t('pdf.page', { page: '{{page}}', total: '{{total}}' }),
  };
}

/** One session, or a whole season with one part per session (SPEC.md section 7). */
export function documentModel(
  target: { session: Session } | { season: Season; sessions: Session[] },
  blockTypes: readonly BlockType[],
  images: ImageSources,
  options: PdfOptions,
  t: Translate,
): PdfDocumentModel {
  const list = 'session' in target ? [target.session] : target.sessions;
  const sessions = list.map((s) => sessionModel(s, blockTypes, images, options, t));
  if ('session' in target) {
    const s = target.session;
    return { header: sessions[0]!.title, headerDate: s.date ?? '', sessions, labels: labelsFor(t), options, documentTitle: sessions[0]!.title, language: options.language };
  }
  const { season } = target;
  return {
    header: season.name,
    headerDate: `${season.startDate} – ${season.endDate}`,
    sessions,
    labels: labelsFor(t),
    options,
    documentTitle: season.name,
    language: options.language,
  };
}

/** Every photo id a PDF of these sessions needs. */
export function photoIds(sessions: readonly Session[]): string[] {
  return [...new Set(sessions.flatMap((s) => s.items.flatMap((b) => b.images.map((i) => i.localBlobId).filter((x): x is string => !!x))))];
}
