import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a real service-worker update waits for successful autosave before reloading', async ({
  page,
  context,
}, info) => {
  await page.goto('/');
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  const editor = page.locator('.monaco-editor');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.insertText('SELECT 1;');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();

  const manifest: unknown = await (await page.request.get('/ngsw.json')).json();
  if (!manifest || typeof manifest !== 'object')
    throw new Error('Missing production service-worker manifest.');
  const updatedManifest = { ...manifest, appData: { testVersion: crypto.randomUUID() } };
  let manifestRequests = 0;
  await context.route('**/ngsw.json*', async (route) => {
    manifestRequests++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-cache' },
      body: JSON.stringify(updatedManifest),
    });
  });
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect.poll(() => manifestRequests).toBeGreaterThan(0);
  await page
    .getByRole('dialog', { name: 'Session library', exact: true })
    .getByRole('button', { name: 'Close session library', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Save and reload', exact: true })).toBeVisible();

  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put');
    if (!original) throw new Error('Could not capture the browser storage method.');
    Object.defineProperty(window, 'restoreTestStorage', {
      configurable: true,
      value: () => {
        Object.defineProperty(IDBObjectStore.prototype, 'put', original);
      },
    });
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Simulated storage quota', 'QuotaExceededError');
    };
  });
  const draft = "SELECT 'save before update';";
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(draft);
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.getByRole('button', { name: 'Save and reload', exact: true }).click();
  await expect(
    page.getByText('Save failed. Retry saving before reloading the application.', { exact: true }),
  ).toBeVisible();
  expect(navigations).toBe(0);

  await page.evaluate(() =>
    (window as unknown as { restoreTestStorage: () => void }).restoreTestStorage(),
  );
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.getByRole('button', { name: 'Save and reload', exact: true }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Export SQL', exact: true })).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  const output = info.outputPath('after-update.sql');
  await (await downloaded).saveAs(output);
  expect(await readFile(output, 'utf8')).toBe(draft);
  expect(navigations).toBeGreaterThan(0);
});
