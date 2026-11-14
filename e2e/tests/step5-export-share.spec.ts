import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { deflateSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../../app/dist', import.meta.url));

test.use({ viewport: { width: 1280, height: 1000 } });

const times = (page: Page) => page.getByTestId('block-list').getByTestId('block-time');
const read = async (d: Download) => readFile((await d.path())!);

/** A valid PNG of the given size (solid grey). */
function png(width: number, height: number): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x90)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const diagram = (n: number) => ({
  id: `d${n}`,
  court: n % 2 ? 'half' : 'full',
  caption: `Steg ${n + 1}`,
  elements: [
    { id: `o1-${n}`, type: 'offense', x: 8, y: 0, label: '1' },
    { id: `o2-${n}`, type: 'offense', x: 6, y: 4, label: '2' },
    { id: `x1-${n}`, type: 'defense', x: 9, y: 1, label: '1' },
    { id: `p-${n}`, type: 'pass', points: [{ x: 8, y: 0 }, { x: 6, y: 4 }], curved: false, fromElementId: `o1-${n}` },
    { id: `c-${n}`, type: 'cut', points: [{ x: 6, y: 4 }, { x: 10, y: 2 }, { x: 12, y: 0 }], curved: true },
  ],
});

const photo = (id: string) => ({ id: `att-${id}`, fileName: `${id}.png`, mime: 'image/png', width: 400, height: 300, localBlobId: id, caption: `Foto ${id}` });

/**
 * An export file with one session: `drills` blocks with `diagrams` drawings each,
 * and `photos` photos on the first block.
 */
function exportFile(title: string, drills: number, diagrams: number, photos = 0) {
  const now = '2026-11-14T17:00:00Z';
  const items = Array.from({ length: drills }, (_, i) => ({
    id: `b${i}`,
    kind: 'block',
    title: `Övning ${i + 1}`,
    duration: 8,
    blockTypeId: 'bt-technique',
    instructions: '## Syfte\nSnabba fötter.\n\n## Utförande\n- Två led\n- Byt sida',
    material: '1 boll per spelare',
    diagrams: Array.from({ length: diagrams }, (_, k) => diagram(i * diagrams + k)),
    images: i === 0 ? Array.from({ length: photos }, (_, k) => photo(`img${k}`)) : [],
  }));
  const pngData = png(40, 30).toString('base64');
  return {
    format: 'basketapp',
    version: 1,
    exportedAt: now,
    scope: 'session',
    blockTypes: [{ id: 'bt-technique', teamId: null, name: 'Teknik / fundamentals', icon: 'target', color: '#3B82F6' }],
    seasons: [],
    sessions: [{ id: 's1', teamId: null, seasonId: null, title, date: '2026-09-01', startTime: '18:00', location: 'Hall A', coach: 'Kim', items, updatedAt: now }],
    drills: [],
    templates: [],
    images: Array.from({ length: photos }, (_, k) => ({ id: `img${k}`, mime: 'image/png', data: pngData })),
  };
}

