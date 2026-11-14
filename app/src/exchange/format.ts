import type { BlockType, Drill, Season, Session, Template } from '../types/model';

/** JSON export envelope (SPEC.md section 7). Change CURRENT_VERSION and add a migration when the format changes. */
export const FORMAT = 'basketapp';
export const CURRENT_VERSION = 1;

export type ExportScope = 'all' | 'library' | 'templates' | 'season' | 'session' | 'drill' | 'template';

/** A photo's data, referred to from ImageAttachment.localBlobId. */
export interface ExportImage {
  id: string;
  mime: string;
  /** base64 without the data: prefix */
  data: string;
}

export interface ExportFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  scope: ExportScope;
  blockTypes: BlockType[];
  seasons: Season[];
  sessions: Session[];
  drills: Drill[];
  templates: Template[];
  images: ExportImage[];
}

export interface ImportCounts {
  seasons: number;
  sessions: number;
  drills: number;
  templates: number;
  images: number;
}

export function countsOf(f: Pick<ExportFile, 'seasons' | 'sessions' | 'drills' | 'templates'> & { images: unknown[] }): ImportCounts {
  return { seasons: f.seasons.length, sessions: f.sessions.length, drills: f.drills.length, templates: f.templates.length, images: f.images.length };
}

/** "basketapp-tisdagspass-2026-11-14.json" */
export function exportFileName(title: string, date = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/ö/g, 'o')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'export';
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `basketapp-${slug}-${d}.json`;
}
