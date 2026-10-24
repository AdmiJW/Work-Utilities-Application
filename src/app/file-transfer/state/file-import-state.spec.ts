import { describe, expect, it, vi } from 'vitest';
import { FileImportState } from './file-import-state';

function file(name: string, bytes = new TextEncoder().encode('SELECT 0001;\r\n')): File {
  return { name, arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer) } as unknown as File;
}

describe('single-file import validation and reading', () => {
  it('rejects multiple files and the wrong extension before reading any content', async () => {
    const state = new FileImportState<string>();
    const sql = file('query.sql');
    const read = vi.spyOn(sql, 'arrayBuffer');
    expect(await state.read([sql, sql], '.sql', 'target')).toBeNull();
    expect(state.error()).toBe('Only one file is allowed at a time.');
    expect(read).not.toHaveBeenCalled();
    expect(await state.read([sql], '.txt', 'target')).toBeNull();
    expect(state.error()).toContain('.txt');
    expect(read).not.toHaveBeenCalled();
  });
  it('preserves UTF-8 text and the captured target, and supports UTF-16 BOM files', async () => {
    const state = new FileImportState<{ id: string; start: number }>();
    const target = { id: 'session', start: 12 };
    const request = await state.read([file('QUERY.SQL')], '.sql', target);
    expect(request).toEqual({ fileName: 'QUERY.SQL', source: 'SELECT 0001;\r\n', target });
    const encoded = new Uint8Array([0xff, 0xfe, 0x30, 0, 0x30, 0, 0x31, 0]);
    expect((await state.read([file('utf16.sql', encoded)], '.sql', target))?.source).toBe('001');
  });
  it('shows read errors without producing a request or leaving the importer busy', async () => {
    const state = new FileImportState<string>();
    const invalid = file('bad.txt', new Uint8Array([0xc3, 0x28]));
    expect(await state.read([invalid], '.txt', 'same tab')).toBeNull();
    expect(state.error()).toContain('not valid UTF-8');
    expect(state.pending()).toBeNull();
    expect(state.reading()).toBe(false);
  });
});
