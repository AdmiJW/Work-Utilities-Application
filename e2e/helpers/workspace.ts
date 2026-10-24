import { expect, Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function enterSql(page: Page, source: string): Promise<void> {
  const editor = page.locator('.monaco-editor');
  await expect(editor).toBeVisible();
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(source);
}

export async function readSql(page: Page, path: string): Promise<string> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  await (await download).saveAs(path);
  return readFile(path, 'utf8');
}

export async function renameTab(page: Page, current: string, name: string): Promise<void> {
  await page.getByRole('tab', { name: current, exact: true }).dblclick();
  const input = page.getByRole('textbox', { name: 'Session name', exact: true });
  await input.fill(name);
  await input.press('Enter');
}

export async function dropFiles(
  page: Page,
  target: Locator,
  files: { name: string; content: string }[],
  surface: Locator = target,
): Promise<void> {
  const transfer = await page.evaluateHandle((values) => {
    const data = new DataTransfer();
    for (const value of values)
      data.items.add(new File([value.content], value.name, { type: 'text/plain' }));
    return data;
  }, files);
  try {
    await target.dispatchEvent('dragenter', { dataTransfer: transfer });
    await expect(target).toHaveClass(/file-drag-over/);
    await surface.dispatchEvent('dragover', { dataTransfer: transfer });
    await surface.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(target).not.toHaveClass(/file-drag-over/);
  } finally {
    await transfer.dispose();
  }
}

export async function openFile(
  page: Page,
  button: string,
  name: string,
  buffer: Buffer,
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button, exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer });
}
