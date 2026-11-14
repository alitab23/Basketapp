// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { newBlock } from '../lib/blockOps';
import { blockTypeName } from '../lib/blockTypeName';
import { buildDefaultBlockTypes } from '../db/defaults';
import type { Session } from '../types/model';
import { BOM, csvCell, sessionsToCsv } from './csv';
import { CURRENT_VERSION, FORMAT, type ExportFile } from './format';
import { parseImport } from './parse';
import { createShareLink, decodeShareLink, encodeShareLink, isShareLink, withoutPhotos } from './shareLink';
import sv from '../i18n/sv.json';
import en from '../i18n/en.json';

const tr = (tree: unknown) => (key: string) =>
  (key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)?.[p], tree) as string) ?? key;
const tSv = tr(sv);
const tEn = tr(en);
const types = buildDefaultBlockTypes(tSv);

function session(over: Partial<Session> = {}): Session {
  return {
    id: 's1',
    teamId: null,
    seasonId: null,
    title: 'Tisdag',
    date: '2026-09-01',
    startTime: '18:00',
    items: [
      newBlock({ kind: 'section', title: 'Uppvärmning', duration: 0 }),
      newBlock({ title: 'Mikan', duration: 10, blockTypeId: 'bt-warmup', instructions: '## Syfte\n- "Snabba" fötter; höger' }),
      newBlock({ title: 'Shell', duration: 15, blockTypeId: 'bt-defense' }),
    ],
    updatedAt: '2026-09-01T10:00:00Z',
    ...over,
  };
}

const file = (s: Session, images: ExportFile['images'] = []): ExportFile => ({
  format: FORMAT,
  version: CURRENT_VERSION,
  exportedAt: '2026-11-14T17:00:00Z',
  scope: 'session',
  blockTypes: types,
  seasons: [],
  sessions: [s],
  drills: [],
  templates: [],
  images,
});

describe('CSV', () => {
  it('quotes cells with separators, quotes and line breaks', () => {
    expect(csvCell('Mikan')).toBe('Mikan');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('säg "hej"')).toBe('"säg ""hej"""');
    expect(csvCell('rad 1\nrad 2')).toBe('"rad 1\nrad 2"');
    expect(csvCell(undefined)).toBe('');
  });

  it('gives one row per block with start, end, title, type, minutes and instruction', () => {
    const csv = sessionsToCsv([session()], types, tSv);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Start;Slut;Titel;Blocktyp;Minuter;Instruktion');
    expect(lines[1]).toBe('18:00;;Uppvärmning;;;');
    expect(lines[2]).toBe('18:00;18:10;Mikan;Uppvärmning;10;"## Syfte\n- ""Snabba"" fötter; höger"');
    expect(lines[3]).toBe('18:10;18:25;Shell;Försvar;15;');
  });

  it('uses the chosen language for headings and default block types', () => {
    const lines = sessionsToCsv([session()], types, tEn).slice(1).split('\r\n');
    expect(lines[0]).toBe('Start;End;Title;Block type;Minutes;Instruction');
    expect(lines[3]).toBe('18:10;18:25;Shell;Defense;15;');
  });

  it('adds date and session for a season', () => {
    const lines = sessionsToCsv([session(), session({ id: 's2', title: 'Torsdag', date: '2026-09-03' })], types, tSv).slice(1).split('\r\n');
    expect(lines[0]).toBe('Datum;Pass;Start;Slut;Titel;Blocktyp;Minuter;Instruktion');
    expect(lines[4]).toBe('2026-09-03;Torsdag;18:00;;Uppvärmning;;;');
  });

  it('keeps a renamed default block type as the user wrote it', () => {
    expect(blockTypeName({ id: 'bt-defense', name: 'Zonförsvar' }, tEn)).toBe('Zonförsvar');
    expect(blockTypeName({ id: 'bt-defense', name: 'Försvar' }, tEn)).toBe('Defense');
  });
});

describe('share link', () => {
  it('round-trips a session through #data=v1:', () => {
    const s = session();
    const url = encodeShareLink('https://basketapp.se/pass/s1', file(s));
    expect(url.startsWith('https://basketapp.se/pass/s1#data=v1:')).toBe(true);
    expect(isShareLink(url)).toBe(true);
    const back = JSON.parse(decodeShareLink(url)!) as ExportFile;
    expect(back.sessions[0]).toEqual(s);
    // Only the block types the session uses travel in the link.
    expect(back.blockTypes.map((b) => b.id).sort()).toEqual(['bt-defense', 'bt-warmup']);
  });

  it('is imported as a link with the session title', () => {
    const result = parseImport(encodeShareLink('https://x.se/', file(session())));
    expect(result).toMatchObject({ ok: true, source: 'link', title: 'Tisdag' });
  });

  it('gives a clear error for a broken link', () => {
    expect(parseImport('https://x.se/#data=v1:%%%')).toMatchObject({ ok: false, error: { code: 'invalid', detail: 'link' } });
  });

  it('does not mistake a sessionplan link for its own', () => {
    expect(isShareLink('https://sessionplan.de/#data=v2:abc')).toBe(false);
  });

  it('leaves out photos when the link would be too long, and keeps drawings', () => {
    const s = session();
    s.items[1] = {
      ...s.items[1]!,
      diagrams: [{ id: 'd', court: 'half', elements: [{ id: 'o', type: 'offense', x: 1, y: 2 }] }],
      images: [{ id: 'a', fileName: 'a.jpg', mime: 'image/jpeg', width: 1, height: 1, localBlobId: 'img1' }],
    };
    // Random data does not compress, like a real photo.
    const photo = Array.from({ length: 6000 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 58))).join('');
    const result = createShareLink('https://x.se/', file(s, [{ id: 'img1', mime: 'image/jpeg', data: photo }]));
    expect(result).toMatchObject({ ok: true, droppedPhotos: true });
    const back = JSON.parse(decodeShareLink((result as { url: string }).url)!) as ExportFile;
    expect(back.images).toEqual([]);
    expect(back.sessions[0]!.items[1]!.images).toEqual([]);
    expect(back.sessions[0]!.items[1]!.diagrams).toHaveLength(1);
  });

  it('refuses when even the link without photos is too long', () => {
    expect(createShareLink('https://x.se/', file(session()), 50)).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('withoutPhotos keeps everything else', () => {
    const f = file(session());
    expect(withoutPhotos(f).sessions).toEqual(f.sessions);
  });
});
