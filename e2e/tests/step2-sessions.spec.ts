import { expect, test, type Locator, type Page } from '@playwright/test';

// Only rows in the list itself, not the drag "shadow".
const rows = (page: Page) => page.getByTestId('block-list').getByTestId('block-row');
const titles = (page: Page) =>
  rows(page)
    .getByRole('textbox', { name: 'Titel' })
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
const times = (page: Page) => page.getByTestId('block-list').getByTestId('block-time');
/** dnd-kit's screen reader announcements; used to wait for each keyboard step. */
const announcement = (page: Page) => page.locator('[id^="DndLiveRegion"]');

// Tall enough that a short session fits on screen without scrolling.
test.use({ viewport: { width: 1280, height: 1000 } });

async function newSession(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await expect(page).toHaveURL(/\/pass\//);
}

/** Adds drills with the given lengths and names "Övning 1", "Övning 2" … */
async function addDrills(page: Page, durations: number[]) {
  for (const [i, d] of durations.entries()) {
    await page.getByRole('button', { name: 'Övning', exact: true }).click();
    const row = rows(page).nth(i);
    await row.getByRole('textbox', { name: 'Titel' }).fill(`Övning ${i + 1}`);
    await row.getByTestId('block-duration').fill(String(d));
  }
}

/**
 * Drags with real pointer events, with steps so dnd-kit sees the movement.
 * Both ends must be on screen first, or dnd-kit's auto-scroll moves the page mid-drag.
 */
async function drag(page: Page, from: Locator, to: Locator, options: { hold?: (page: Page) => Promise<void> } = {}) {
  await to.scrollIntoViewIfNeeded();
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  if (options.hold) await options.hold(page);
  await page.mouse.up();
}

test('acceptance: 18:00 with 10+15+5+30+20 min gives the right times, total and end', async ({ page }) => {
  await newSession(page);
  await addDrills(page, [10, 15, 5, 30, 20]);
  await expect(times(page)).toHaveText(['18:00–18:10', '18:10–18:25', '18:25–18:30', '18:30–19:00', '19:00–19:20']);
  await expect(page.getByTestId('session-total')).toHaveText('1 h 20 min');
  await expect(page.getByTestId('session-range')).toHaveText('18:00–19:20');
});

test('changing a length or the start time updates all times directly', async ({ page }) => {
  await newSession(page);
  await addDrills(page, [10, 10, 10]);
  await rows(page).first().getByRole('button', { name: '5 minuter längre' }).click();
  await expect(times(page)).toHaveText(['18:00–18:15', '18:15–18:25', '18:25–18:35']);
  await page.getByLabel('Starttid').fill('09:30');
  await expect(times(page)).toHaveText(['09:30–09:45', '09:45–09:55', '09:55–10:05']);
});

test('dragging a block with the mouse updates the times, already while dragging', async ({ page }) => {
  await newSession(page);
  await addDrills(page, [10, 15, 5]);
  const handles = page.getByTestId('drag-handle');

  await drag(page, handles.nth(2), handles.nth(0), {
    hold: async (p) => {
      // While still holding: the dragged 5-min block is shown first, so the old first block now starts 18:05.
      await expect(p.getByTestId('drop-indicator')).toBeVisible();
      await expect(rows(p).nth(0).getByTestId('block-time')).toHaveText('18:05–18:15');
    },
  });

  await expect.poll(() => titles(page)).toEqual(['Övning 3', 'Övning 1', 'Övning 2']);
  await expect(times(page)).toHaveText(['18:00–18:05', '18:05–18:15', '18:15–18:30']);

  // Undo works after the move.
  await page.getByRole('button', { name: 'Ångra' }).click();
  await expect.poll(() => titles(page)).toEqual(['Övning 1', 'Övning 2', 'Övning 3']);
});

test('a block can be moved with the keyboard', async ({ page }) => {
  await newSession(page);
  await addDrills(page, [10, 15, 5]);
  await page.getByTestId('drag-handle').first().focus();
  await page.keyboard.press('Space');
  await expect(announcement(page)).toContainText('”Övning 1” är över position 1 av 3');
  await page.keyboard.press('ArrowDown');
  await expect(announcement(page)).toContainText('position 2 av 3');
  // Times are recalculated while the block is still being moved.
  await expect(times(page)).toHaveText(['18:15–18:25', '18:00–18:15', '18:25–18:30']);
  await page.keyboard.press('ArrowDown');
  await expect(announcement(page)).toContainText('position 3 av 3');
  await page.keyboard.press('Space');
  await expect.poll(() => titles(page)).toEqual(['Övning 2', 'Övning 3', 'Övning 1']);
  await expect(times(page)).toHaveText(['18:00–18:15', '18:15–18:20', '18:20–18:30']);
});

test('headings split the session and show the sum of their part', async ({ page }) => {
  await newSession(page);
  await page.getByRole('button', { name: 'Rubrik', exact: true }).click();
  await addDrills(page, [10, 5]);
  await page.getByRole('button', { name: 'Rubrik', exact: true }).click();
  await page.getByRole('button', { name: 'Paus', exact: true }).click();
  await expect(page.getByTestId('section-total')).toHaveText(['15 min', '5 min']);
  await expect(page.getByTestId('session-total')).toHaveText('20 min');
});

test('everything is autosaved and still there after a reload', async ({ page }) => {
  await newSession(page);
  await page.getByLabel('Titel').first().fill('Tisdagspass');
  await page.getByLabel('Hall', { exact: true }).fill('Hall A');
  await addDrills(page, [20, 25]);
  await rows(page).first().getByRole('button', { name: 'Visa detaljer' }).click();
  await page.getByLabel('Instruktioner').fill('## Syfte\n- Snabba fötter');
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');

  await page.reload();
  await expect(page.getByLabel('Titel').first()).toHaveValue('Tisdagspass');
  await expect(page.getByLabel('Hall', { exact: true })).toHaveValue('Hall A');
  await expect(times(page)).toHaveText(['18:00–18:20', '18:20–18:45']);
  await expect(rows(page).first()).toContainText('Syfte Snabba fötter');
});

test('a season lists its sessions and they can be moved between dates in the calendar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Ny säsong/ }).click();
  await expect(page).toHaveURL(/\/sasong\//);
  await page.getByLabel('Namn').fill('U16 Flickor');
  await page.getByLabel('Startdatum').fill('2026-08-01');
  await page.getByLabel('Slutdatum').fill('2027-04-30');

  await page.getByRole('button', { name: 'Nytt pass' }).click();
  await expect(page).toHaveURL(/\/pass\//);
  await page.getByLabel('Datum').fill('2026-09-01');
  await addDrills(page, [30, 60]);
  await expect(page.getByLabel('Säsong')).toHaveValue(/.+/);
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.getByRole('link', { name: 'Till startsidan' }).first().click();

  await expect(page).toHaveURL(/\/sasong\//);
  await expect(page.getByLabel('Namn')).toHaveValue('U16 Flickor');
  await expect(page.getByTestId('season-total')).toHaveText('1 h 30 min');
  await expect(page.getByTestId('season-sessions')).toContainText('18:00–19:30');

  await page.getByRole('tab', { name: 'Kalender' }).click();
  // Opens on the month with the next session, or the current month; go back to September 2026.
  const month = page.getByTestId('calendar-month');
  for (let i = 0; i < 24 && (await month.textContent()) !== 'september 2026'; i++) {
    const current = await month.textContent();
    await page.getByRole('button', { name: 'Föregående månad' }).click();
    await expect(month).not.toHaveText(current!);
  }
  await expect(month).toHaveText('september 2026');
  await drag(page, page.getByTestId('calendar-session'), page.getByTestId('day-2026-09-03'));
  await expect(page.getByTestId('day-2026-09-03').getByTestId('calendar-session')).toBeVisible();
  await expect(page.getByTestId('day-2026-09-01').getByTestId('calendar-session')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ångra' }).click();
  await expect(page.getByTestId('day-2026-09-01').getByTestId('calendar-session')).toBeVisible();
});

test('a session can be duplicated and deleted', async ({ page }) => {
  await newSession(page);
  await page.getByLabel('Titel').first().fill('Original');
  await addDrills(page, [10]);
  await page.getByRole('button', { name: 'Duplicera pass' }).click();
  await expect(page.getByLabel('Titel').first()).toHaveValue('Original (kopia)');
  await expect(times(page)).toHaveText(['18:00–18:10']);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Radera pass' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('session-list').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('session-list')).toContainText('Original');
});

test('editing offline keeps working and is saved locally', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await expect(page).toHaveURL(/\/pass\//);

  await context.setOffline(true);
  await addDrills(page, [15]);
  await expect(page.getByTestId('save-status')).toHaveText('Offline – sparas lokalt');
  await page.reload();
  await expect(times(page)).toHaveText(['18:00–18:15']);
});
