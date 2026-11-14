// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { newBlock } from '../lib/blockOps';
import { buildDefaultBlockTypes } from '../db/defaults';
import type { Diagram, Session } from '../types/model';
import sv from '../i18n/sv.json';
import { chunk, DEFAULT_PDF_OPTIONS, documentModel, markdownBlocks, photoIds, type PdfOptions } from './model';
import { PdfDocument } from './PdfDocument';

const t = (key: string, o?: Record<string, unknown>) => {
  let s = key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)?.[p], sv) as string | undefined;
  if (typeof s !== 'string') return key;
  for (const [k, v] of Object.entries(o ?? {})) s = s.replaceAll(`{{${k}}}`, String(v));
  return s;
};
const types = buildDefaultBlockTypes(t);

// A 4×3 grey PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAADklEQVR4nGNoQAIMODkAXzYSAY5zHKsAAAAASUVORK5CYII=';

const diagram = (n: number): Diagram => ({
  id: `d${n}`,
  court: n % 2 ? 'half' : 'full',
  caption: `Steg ${n}`,
  elements: [
    { id: 'o1', type: 'offense', x: 8, y: 0, label: '1' },
    { id: 'o2', type: 'offense', x: 6, y: 4, label: '2' },
    { id: 'x1', type: 'defense', x: 9, y: 1, label: '1' },
    { id: 'p', type: 'pass', points: [{ x: 8, y: 0 }, { x: 6, y: 4 }], curved: false, order: 1 },
    { id: 'c', type: 'cut', points: [{ x: 6, y: 4 }, { x: 10, y: 2 }, { x: 12, y: 0 }], curved: true },
    { id: 'd', type: 'dribble', points: [{ x: 8, y: 0 }, { x: 10, y: -3 }], curved: false },
    { id: 't', type: 'text', x: 3, y: -5, text: 'Vänd ö', size: 0.6 },
  ],
});

function bigSession(): Session {
  const items = [newBlock({ kind: 'section', title: 'Uppvärmning', duration: 0 })];
  for (let i = 0; i < 10; i++) {
    items.push(
      newBlock({
        title: `Övning ${i + 1}`,
        duration: 8,
        blockTypeId: types[i % types.length]!.id,
        instructions: '## Syfte\nSnabba fötter och **bra** passningar.\n\n## Utförande\n- Två led\n- Byt sida efter varje rep\n  - Vänster hand\n1. Starta\n2. Avsluta',
        material: '1 boll per spelare',
        diagrams: [diagram(i * 2), diagram(i * 2 + 1)],
        images: [{ id: `a${i}`, fileName: 'a.png', mime: 'image/png', width: 400, height: 300, localBlobId: `img${i}`, caption: 'Foto' }],
      }),
    );
  }
  return { id: 's', teamId: null, seasonId: null, title: 'Tisdagspass', date: '2026-09-01', startTime: '18:00', location: 'Hall A', coach: 'Ali', focus: 'Försvar', items, updatedAt: '' };
}

const images = new Map(Array.from({ length: 10 }, (_, i) => [`img${i}`, PNG]));
const render = async (s: Session, options: Partial<PdfOptions> = {}) =>
  renderToBuffer(<PdfDocument model={documentModel({ session: s }, types, images, { ...DEFAULT_PDF_OPTIONS, ...options }, t)} />);

describe('PDF model', () => {
  it('splits pictures into rows of 1–3', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it('reads headings, lists, bold and nesting from the instructions', () => {
    const blocks = markdownBlocks('## Syfte\nText med **fet** del.\n\n- Ett\n  - Under\n1. Först');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'item', 'item', 'item']);
    expect(blocks[1]!.spans).toContainEqual({ text: 'fet', bold: true });
    expect(blocks[3]).toMatchObject({ depth: 1, marker: '•' });
    expect(blocks[4]).toMatchObject({ marker: '1.' });
  });

  it('has the schedule, a numbered section per drill and all pictures', () => {
    const model = documentModel({ session: bigSession() }, types, images, DEFAULT_PDF_OPTIONS, t);
    const s = model.sessions[0]!;
    expect(s.schedule[1]).toMatchObject({ time: '18:00–18:08', title: 'Övning 1', typeName: 'Uppvärmning', minutes: '8 min', number: 1 });
    expect(s.total).toBe('1 h 20 min');
    expect(s.drills).toHaveLength(10);
    // 3 pictures per drill (2 drawings + 1 photo) in rows of 2.
    expect(s.drills[0]!.rows.map((r) => r.length)).toEqual([2, 1]);
    expect(s.drills.flatMap((d) => d.rows.flat())).toHaveLength(30);
    expect(s.facts.map((f) => f.label)).toEqual(['Datum', 'Tid', 'Hall', 'Ansvarig tränare', 'Tema']);
    expect(model.labels.page).toBe('Sida {{page}} av {{total}}');
    expect(photoIds([bigSession()])).toHaveLength(10);
  });

  it('leaves out instructions when asked, and colours in black and white', () => {
    const model = documentModel({ session: bigSession() }, types, images, { ...DEFAULT_PDF_OPTIONS, instructions: false, color: false }, t);
    const d = model.sessions[0]!.drills[0]!;
    expect(d.text).toEqual([]);
    expect(d.facts).toEqual([]);
    expect(d.color).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });
});

describe('PDF', () => {
  it('makes a PDF of 10 drills and 20 drawings well within 3 seconds', async () => {
    const started = performance.now();
    const buf = await render(bigSession());
    const ms = performance.now() - started;
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(ms).toBeLessThan(3000);
    const text = buf.toString('latin1');
    // Several pages, each with its own page object.
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2);
  }, 20000);

  it('works in every layout', async () => {
    for (const options of [{ orientation: 'landscape' as const, perRow: 3 as const }, { perRow: 1 as const, color: false }, { instructions: false }]) {
      const buf = await render(bigSession(), options);
      expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  }, 30000);

  it('handles an empty session', async () => {
    const buf = await render({ ...bigSession(), items: [] });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
