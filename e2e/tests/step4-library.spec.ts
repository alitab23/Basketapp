import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import LZString from 'lz-string';

test.use({ viewport: { width: 1280, height: 1000 } });

const rows = (page: Page) => page.getByTestId('block-list').getByTestId('block-row');
const times = (page: Page) => page.getByTestId('block-list').getByTestId('block-time');
const toolbarTool = (page: Page, name: string) => page.getByRole('toolbar', { name: 'Verktyg' }).getByRole('button', { name, exact: true });

async function openMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Meny' }).click();
  await page.getByTestId('app-menu').getByRole('button', { name: item }).click();
}

async function libraryTab(page: Page, tab: string) {
  await page.getByRole('navigation', { name: 'Huvudmeny' }).getByRole('link', { name: 'Bibliotek' }).click();
  await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
}

/** A tiny valid 1×1 PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');

test('acceptance: export everything, clear everything, import – everything is back, drawings included', async ({ page }) => {
  // A session with a drawing and a photo …
  await page.goto('/');
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await page.getByLabel('Titel').first().fill('Tisdagspass');
  await page.getByRole('button', { name: 'Övning', exact: true }).click();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await page.getByTestId('drawing-section').getByRole('button', { name: 'Ritning' }).click();
  const canvas = page.getByTestId('drawing-canvas');
  await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await toolbarTool(page, 'Anfallsspelare (O)').click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.getByTestId('image-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('image-thumbs').getByRole('img')).toHaveCount(1);
  // … and a drill in the Library.
  await page.getByRole('button', { name: 'Spara i Biblioteket' }).click();
  await expect(page.getByTestId('toast').filter({ hasText: 'sparades i Biblioteket' })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');

  // Export everything.
  await openMenu(page, 'Exportera data');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Exportera data' }).getByRole('button', { name: 'Exportera' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^basketapp-allt-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(json).toMatchObject({ format: 'basketapp', version: 1, scope: 'all' });
  expect(json.images).toHaveLength(1);

  // Clear everything.
  await openMenu(page, 'Rensa allt');
  const clear = page.getByRole('dialog', { name: 'Rensa allt' });
  await expect(clear.getByRole('button', { name: 'Exportera allt först' })).toBeVisible();
  await clear.getByRole('button', { name: 'Rensa allt' }).click();
  await expect(page.getByText(/Inga pass ännu/)).toBeVisible();

  // Import the file again.
  await openMenu(page, 'Importera data');
  await page.getByTestId('import-input').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: await readFile((await download.path())!) });
  await expect(page.getByTestId('import-preview')).toContainText('1 pass, 1 övning, 1 bild');
  await page.getByRole('dialog', { name: 'Importera data' }).getByRole('button', { name: 'Importera' }).click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Importen är klar' })).toBeVisible();

  await page.getByTestId('session-list').getByText('Tisdagspass').click();
  await page.getByRole('button', { name: 'Visa detaljer' }).click();
  await expect(page.getByTestId('drawing-canvas').locator('[data-type="offense"]')).toHaveCount(1);
  await expect(page.getByTestId('image-thumbs').getByRole('img')).toHaveCount(1);
  await libraryTab(page, 'Övningar');
  await expect(page.getByTestId('library-card')).toHaveCount(1);
});

test('acceptance: a session made from a template can be changed without changing the template', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Öppna template' }).click();
  const card = page.getByTestId('library-card').filter({ hasText: 'Standardpass 90 min' });
  await expect(card).toContainText('Inbyggd');
  await card.getByRole('button', { name: 'Använd' }).click();
  const dialog = page.getByRole('dialog', { name: 'Använd ”Standardpass 90 min”' });
  await dialog.getByLabel('Starttid').fill('17:30');
  await dialog.getByRole('button', { name: 'Skapa' }).click();

  await expect(page).toHaveURL(/\/pass\//);
  await expect(page.getByTestId('session-total')).toHaveText('1 h 30 min');
  await expect(page.getByTestId('session-range')).toHaveText('17:30–19:00');
  await expect(rows(page)).toHaveCount(5);
  // Change the copy.
  await rows(page).first().getByTestId('block-duration').fill('30');
  await expect(page.getByTestId('session-total')).toHaveText('1 h 45 min');
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');

  // The template is unchanged.
  await libraryTab(page, 'Templates');
  await expect(page.getByTestId('library-card').filter({ hasText: 'Standardpass 90 min' })).toContainText('1 h 30 min');
  await page.getByTestId('library-card').filter({ hasText: 'Standardpass 90 min' }).getByRole('button', { name: 'Använd' }).click();
  await page.getByRole('button', { name: 'Skapa' }).click();
  await expect(page.getByTestId('session-total')).toHaveText('1 h 30 min');
});

test('acceptance: a drill dragged from the Library into a session becomes a copy', async ({ page }) => {
  // A drill in the Library.
  await page.goto('/bibliotek?tab=drills');
  await page.getByRole('button', { name: 'Ny övning' }).click();
  await expect(page).toHaveURL(/\/ovning\//);
  const drillUrl = page.url();
  await page.getByLabel('Titel', { exact: true }).fill('Min closeout');
  await page.getByLabel('Standardlängd (min)').fill('7');
  await page.getByLabel('Taggar').fill('försvar, skott');
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');

  // A session with one block, then drag the drill in front of it.
  await page.goto('/');
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await page.getByRole('button', { name: 'Övning', exact: true }).click();
  await page.getByRole('button', { name: 'Från bibliotek' }).click();
  const item = page.getByTestId('library-panel').getByTestId('panel-item').filter({ hasText: 'Min closeout' });
  const handle = item.getByRole('button', { name: /Flytta/ });
  const target = rows(page).first();
  const a = (await handle.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x - 20, a.y + 5, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await expect(page.getByTestId('drop-indicator')).toBeVisible();
  await page.mouse.up();

  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first().getByRole('textbox', { name: 'Titel' })).toHaveValue('Min closeout');
  await expect(times(page)).toHaveText(['18:00–18:07', '18:07–18:17']);

  // Changing the copy leaves the Library alone.
  await rows(page).first().getByRole('textbox', { name: 'Titel' }).fill('Ändrad i passet');
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.goto(drillUrl);
  await expect(page.getByLabel('Titel', { exact: true })).toHaveValue('Min closeout');

  // A built-in drill template can also be added with a click.
  await page.goBack();
  await page.getByRole('button', { name: 'Från bibliotek' }).click();
  await page.getByTestId('library-panel').getByRole('button', { name: 'Lägg till: Mikan drill' }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).last()).toContainText('18:17–18:20');
});

test('acceptance: a sessionplan link can be imported as a session', async ({ page }) => {
  const data = {
    version: '1.0',
    workshop: { title: 'Från sessionplan', description: '', date: '2026-09-15', startTime: '09:00' },
    blockTypes: [{ id: 'input', name: 'Input', color: '#2C8DFE' }],
    persons: [],
    items: [
      { id: 'a', type: 'block', blockTypeId: 'input', title: 'Intro', duration: 20, notes: '*Viktigt*', material: '' },
      { id: 'g', type: 'group', title: 'Huvuddel', duration: 40, children: [{ id: 'b', type: 'block', blockTypeId: null, title: 'Övning', duration: 40, notes: '', material: '' }] },
    ],
  };
  const link = `https://sessionplan.de/#data=v2:${LZString.compressToEncodedURIComponent(JSON.stringify(data))}`;

  await page.goto('/');
  await openMenu(page, 'Importera data');
  await page.getByLabel('Klistra in en sessionplan-länk eller sessionplan-JSON').fill(link);
  await page.getByRole('button', { name: 'Läs in' }).click();
  await expect(page.getByTestId('import-preview')).toContainText('Ett pass från sessionplan: ”Från sessionplan”');
  await page.getByRole('dialog', { name: 'Importera data' }).getByRole('button', { name: 'Importera' }).click();

  await expect(page).toHaveURL(/\/pass\//);
  await expect(page.getByLabel('Titel').first()).toHaveValue('Från sessionplan');
  await expect(times(page)).toHaveText(['09:00–09:20', '09:20–10:00']);
  await expect(page.getByTestId('section-total')).toHaveText('40 min');
});

test('import gives a clear message for a bad file, and a JSON file can be dropped anywhere', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, 'Importera data');
  await page.getByTestId('import-input').setInputFiles({ name: 'fel.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"basketapp","version":7}') });
  await expect(page.getByRole('alert')).toContainText('nyare version av Basketapp (version 7)');
  await page.keyboard.press('Escape');

  // Drop a valid file on the page.
  const file = { format: 'basketapp', version: 1, exportedAt: '2026-11-14T00:00:00Z', scope: 'session', sessions: [{ id: 's1', teamId: null, seasonId: null, title: 'Släppt pass', startTime: '18:00', items: [], updatedAt: '2026-11-14T00:00:00Z' }] };
  const dataTransfer = await page.evaluateHandle((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], 'pass.json', { type: 'application/json' }));
    return dt;
  }, JSON.stringify(file));
  await page.locator('main').dispatchEvent('dragover', { dataTransfer });
  await page.locator('main').dispatchEvent('drop', { dataTransfer });
  await expect(page.getByTestId('import-preview')).toContainText('1 pass');
  await page.getByRole('dialog', { name: 'Importera data' }).getByRole('button', { name: 'Importera' }).click();
  await expect(page.getByTestId('session-list')).toContainText('Släppt pass');
});

test('Library: search, filter, archive, trash and restore', async ({ page }) => {
  await page.goto('/bibliotek?tab=templates');
  await expect(page.getByTestId('result-count')).toHaveText('10 träffar');
  await page.getByPlaceholder('Sök på titel och text').fill('pick');
  await expect(page.getByTestId('library-card')).toHaveCount(1);
  await page.getByPlaceholder('Sök på titel och text').fill('');
  await page.getByLabel('Alla sorter').selectOption({ label: 'Övnings-template' });
  await expect(page.getByTestId('library-card')).toHaveCount(6);

  // Use a drill template → a drill in the Library.
  await page.getByTestId('library-card').filter({ hasText: 'Shell drill' }).getByRole('button', { name: 'Använd' }).click();
  await page.getByRole('button', { name: 'Skapa' }).click();
  await expect(page).toHaveURL(/\/ovning\//);
  await expect(page.getByTestId('drawing-section').getByTestId('media-thumb')).toHaveCount(1);

  await libraryTab(page, 'Övningar');
  const card = page.getByTestId('library-card').filter({ hasText: 'Shell drill 4 mot 4' });
  await expect(card).toContainText('försvar');
  await page.getByLabel('Alla taggar').selectOption('försvar');
  await expect(page.getByTestId('library-card')).toHaveCount(1);

  // Archive hides it, "Visa arkiverade" shows it.
  await card.getByRole('button', { name: 'Arkivera' }).click();
  await expect(page.getByTestId('library-card')).toHaveCount(0);
  await page.getByLabel('Visa arkiverade').check();
  await expect(page.getByTestId('library-card')).toContainText('Arkiverad');
  await page.getByTestId('library-card').getByRole('button', { name: 'Ta fram ur arkivet' }).click();

  // Delete → trash → restore.
  await page.getByTestId('library-card').getByRole('button', { name: 'Radera' }).click();
  await expect(page.getByTestId('library-card')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Papperskorg' }).click();
  await expect(page.getByTestId('trash-list')).toContainText('30 dagar kvar');
  await page.getByRole('button', { name: 'Återställ' }).click();
  await expect(page.getByText('Papperskorgen är tom.')).toBeVisible();
  await page.getByRole('tab', { name: /^Övningar/ }).click();
  await expect(page.getByTestId('library-card')).toHaveCount(1);
});

test('a season template lays out sessions on the chosen weekdays', async ({ page }) => {
  await page.goto('/bibliotek?tab=templates');
  await page.getByTestId('library-card').filter({ hasText: 'Säsong 2 pass/vecka' }).getByRole('button', { name: 'Använd' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Säsongens namn').fill('U14 hösten');
  await dialog.getByLabel('Startdatum').fill('2026-11-16'); // a Monday
  await expect(dialog.getByTestId('season-preview')).toContainText('16 veckor · 32 pass');
  await dialog.getByRole('button', { name: 'Skapa' }).click();

  await expect(page).toHaveURL(/\/sasong\//);
  await expect(page.getByLabel('Namn')).toHaveValue('U14 hösten');
  await expect(page.getByTestId('season-total')).toHaveText('48 h');
  const list = page.getByTestId('season-sessions').getByRole('listitem');
  await expect(list).toHaveCount(32);
  await expect(list.first()).toContainText('tis 17 nov. 2026');
  await expect(list.nth(1)).toContainText('tors 19 nov. 2026');
});
