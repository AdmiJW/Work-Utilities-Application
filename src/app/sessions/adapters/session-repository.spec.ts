import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from './session-repository';
import { SessionDocument, SessionSummary } from '../models/tool-session';

describe('IndexedDB sessions', () => {
  it('persists access metadata without document writes, and preserves it across stale autosaves', async () => {
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    const repository = new SessionRepository();
    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      id,
      toolId: 'sql-formatter',
      name: 'Legacy session',
      isOpen: false,
      createdAt: 1,
      updatedAt: 2,
    };
    const document: SessionDocument = {
      id,
      schemaVersion: 1,
      source: 'SELECT 0001;',
      revision: 0,
      options: { wordWrap: true },
    };
    await repository.save(summary, document);
    const writes = vi.spyOn(IDBObjectStore.prototype, 'put');
    try {
      await repository.recordAccess(id, 100);
      expect(
        writes.mock.contexts.some(
          (store) => store instanceof IDBObjectStore && store.name === 'documents',
        ),
      ).toBe(false);
    } finally {
      writes.mockRestore();
    }
    expect(await repository.read(id)).toEqual(document);
    expect((await repository.list()).find((item) => item.id === id)).toMatchObject({
      lastViewedAt: 100,
      updatedAt: 2,
      isOpen: true,
    });
    await repository.save({ ...summary, isOpen: true }, { ...document, source: 'new edit' });
    await repository.recordAccess(id, 50);
    expect((await repository.list()).find((item) => item.id === id)?.lastViewedAt).toBe(100);
    const reloaded = new SessionRepository();
    expect((await reloaded.list()).find((item) => item.id === id)?.lastViewedAt).toBe(100);
    await repository.delete(id);
    await repository.recordAccess(id, 200);
    expect((await repository.list()).some((item) => item.id === id)).toBe(false);
  });
  beforeEach(() => {
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });
  it('stores documents separately, preserves text exactly, and supports closing/deletion', async () => {
    const repository = new SessionRepository();
    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      id,
      toolId: 'sql-formatter',
      name: 'My query',
      createdAt: 1,
      updatedAt: 2,
      isOpen: true,
    };
    const document: SessionDocument = {
      id,
      schemaVersion: 1,
      source: "SELECT '0001';\n-- comment",
      revision: 1,
      options: { editorView: '{}' },
    };
    await repository.save(summary, document);
    expect((await repository.list()).find((item) => item.id === id)).toEqual(summary);
    expect(await repository.read(id)).toEqual(document);
    await repository.saveSummary({ ...summary, isOpen: false });
    expect((await repository.list()).find((item) => item.id === id)?.isOpen).toBe(false);
    expect((await repository.read(id))?.source).toBe(document.source);
    await repository.delete(id);
    expect(await repository.read(id)).toBeUndefined();
  });
  it('rejects unknown snapshot versions and rolls back a failed document write atomically', async () => {
    const repository = new SessionRepository();
    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      id,
      toolId: 'sql-formatter',
      name: 'Future',
      createdAt: 0,
      updatedAt: 0,
      isOpen: true,
    };
    await repository.save(summary, {
      id,
      schemaVersion: 2,
      source: 'keep this',
      revision: 0,
      options: {},
    });
    await expect(repository.read(id)).rejects.toThrow('unsupported application version');
    expect((await repository.list()).some((item) => item.id === id)).toBe(true);
    await repository.delete(id);
    await expect(
      repository.save(summary, {
        id,
        schemaVersion: 1,
        source: 'text',
        revision: 0,
        options: { invalid: () => undefined },
      }),
    ).rejects.toThrow();
    expect((await repository.list()).some((item) => item.id === id)).toBe(false);
  });
  it('commits batch lifecycle metadata together and rolls back deletions when workspace persistence fails', async () => {
    const repository = new SessionRepository();
    const ids: string[] = [crypto.randomUUID(), crypto.randomUUID()];
    const summaries: SessionSummary[] = ids.map((id) => ({
      id,
      toolId: 'sql-formatter',
      name: id,
      createdAt: 0,
      updatedAt: 0,
      isOpen: true,
    }));
    for (const summary of summaries)
      await repository.save(summary, {
        id: summary.id,
        schemaVersion: 1,
        source: 'recover me',
        revision: 1,
        options: {},
      });
    const workspace = {
      order: ids,
      activeId: ids[0]!,
      counters: { 'sql-formatter': 2, 'output-analyzer': 0 },
    };
    const invalidWorkspace = { ...workspace, uncloneable: () => undefined };
    await expect(repository.deleteMany(ids, invalidWorkspace)).rejects.toThrow();
    for (const id of ids) expect((await repository.read(id))?.source).toBe('recover me');
    await expect(
      repository.closeMany(
        summaries.map((item) => ({ ...item, isOpen: false })),
        invalidWorkspace,
      ),
    ).rejects.toThrow();
    expect(
      (await repository.list())
        .filter((item) => ids.includes(item.id))
        .every((item) => item.isOpen),
    ).toBe(true);
    const closedWorkspace = { ...workspace, order: [], activeId: null };
    await repository.closeMany(
      summaries.map((item) => ({ ...item, isOpen: false })),
      closedWorkspace,
    );
    expect(
      (await repository.list())
        .filter((item) => ids.includes(item.id))
        .every((item) => !item.isOpen),
    ).toBe(true);
    expect(await repository.getPreference('workspace')).toEqual(closedWorkspace);
    await repository.deleteMany(ids, closedWorkspace);
    for (const id of ids) expect(await repository.read(id)).toBeUndefined();
  });
});
