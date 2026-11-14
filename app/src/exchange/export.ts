import type { BasketappDB } from '../db/schema';
import { getImageBlob, listSeasonSessions } from '../db/repository';
import { imageIdsIn } from '../lib/clone';
import type { Template } from '../types/model';
import { CURRENT_VERSION, exportFileName, FORMAT, type ExportFile, type ExportImage, type ExportScope } from './format';

const live = <T extends { deletedAt?: string }>(x: T) => !x.deletedAt;

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await bytesOf(blob);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(binary);
}

/**
 * Collects what to export. Trashed items are left out; archived ones are kept.
 * `id` is needed for the single-item scopes. `extraTemplate` exports a
 * built-in template (which is not in the database).
 */
export async function buildExport(db: BasketappDB, scope: ExportScope, id?: string, extraTemplate?: Template): Promise<ExportFile> {
  const file: ExportFile = {
    format: FORMAT,
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    blockTypes: await db.blockTypes.toArray(),
    seasons: [],
    sessions: [],
    drills: [],
    templates: [],
    images: [],
  };

  const all = async () => ({
    seasons: (await db.seasons.toArray()).filter(live),
    sessions: (await db.sessions.toArray()).filter(live),
    drills: (await db.drills.toArray()).filter(live),
    templates: (await db.templates.toArray()).filter(live),
  });

  switch (scope) {
    case 'all':
      Object.assign(file, await all());
      break;
    case 'library': {
      const { seasons, sessions, drills } = await all();
      Object.assign(file, { seasons, sessions, drills });
      break;
    }
    case 'templates':
      file.templates = (await all()).templates;
      break;
    case 'season': {
      const season = id ? await db.seasons.get(id) : undefined;
      if (season) {
        file.seasons = [season];
        file.sessions = await listSeasonSessions(db, season.id);
      }
      break;
    }
    case 'session': {
      const s = id ? await db.sessions.get(id) : undefined;
      if (s) file.sessions = [s];
      break;
    }
    case 'drill': {
      const d = id ? await db.drills.get(id) : undefined;
      if (d) file.drills = [d];
      break;
    }
    case 'template': {
      const tpl = extraTemplate ?? (id ? await db.templates.get(id) : undefined);
      // A built-in template becomes an ordinary one when shared.
      if (tpl) file.templates = [{ ...tpl, builtIn: false, teamId: null }];
      break;
    }
  }

  const imageIds = imageIdsIn([file.sessions, file.drills, file.templates]);
  const images: ExportImage[] = [];
  for (const imageId of imageIds) {
    const blob = await getImageBlob(db, imageId);
    if (blob) images.push({ id: imageId, mime: blob.type || 'image/jpeg', data: await blobToBase64(blob) });
  }
  file.images = images;
  return file;
}

export function isEmptyExport(f: ExportFile): boolean {
  return f.seasons.length + f.sessions.length + f.drills.length + f.templates.length === 0;
}

/** Starts a download of the file in the browser. Returns the file name. */
export function downloadExport(file: ExportFile, title: string): string {
  const name = exportFileName(title);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
