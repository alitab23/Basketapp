import LZString from 'lz-string';
import type { Block, BlockType, Session } from '../types/model';
import { newId } from '../lib/id';
import { clampDuration } from '../lib/blockOps';

/**
 * Import from sessionplan.de (SPEC.md section 7, "Extra"). The format comes from
 * sessionplan's open source code: a share link is `#data=v2:` + lz-string
 * (compressToEncodedURIComponent) of the same JSON as its file export, with
 * `version`, `workshop`, `blockTypes`, `persons` and `items`.
 */

export interface SessionplanItem {
  id?: string;
  type?: 'block' | 'group' | 'breakout';
  blockTypeId?: string | null;
  title?: string;
  duration?: number;
  notes?: string;
  material?: string;
  children?: SessionplanItem[];
  laneIndex?: number;
}

export interface SessionplanData {
  version?: string;
  workshop: { title?: string; description?: string; date?: string | null; startTime?: string | null; targetDuration?: number };
  blockTypes?: { id: string; name: string; color: string }[];
  items: SessionplanItem[];
}

export const isSessionplanData = (v: unknown): v is SessionplanData =>
  !!v && typeof v === 'object' && 'workshop' in v && 'items' in v && Array.isArray((v as SessionplanData).items) && typeof (v as SessionplanData).workshop === 'object';

/**
 * Reads a sessionplan link (`…#data=v2:…`, also the older base64 form) or
 * sessionplan JSON text. Returns null when it is neither.
 */
export function decodeSessionplan(input: string): SessionplanData | null {
  const text = input.trim();
  let json: string | null = null;
  const hash = /#data=([^&\s]+)/.exec(text)?.[1] ?? (text.startsWith('v2:') ? text : null);
  if (hash) {
    if (hash.startsWith('v2:')) json = LZString.decompressFromEncodedURIComponent(hash.slice(3));
    else {
      try {
        json = decodeURIComponent(atob(decodeURIComponent(hash)));
      } catch {
        json = null;
      }
    }
  } else {
    // sessionplan may wrap exported JSON in a Markdown code fence.
    json = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  }
  if (!json) return null;
  try {
    const data: unknown = JSON.parse(json);
    return isSessionplanData(data) ? data : null;
  } catch {
    return null;
  }
}

/** sessionplan uses *bold* and _italic_; Markdown uses **bold**. */
export const convertNotes = (notes: string) => notes.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1**$2**');

const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);

/**
 * Converts to one session plus the block types it uses. Groups become a heading
 * row with their blocks; a breakout (parallel lanes) becomes one block as long as
 * its longest lane, listing what happens in each lane.
 */
export function sessionFromSessionplan(data: SessionplanData, fallbackTitle: string): { session: Session; blockTypes: BlockType[] } {
  const typeIds = new Map<string, string>();
  const blockTypes: BlockType[] = (data.blockTypes ?? []).map((bt) => {
    const id = `sp-${bt.id}`;
    typeIds.set(bt.id, id);
    return { id, teamId: null, name: bt.name, icon: 'square', color: /^#[0-9a-f]{6}$/i.test(bt.color) ? bt.color : '#6B7280' };
  });
  const typeOf = (id?: string | null) => (id ? typeIds.get(id) : undefined);

  const toBlock = (item: SessionplanItem, duration = item.duration ?? 0): Block => {
    const b: Block = {
      id: newId(),
      kind: 'block',
      title: item.title?.trim() || '–',
      duration: clampDuration(duration),
      instructions: convertNotes(item.notes ?? ''),
      diagrams: [],
      images: [],
    };
    const bt = typeOf(item.blockTypeId);
    if (bt) b.blockTypeId = bt;
    if (item.material) b.material = item.material;
    return b;
  };

  const items: Block[] = [];
  const walk = (list: SessionplanItem[]) => {
    for (const item of list) {
      if (item.type === 'group') {
        items.push({ id: newId(), kind: 'section', title: item.title?.trim() || '–', duration: 0, instructions: '', diagrams: [], images: [] });
        walk(item.children ?? []);
      } else if (item.type === 'breakout') {
        const children = item.children ?? [];
        const lanes = new Map<number, SessionplanItem[]>();
        for (const c of children) lanes.set(c.laneIndex ?? 0, [...(lanes.get(c.laneIndex ?? 0) ?? []), c]);
        const longest = Math.max(item.duration ?? 0, ...[...lanes.values()].map((l) => l.reduce((s, c) => s + (c.duration ?? 0), 0)));
        const lines = [...lanes.entries()].sort(([a], [b]) => a - b).flatMap(([lane, list]) => [`**${lane + 1}.** ${list.map((c) => `${c.title ?? ''} (${c.duration ?? 0} min)`).join(', ')}`]);
        const block = toBlock(item, longest);
        block.instructions = [block.instructions, ...lines].filter(Boolean).join('\n\n');
        items.push(block);
      } else {
        items.push(toBlock(item));
      }
    }
  };
  walk(data.items);

  const w = data.workshop;
  const session: Session = {
    id: newId(),
    teamId: null,
    seasonId: null,
    title: w.title?.trim() || fallbackTitle,
    startTime: isTime(w.startTime) ? w.startTime.padStart(5, '0') : '18:00',
    items,
    updatedAt: new Date().toISOString(),
  };
  if (typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)) session.date = w.date;
  if (w.description) session.description = convertNotes(w.description);
  if (w.targetDuration && w.targetDuration > 0) session.maxDuration = Math.round(w.targetDuration);
  return { session, blockTypes };
}

/** Makes a sessionplan share link – used by tests and handy for checking the format. */
export function encodeSessionplanLink(data: SessionplanData): string {
  return `https://sessionplan.de/#data=v2:${LZString.compressToEncodedURIComponent(JSON.stringify(data))}`;
}