/** Imports the file through the menu and opens the session. */
async function importSession(page: Page, file: object, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Meny' }).click();
  await page.getByTestId('app-menu').getByRole('button', { name: 'Importera data' }).click();
  await page.getByTestId('import-input').setInputFiles({ name: 'pass.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByRole('dialog', { name: 'Importera data' }).getByRole('button', { name: 'Importera' }).click();
  await page.getByTestId('session-list').getByText(title).click();
  await expect(page).toHaveURL(/\/pass\//);
}

async function openPdf(page: Page) {
  await page.getByRole('button', { name: 'Exportera passet som PDF' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exportera som PDF' });
  const preview = dialog.getByTestId('pdf-preview');
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  return { dialog, preview };
}

test('acceptance: a PDF of 10 drills with 20 drawings is made in under 3 seconds', async ({ page }) => {
  await importSession(page, exportFile('Stort pass', 10, 2), 'Stort pass');
  const { dialog, preview } = await openPdf(page);
  // The first PDF also starts the worker; measure a second one as well.
  await dialog.getByLabel('A4 liggande').check();
  await expect(preview).toHaveAttribute('data-ready', 'false');
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  const ms = Number(await preview.getAttribute('data-ms'));
  expect(ms).toBeGreaterThan(0);
  expect(ms).toBeLessThan(3000);
  await expect(dialog.getByTitle('Förhandsvisning')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Ladda ner PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^basketapp-stort-pass-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = await read(download);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const text = pdf.toString('latin1');
  // Drawings are vector graphics in the PDF, not pictures.
  expect(text.match(/\/Subtype \/Image/g) ?? []).toHaveLength(0);
});

test('acceptance: a drill with 3 drawings and 2 photos shows all 5 pictures, also in the PDF', async ({ page }) => {
  await importSession(page, exportFile('Bildpass', 1, 3, 2), 'Bildpass');
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await expect(page.getByTestId('diagram-thumbs').getByTestId('media-thumb')).toHaveCount(3);
  await expect(page.getByTestId('image-thumbs').getByRole('img')).toHaveCount(2);

  const { dialog } = await openPdf(page);
  await dialog.getByLabel('3', { exact: true }).check();
  const downloadPromise = page.waitForEvent('download');
  await expect(dialog.getByTestId('pdf-preview')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Ladda ner PDF' }).click();
  const text = (await read(await downloadPromise)).toString('latin1');
  // 2 photos as images; the 3 drawings are drawn as vectors (their captions are in the text).
  expect(text.match(/\/Subtype \/Image/g) ?? []).toHaveLength(2);
});

test('the PDF options and language can be chosen, and are remembered', async ({ page }) => {
  await importSession(page, exportFile('Valpass', 2, 1), 'Valpass');
  const { dialog, preview } = await openPdf(page);
  await dialog.getByLabel('Svartvitt').check();
  await dialog.getByLabel('Bara tidtabell och bilder').check();
  await dialog.getByLabel('Språk i PDF:en').selectOption('en');
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Avbryt' }).click();

  // The page itself stays Swedish; the options come back next time (except the language).
  await expect(page.getByRole('button', { name: 'Exportera passet som PDF' })).toBeVisible();
  const again = await openPdf(page);
  await expect(again.dialog.getByLabel('Svartvitt')).toBeChecked();
  await expect(again.dialog.getByLabel('Bara tidtabell och bilder')).toBeChecked();
  await expect(again.dialog.getByLabel('Språk i PDF:en')).toHaveValue('sv');
});

test('the menu exports a PDF of a chosen season', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Ny säsong/ }).click();
  await page.getByLabel('Namn').fill('U16 Flickor');
  await page.getByRole('button', { name: 'Nytt pass' }).click();
  await page.getByRole('button', { name: 'Övning', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.goto('/');

  await page.getByRole('button', { name: 'Meny' }).click();
  await page.getByTestId('app-menu').getByRole('button', { name: 'Exportera som PDF' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exportera som PDF' });
  await dialog.getByRole('radio', { name: 'En säsong' }).check();
  await dialog.getByRole('combobox', { name: 'En säsong' }).selectOption({ label: 'U16 Flickor' });
  await expect(dialog.getByTestId('pdf-preview')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Ladda ner PDF' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^basketapp-u16-flickor-/);
});

test('CSV: one row per block with start, end, title, type, minutes and instruction', async ({ page }) => {
  await importSession(page, exportFile('Kalkylpass', 3, 0), 'Kalkylpass');
  await page.getByRole('button', { name: 'Exportera passet som kalkylark (CSV)' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Exportera som kalkylark (CSV)' }).getByRole('button', { name: 'Ladda ner CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^basketapp-kalkylpass-.*\.csv$/);
  const csv = (await read(download)).toString('utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).split('\r\n');
  expect(lines[0]).toBe('Start;Slut;Titel;Blocktyp;Minuter;Instruktion');
  expect(lines[1]).toMatch(/^18:00;18:08;Övning 1;Teknik \/ fundamentals;8;"## Syfte\nSnabba fötter\.\n\n## Utförande\n- Två led\n- Byt sida"$/);
  expect(lines[3]).toMatch(/^18:16;18:24;Övning 3;/);
});

test('acceptance-like: a share link opened in another browser becomes a copy of the session', async ({ page, browser }) => {
  await importSession(page, exportFile('Delat pass', 2, 1), 'Delat pass');
  await page.getByRole('button', { name: 'Dela passet som länk' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dela länk' });
  const link = await dialog.getByTestId('share-link').inputValue();
  expect(link).toMatch(/^http:\/\/localhost:\d+\/#data=v1:[A-Za-z0-9+\-$]+$/);
  await expect(dialog).not.toContainText('Fotona är inte med');

  // Someone else, with an empty browser.
  const other = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page2 = await other.newPage();
  await page2.goto(link);
  const preview = page2.getByTestId('import-preview');
  await expect(preview).toContainText('Delat via länk: ”Delat pass”');
  await expect(preview).toContainText('1 pass');
  await page2.getByRole('dialog', { name: 'Importera data' }).getByRole('button', { name: 'Importera' }).click();
  await expect(page2).toHaveURL(/\/pass\//);
  await expect(page2.getByLabel('Titel').first()).toHaveValue('Delat pass');
  await expect(times(page2)).toHaveText(['18:00–18:08', '18:08–18:16']);
  // The link data is gone from the address bar.
  expect(page2.url()).not.toContain('#data=');
  await other.close();
});

test('a share link leaves out photos when they make it too long', async ({ page }) => {
  // Random pixels do not compress, like a real photo.
  const file = exportFile('Fotopass', 1, 1, 1);
  file.images[0]!.data = Buffer.from(Array.from({ length: 12_000 }, () => Math.floor(Math.random() * 256))).toString('base64');
  await importSession(page, file, 'Fotopass');
  await page.getByRole('button', { name: 'Dela passet som länk' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dela länk' });
  await expect(dialog.getByRole('status')).toContainText('Fotona är inte med');
  expect((await dialog.getByTestId('share-link').inputValue()).length).toBeLessThanOrEqual(8000);
});

test('a drawing can be downloaded as SVG and PNG', async ({ page }) => {
  await importSession(page, exportFile('Ritpass', 1, 1), 'Ritpass');
  await page.getByRole('button', { name: 'Visa detaljer' }).click();

  let downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ladda ner ritningen som SVG (vektor)' }).click();
  let download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^basketapp-ovning-1-steg-1-.*\.svg$/);
  const svg = (await read(download)).toString('utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('<title>Steg 1</title>');

  downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ladda ner ritningen som PNG' }).click();
  download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await read(download);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(2000); // width
});

test('PDF export also works offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await importSession(page, exportFile('Offlinepass', 2, 1), 'Offlinepass');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Titel').first()).toHaveValue('Offlinepass');
  await openPdf(page);
});

test('the start page loads under 250 KB of JavaScript (gzip); PDF code is not part of it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Nytt pass/ })).toBeVisible();
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.endsWith('.js') && p.startsWith('/assets/')),
  );
  expect(scripts.some((s) => /pdf|render/i.test(s))).toBe(false);
  let total = 0;
  for (const s of new Set(scripts)) total += gzipSync(await readFile(DIST + s)).length;
  console.log(`start page JavaScript: ${(total / 1024).toFixed(1)} KB gzip`);
  expect(total).toBeLessThan(250 * 1024);
});
