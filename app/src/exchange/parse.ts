import { CURRENT_VERSION, countsOf, FORMAT, type ExportFile, type ImportCounts } from './format';
import { exportFileV1 } from './schema';
import { decodeSessionplan, sessionFromSessionplan } from './sessionplan';

export type ParseError =
  | { code: 'invalidJson' }
  | { code: 'notBasketapp' }
  | { code: 'unknownVersion'; version: number }
  | { code: 'invalid'; detail: string }
  | { code: 'empty' };

export type ParseResult =
  | { ok: true; file: ExportFile; counts: ImportCounts; source: 'basketapp' | 'sessionplan'; title?: string }
  | { ok: false; error: ParseError };

/**
 * Migrations from version n to n + 1. Version 1 is the first; when the format
 * changes, add `1: (f) => …` here and raise CURRENT_VERSION, so older files
 * can still be imported (CLAUDE.md, "Kodregler").
 */
export const MIGRATIONS: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> | ParseError {
  let file = raw;
  let version = typeof file.version === 'number' ? file.version : NaN;
  if (!Number.isInteger(version) || version < 1) return { code: 'invalid', detail: 'version' };
  if (version > CURRENT_VERSION) return { code: 'unknownVersion', version };
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { code: 'invalid', detail: `version ${version}` };
    file = step(file);
    version += 1;
    file.version = version;
  }
  return file;
}

const isError = (x: unknown): x is ParseError => !!x && typeof x === 'object' && 'code' in x;

/**
 * Reads an import file (a Basketapp export, sessionplan JSON or a sessionplan
 * link), validates it and returns what it contains. Runs in a Web Worker.
 */
export function parseImport(text: string, untitled = 'sessionplan'): ParseResult {
  const trimmed = text.trim();
  if (/^https?:\/\//.test(trimmed) || trimmed.includes('#data=')) return fromSessionplan(trimmed, untitled);

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false, error: { code: 'invalidJson' } };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: { code: 'notBasketapp' } };
  const obj = raw as Record<string, unknown>;
  if (obj.format !== FORMAT) {
    return 'workshop' in obj ? fromSessionplan(trimmed, untitled) : { ok: false, error: { code: 'notBasketapp' } };
  }

  const migrated = migrate(obj);
  if (isError(migrated)) return { ok: false, error: migrated };

  const parsed = exportFileV1.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'unknown';
    return { ok: false, error: { code: 'invalid', detail } };
  }
  const file = parsed.data as ExportFile;
  const counts = countsOf(file);
  if (counts.seasons + counts.sessions + counts.drills + counts.templates === 0) return { ok: false, error: { code: 'empty' } };
  return { ok: true, file, counts, source: 'basketapp' };
}

function fromSessionplan(text: string, untitled: string): ParseResult {
  const data = decodeSessionplan(text);
  if (!data) return { ok: false, error: { code: 'invalid', detail: 'sessionplan' } };
  const { session, blockTypes } = sessionFromSessionplan(data, untitled);
  const file: ExportFile = {
    format: FORMAT,
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    scope: 'session',
    blockTypes,
    seasons: [],
    sessions: [session],
    drills: [],
    templates: [],
    images: [],
  };
  return { ok: true, file, counts: countsOf(file), source: 'sessionplan', title: session.title };
}
