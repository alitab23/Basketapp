import { expect, test, type Locator, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

test.use({ viewport: { width: 1280, height: 1100 } });

const canvas = (page: Page) => page.getByTestId('drawing-canvas');
const elements = (page: Page, type?: string) =>
  canvas(page).locator(type ? `[data-testid="court-element"][data-type="${type}"]` : '[data-testid="court-element"]');

/** Court metres → page pixels, using the canvas's viewBox (xMidYMid meet). */
async function toScreen(page: Page, x: number, y: number) {
  const svg = canvas(page);
  // The whole court must be on screen, or clicks land outside the window.
  await svg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
  });
  const box = (await svg.boundingBox())!;
  const [minX, minY, w, h] = (await svg.getAttribute('viewBox'))!.split(' ').map(Number) as [number, number, number, number];
  const s = Math.min(box.width / w, box.height / h);
  return { x: box.x + (box.width - w * s) / 2 + (x - minX) * s, y: box.y + (box.height - h * s) / 2 + (y - minY) * s };
}

async function tool(page: Page, name: string) {
  await page.getByRole('toolbar', { name: 'Verktyg' }).getByRole('button', { name, exact: true }).click();
}

async function clickCourt(page: Page, x: number, y: number) {
  const p = await toScreen(page, x, y);
  await page.mouse.click(p.x, p.y);
}

