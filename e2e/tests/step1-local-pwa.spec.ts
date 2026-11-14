import { expect, test, type Page } from '@playwright/test';

/** Creates a session from the start page and returns to the start page. */
async function createSession(page: Page) {
  await page.getByRole('button', { name: /Nytt pass/ }).click();
  await expect(page).toHaveURL(/\/pass\//);
  await expect(page.getByTestId('save-status')).toHaveText('Sparat');
  await page.getByRole('link', { name: /Basketapp/ }).click();
  await expect(page.getByTestId('session-list').getByRole('listitem')).toHaveCount(1);
}

test('start page loads in Swedish without an account', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Basketapp/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nytt pass/ })).toBeVisible();
  await expect(page.getByText(/Inga pass ännu/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
});

test('a new session is still there after a reload', async ({ page }) => {
  await page.goto('/');
  await createSession(page);
  await page.reload();
  const items = page.getByTestId('session-list').getByRole('listitem');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Nytt pass');
  await expect(items.first()).toContainText('0 block');
});

test('a session survives closing and reopening the browser', async ({ browser }) => {
  // Same storage state = same browser profile reopened.
  const first = await browser.newContext();
  const page1 = await first.newPage();
  await page1.goto('/');
  await createSession(page1);
  const state = await first.storageState({ indexedDB: true });
  await first.close();

  const second = await browser.newContext({ storageState: state });
  const page2 = await second.newPage();
  await page2.goto('/');
  await expect(page2.getByTestId('session-list').getByRole('listitem')).toHaveCount(1);
  await second.close();
});

test('default block types are stored in IndexedDB', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const req = indexedDB.open('basketapp');
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const count = req.result.transaction('blockTypes').objectStore('blockTypes').count();
              count.onsuccess = () => resolve(count.result);
            };
          }),
      ),
    )
    .toBe(8);
});

test('language can be switched to English and is remembered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').selectOption('en');
  await expect(page.getByRole('button', { name: /New session/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /New session/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('web app manifest is valid for installation', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: 'Basketapp', display: 'standalone', start_url: '/' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true);
  }
});

test('the app opens offline and shows locally saved sessions', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the service worker has installed and cached the app.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await createSession(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: /Basketapp/ })).toBeVisible();
  await expect(page.getByTestId('session-list').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Offline – sparas lokalt')).toBeVisible();
});
