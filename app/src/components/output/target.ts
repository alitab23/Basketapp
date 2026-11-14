import type { BasketappDB } from '../../db/schema';
import { getImageBlob, listSeasonSessions } from '../../db/repository';
import type { BlockType, Season, Session } from '../../types/model';

/** What a PDF or CSV is made of: one session or a whole season. */
export interface OutputTarget {
  kind: 'session' | 'season';
  id: string;
}

export interface OutputData {
  title: string;
  season?: Season;
  sessions: Session[];
  blockTypes: BlockType[];
}

const live = <T extends { deletedAt?: string }>(x: T | undefined): x is T => !!x && !x.deletedAt;

export async function loadTarget(db: BasketappDB, target: OutputTarget): Promise<OutputData | null> {
  const blockTypes = await db.blockTypes.toArray();
  if (target.kind === 'session') {
    const session = await db.sessions.get(target.id);
    return live(session) ? { title: session.title, sessions: [session], blockTypes } : null;
  }
  const season = await db.seasons.get(target.id);
  if (!live(season)) return null;
  return { title: season.name, season, sessions: await listSeasonSessions(db, season.id), blockTypes };
}

/** JPEG and PNG go into the PDF as they are; anything else is converted to JPEG first. */
async function asPdfImage(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/jpeg' || blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.85));
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** The photos a PDF needs, as data URLs keyed by localBlobId. */
export async function loadPhotos(db: BasketappDB, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of ids) {
    const blob = await getImageBlob(db, id);
    if (!blob) continue;
    try {
      out.set(id, await dataUrl(await asPdfImage(blob)));
    } catch {
      /* an unreadable photo is left out rather than stopping the PDF */
    }
  }
  return out;
}
