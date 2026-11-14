import LZString from 'lz-string';
import { imageIdsIn } from '../lib/clone';
import type { ExportFile } from './format';

/**
 * Share links (SPEC.md section 7): the data is compressed into the URL, like
 * sessionplan (`#data=v1:` + lz-string). The part after `#` never reaches a
 * server, so the content stays between the people who have the link.
 * `v1` is the Basketapp format; sessionplan's own links use `v2`.
 */
export const LINK_PREFIX = 'v1:';

/**
 * Longest link we hand out. Browsers accept much longer ones, but chat apps,
 * e-mail and QR codes cut or refuse them well before that.
 */
export const MAX_LINK_LENGTH = 8000;

export type ShareResult =
  | { ok: true; url: string; droppedPhotos: boolean }
  | { ok: false; reason: 'tooLong' };

/** Only the block types the content uses, to keep the link short. */
function compact(file: ExportFile): ExportFile {
  const used = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'blockTypeId' && typeof x === 'string') used.add(x);
        else walk(x);
      }
    }
  };
  walk([file.sessions, file.drills, file.templates]);
  return { ...file, blockTypes: file.blockTypes.filter((b) => used.has(b.id)) };
}

/** The same content without photos (drawings stay, they are small). */
export function withoutPhotos(file: ExportFile): ExportFile {
  const strip = <T>(v: T): T => {
    if (Array.isArray(v)) return v.map(strip) as T;
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'images' && Array.isArray(x) ? [] : strip(x)])) as T;
    }
    return v;
  };
  const { images: _images, ...rest } = file;
  return { ...strip(rest), images: [] };
}

export function encodeShareLink(base: string, file: ExportFile): string {
  return `${base.replace(/#.*$/, '')}#data=${LINK_PREFIX}${LZString.compressToEncodedURIComponent(JSON.stringify(compact(file)))}`;
}

/**
 * Builds a link for the file. When it is too long, photos are left out (the
 * user is told); when even that is too long, the user should send a JSON file
 * or a PDF instead. Storing long links on the server comes with the server (step 6).
 */
export function createShareLink(base: string, file: ExportFile, max = MAX_LINK_LENGTH): ShareResult {
  const full = encodeShareLink(base, file);
  if (full.length <= max) return { ok: true, url: full, droppedPhotos: false };
  const hasPhotos = file.images.length > 0 || imageIdsIn([file.sessions, file.drills, file.templates]).size > 0;
  if (hasPhotos) {
    const small = encodeShareLink(base, withoutPhotos(file));
    if (small.length <= max) return { ok: true, url: small, droppedPhotos: true };
  }
  return { ok: false, reason: 'tooLong' };
}

/** True for a Basketapp share link (or just its `#data=v1:` part). */
export const isShareLink = (text: string) => text.includes(`#data=${LINK_PREFIX}`) || text.trim().startsWith(LINK_PREFIX);

/** The JSON text inside a share link, or null. */
export function decodeShareLink(text: string): string | null {
  const m = /(?:#data=)?v1:([A-Za-z0-9+\-$]+)/.exec(text.trim());
  if (!m?.[1]) return null;
  return LZString.decompressFromEncodedURIComponent(m[1]) || null;
}
