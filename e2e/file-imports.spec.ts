import { expect, test } from '@playwright/test';
import { dropFiles, enterSql, openFile, readSql } from './helpers/workspace';

test('SQL Open/drop imports preserve the tab, selection, undo, line endings and cancellation', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await openFile(page, 'Open SQL', 'first.sql', Buffer.from('SELECT old tail'));
  await expect(page.getByRole('dialog', { name: 'Import file', exact: true })).toHaveCount(0);
  expect(await readSql(page, info.outputPath('initial.sql'))).toBe('SELECT old tail');
  await expect(page.getByRole('tab', { name: 'SQL Formatter 01', exact: true })).toBeVisible();
  const editor = page.locator('.monaco-editor');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Home');
  for (let index = 0; index < 7; index++) await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 3; index++) await page.keyboard.press('Shift+ArrowRight');
  await openFile(page, 'Open SQL', 'insert.sql', Buffer.from('NEW'));
  await page.getByRole('button', { name: 'Insert at cursor', exact: true }).click();
  expect(await readSql(page, info.outputPath('insert.sql'))).toBe('SELECT NEW tail');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await readSql(page, info.outputPath('undo.sql'))).toBe('SELECT old tail');
  await dropFiles(
    page,
    page.locator('.editor-area'),
    [{ name: 'replace.sql', content: 'SELECT 2;\r\n' }],
    page.locator('.monaco-editor .view-lines'),
  );
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  expect(await readSql(page, info.outputPath('replace.sql'))).toBe('SELECT 2;\r\n');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await readSql(page, info.outputPath('replace-undo.sql'))).toBe('SELECT old tail');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Y');
  expect(await readSql(page, info.outputPath('replace-redo.sql'))).toBe('SELECT 2;\r\n');
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await readSql(page, info.outputPath('replace-undo-again.sql'))).toBe('SELECT old tail');
  await dropFiles(page, page.locator('.editor-area'), [
    { name: 'cancel.sql', content: 'not applied' },
  ]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readSql(page, info.outputPath('cancel.sql'))).toBe('SELECT old tail');
  await dropFiles(page, page.locator('.editor-area'), [
    { name: 'one.sql', content: 'one' },
    { name: 'two.sql', content: 'two' },
  ]);
  await expect(page.getByRole('dialog', { name: 'Cannot open file', exact: true })).toContainText(
    'Only one file is allowed at a time.',
  );
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await openFile(page, 'Open SQL', 'bad.sql', Buffer.from([0xc3, 0x28]));
  await expect(page.getByRole('dialog', { name: 'Cannot open file', exact: true })).toContainText(
    'not valid UTF-8',
  );
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  expect(await readSql(page, info.outputPath('unchanged.sql'))).toBe('SELECT old tail');
  await expect(page.getByRole('tablist', { name: 'Tool sessions' }).getByRole('tab')).toHaveCount(
    1,
  );
});

test('TXT Open/drop inserts at the selection, rejects multiple files and opens a collapsed source', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  const input = page.getByRole('textbox', { name: 'Execution output', exact: true });
  await openFile(page, 'Open TXT', 'first.txt', Buffer.from('prefix OLD suffix'));
  await expect(input).toHaveValue('prefix OLD suffix');
  await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(7, 10);
    textarea.dispatchEvent(new Event('select'));
  });
  await dropFiles(
    page,
    page.locator('.source-section'),
    [{ name: 'insert.txt', content: 'NEW' }],
    input,
  );
  await page.getByRole('button', { name: 'Insert at cursor', exact: true }).click();
  await expect(input).toHaveValue('prefix NEW suffix');
  await openFile(page, 'Open TXT', 'cancel.txt', Buffer.from('cancelled'));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(input).toHaveValue('prefix NEW suffix');
  const source =
    "SQL Statement Run: --1SELECT CONCAT_WS('|',d.Id,d.State) FROM Demo d\n0001|ACTIVE";
  await openFile(page, 'Open TXT', 'replace.txt', Buffer.from(source));
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(input).toHaveValue(source);
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'd.Id', exact: true })).toBeVisible();
  await expect(input).toHaveCount(0);
  await dropFiles(page, page.locator('.source-section'), [
    { name: 'next.txt', content: source.replace('0001', '0002') },
  ]);
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(input).toHaveValue(source.replace('0001', '0002'));
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled();
  await dropFiles(page, page.locator('.source-section'), [
    { name: 'one.txt', content: 'one' },
    { name: 'two.txt', content: 'two' },
  ]);
  await expect(page.getByRole('dialog', { name: 'Cannot open file', exact: true })).toContainText(
    'Only one file is allowed at a time.',
  );
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(input).toHaveValue(source.replace('0001', '0002'));
  await expect(page.getByRole('tab', { name: 'Output Analyzer 01', exact: true })).toBeVisible();
});

test('word navigation, four-space prettify and per-session wrapping leave exported text exact', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, 'alpha beta gamma');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ControlOrMeta+ArrowLeft');
  await page.keyboard.insertText('X');
  expect(await readSql(page, info.outputPath('left.sql'))).toBe('alpha beta Xgamma');
  await page.locator('.monaco-editor').click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+ArrowRight');
  await page.keyboard.insertText('Y');
  expect(await readSql(page, info.outputPath('right.sql'))).toBe('alphaY beta Xgamma');
  await page.locator('.monaco-editor').click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowLeft');
  await page.keyboard.insertText('last');
  expect(await readSql(page, info.outputPath('select-word.sql'))).toBe('alphaY beta last');
  await page.locator('.monaco-editor').click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowRight');
  await page.keyboard.insertText('first');
  expect(await readSql(page, info.outputPath('select-word-right.sql'))).toBe('first beta last');
  await enterSql(page, 'select a,b from Demo');
  await page.getByRole('button', { name: 'Prettify', exact: true }).click();
  expect(await readSql(page, info.outputPath('four-spaces.sql'))).toContain('\n    a,\n    b');
  const long =
    'SELECT ' + Array.from({ length: 90 }, (_, i) => `Column${i}`).join(', ') + ' FROM Demo;';
  await enterSql(page, long);
  const wrap = page.getByRole('button', { name: 'Word Wrap', exact: true });
  await expect(wrap).toHaveAttribute('aria-pressed', 'false');
  await wrap.click();
  await expect(wrap).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('.view-line').count()).toBeGreaterThan(1);
  expect(await readSql(page, info.outputPath('wrapped.sql'))).toBe(long);
  await expect(page.locator('.workspace-footer')).toContainText(
    `1 lines · ${long.length.toLocaleString()} characters`,
  );
  await expect(page.locator('.editor-meta,.editor-footer,.tool-heading p')).toHaveCount(0);
  await page.screenshot({ path: `artifacts/sql-workspace-light-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: `artifacts/sql-workspace-dark-${info.project.name}.png` });
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await expect(wrap).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('tab', { name: 'SQL Formatter 01', exact: true }).click();
  await expect(wrap).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(wrap).toHaveAttribute('aria-pressed', 'true');
  expect(await readSql(page, info.outputPath('restored-wrap.sql'))).toBe(long);
});