async function dragCourt(page: Page, from: [number, number], to: [number, number]) {
  const a = await toScreen(page, ...from);
  const b = await toScreen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

/** First point of a line's base path ("M x y …"). */
async function lineStart(line: Locator) {
  const d = (await line.locator('path').first().getAttribute('d'))!;
  const [, x, y] = /^M (-?[\d.]+) (-?[\d.]+)/.exec(d)!;
  return { x: Number(x), y: Number(y) };
}

async function openDrawing(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await page.getByRole('button', { name: 'Övning', exact: true }).click();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await page.getByTestId('drawing-section').getByRole('button', { name: 'Ritning' }).click();
  await expect(canvas(page)).toBeVisible();
}

test('acceptance: an arrow that starts on O1 follows when O1 is moved', async ({ page }) => {
  await openDrawing(page);
  await tool(page, 'Anfallsspelare (O)');
  await clickCourt(page, 9, 0);
  await expect(elements(page, 'offense')).toHaveCount(1);
  await expect(elements(page, 'offense')).toContainText('1');

  // Draw a cut starting on O1 (slightly off-centre: it still snaps to the player).
  await tool(page, 'Löpning utan boll (cut)');
  await dragCourt(page, [9.2, 0.1], [12, 4]);
  const cut = elements(page, 'cut');
  await expect(cut).toHaveCount(1);
  expect(await lineStart(cut)).toEqual({ x: 9, y: 0 });

  // Move O1 – the arrow's start follows.
  await tool(page, 'Markera och flytta');
  await dragCourt(page, [9, 0], [7, -3]);
  await expect.poll(() => lineStart(cut)).toEqual({ x: 7, y: -3 });
  // …and stays after a reload.
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.reload();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await expect.poll(() => lineStart(elements(page, 'cut'))).toEqual({ x: 7, y: -3 });
});

test('all symbols can be placed, numbered automatically, deleted and undone', async ({ page }) => {
  await openDrawing(page);
  const place: [string, number, number][] = [
    ['Anfallsspelare (O)', 8, -4],
    ['Anfallsspelare (O)', 8, 4],
    ['Försvarsspelare (X)', 10, -3],
    ['Tränare / passare (C)', 4, 0],
    ['Kon', 6, 6],
    ['Text', 3, -6],
  ];
  for (const [name, x, y] of place) {
    await tool(page, name);
    await clickCourt(page, x, y);
  }
  await expect(elements(page, 'offense')).toHaveText(['1', '2']);
  await expect(elements(page, 'defense')).toHaveText('1');
  await expect(elements(page)).toHaveCount(6);

  // A ball placed on O2 attaches to it.
  await tool(page, 'Boll');
  await clickCourt(page, 8, 4);
  await tool(page, 'Markera och flytta');
  await dragCourt(page, [8, 4], [9, 5]);
  const ball = elements(page, 'ball').locator('circle').last();
  await expect.poll(async () => Number(await ball.getAttribute('cx'))).toBeCloseTo(9.42, 1);

  // Zones and freehand.
  await tool(page, 'Zon (rektangel)');
  await dragCourt(page, [10, -7], [13, -5]);
  await tool(page, 'Frihand');
  await dragCourt(page, [2, 2], [4, 5]);
  await expect(elements(page)).toHaveCount(9);

  // Select the cone and delete it with the keyboard; undo brings it back.
  await clickCourt(page, 6, 6);
  await page.keyboard.press('Delete');
  await expect(elements(page, 'cone')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ångra' }).click();
  await expect(elements(page, 'cone')).toHaveCount(1);
});

test('lines: every type, bending into a curve, numbering and colour', async ({ page }) => {
  await openDrawing(page);
  const types = ['Passning', 'Dribbling', 'Löpning utan boll (cut)', 'Screen', 'Hand-off', 'Skott', 'Defensiv glidning'];
  for (const [i, name] of types.entries()) {
    await tool(page, name);
    await dragCourt(page, [1, -6 + i * 1.8], [6, -6 + i * 1.8]);
  }
  for (const type of ['pass', 'dribble', 'cut', 'screen', 'handoff', 'shot', 'slide']) await expect(elements(page, type)).toHaveCount(1);

  // Bend the pass with its middle handle.
  await clickCourt(page, 3.5, -6);
  await expect(page.getByTestId('handle-bend')).toHaveCount(1);
  const handle = (await page.getByTestId('handle-bend').boundingBox())!;
  const to = await toScreen(page, 3.5, -7);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(elements(page, 'pass').locator('path').first()).toHaveAttribute('d', /Q 3.5 -7 6 -6/);
  await expect(page.getByLabel('Kurva')).toBeChecked();

  // Number the arrows 1–7.
  await page.getByLabel('Numrera pilar').check();
  await expect(canvas(page).getByTestId('line-order')).toHaveCount(7);

  // Colour of the selected pass.
  await page.getByTestId('properties').getByRole('button', { name: '#dc2626' }).click();
  await expect(elements(page, 'pass').locator('path').nth(1)).toHaveAttribute('stroke', '#F97316'); // still selected = highlight
  await page.keyboard.press('Escape');
  await expect(elements(page, 'pass').locator('path').nth(1)).toHaveAttribute('stroke', '#dc2626');
});

test('box selection, copy/paste and copy to next step', async ({ page }) => {
  await openDrawing(page);
  for (const x of [8, 10]) {
    await tool(page, 'Anfallsspelare (O)');
    await clickCourt(page, x, 0);
  }
  // Drag a box over both players.
  await dragCourt(page, [7, -1.5], [11, 1.5]);
  await expect(page.getByTestId('properties')).toContainText('2 objekt markerade');
  await canvas(page).focus();
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(elements(page, 'offense')).toHaveCount(4);

  await page.getByRole('button', { name: 'Kopiera till nästa steg' }).click();
  await expect(page.getByTestId('diagram-thumbs').getByTestId('media-thumb')).toHaveCount(2);
  // The new step is the active one.
  await expect(page.getByTestId('diagram-thumbs').getByTestId('media-thumb').nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(elements(page, 'offense')).toHaveCount(4);
  // Changing step 2 leaves step 1 alone.
  await page.keyboard.press('Escape');
  await clickCourt(page, 8, 0);
  await page.keyboard.press('Delete');
  await expect(elements(page, 'offense')).toHaveCount(3);
  await page.getByTestId('diagram-thumbs').getByTestId('media-thumb').first().click();
  await expect(elements(page, 'offense')).toHaveCount(4);
});

/** A tiny valid PNG (solid colour) of the given size. */
function png(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
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
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('photos: upload is scaled to 1600 px, stored locally and shown large', async ({ page }) => {
  await openDrawing(page);
  await page.getByTestId('image-input').setInputFiles([
    { name: 'stor.png', mimeType: 'image/png', buffer: png(2400, 1200) },
    { name: 'liten.png', mimeType: 'image/png', buffer: png(300, 200) },
  ]);
  const thumbs = page.getByTestId('image-thumbs').getByRole('img');
  await expect(thumbs).toHaveCount(2);

  // Stored scaled down in the session.
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  const sizes = await page.evaluate(
    () =>
      new Promise<{ width: number; height: number }[]>((resolve) => {
        const req = indexedDB.open('basketapp');
        req.onsuccess = () => {
          const all = req.result.transaction('sessions').objectStore('sessions').getAll();
          all.onsuccess = () => resolve(all.result[0].items[0].images.map((i: { width: number; height: number }) => ({ width: i.width, height: i.height })));
        };
      }),
  );
  expect(sizes).toEqual([
    { width: 1600, height: 800 },
    { width: 300, height: 200 },
  ]);

  // An unsupported file gives a clear message.
  await page.getByTestId('image-input').setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(page.getByRole('alert')).toContainText('Filtypen stöds inte');

  // Large view with arrows: the drawing first, then the photos.
  await thumbs.first().click();
  const box = page.getByTestId('lightbox');
  await expect(box).toContainText('Bild 1');
  await expect(box).toContainText('2 av 3');
  await page.keyboard.press('ArrowRight');
  await expect(box).toContainText('Bild 2');
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);

  // Still there after reload.
  await page.reload();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await expect(page.getByTestId('image-thumbs').getByRole('img')).toHaveCount(2);
});

test('the collapsed block shows a thumbnail of the drawing', async ({ page }) => {
  await openDrawing(page);
  await tool(page, 'Anfallsspelare (O)');
  await clickCourt(page, 9, 0);
  await page.getByRole('button', { name: 'Dölj detaljer' }).click();
  await expect(page.getByTestId('block-row').getByTestId('court-view')).toBeVisible();
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('a player can be placed with a tap', async ({ page }) => {
    await openDrawing(page);
    await page.getByRole('toolbar', { name: 'Verktyg' }).getByRole('button', { name: 'Anfallsspelare (O)' }).tap();
    const p = await toScreen(page, 9, 2);
    await page.touchscreen.tap(p.x, p.y);
    await expect(elements(page, 'offense')).toHaveCount(1);
  });
});

test('dragging stays fast with 100 objects on the court', async ({ page }) => {
  await openDrawing(page);
  // Fill the drawing with 100 objects through the app's own storage, then reload.
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('basketapp');
        req.onsuccess = () => {
          const store = req.result.transaction('sessions', 'readwrite').objectStore('sessions');
          const all = store.getAll();
          all.onsuccess = () => {
            const s = all.result[0];
            const els = [];
            for (let i = 0; i < 100; i++) {
              const x = 1 + (i % 10) * 1.3;
              const y = -6 + Math.floor(i / 10) * 1.3;
              els.push(i % 2 ? { id: `p${i}`, type: 'offense', x, y, label: String(i) } : { id: `l${i}`, type: 'dribble', points: [{ x, y }, { x: x + 1, y: y + 0.8 }], curved: false });
            }
            s.items[0].diagrams[0].elements = els;
            store.put(s).onsuccess = () => resolve();
          };
        };
      }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await expect(elements(page)).toHaveCount(100);

  const a = await toScreen(page, 2.3, -6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const started = Date.now();
  for (let i = 1; i <= 60; i++) await page.mouse.move(a.x + i * 3, a.y + i * 2);
  const perMove = (Date.now() - started) / 60;
  await page.mouse.up();
  console.log(`Average time per pointer move with 100 objects: ${perMove.toFixed(1)} ms`);
  // 60 fps needs ~16 ms per frame; allow headroom for the test machine and Playwright round trips.
  expect(perMove).toBeLessThan(40);
});
