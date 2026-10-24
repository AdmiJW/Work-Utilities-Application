import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository';
import { SessionDocument, SessionSummary } from '../models/tool-session';
import { SessionState } from './session-state';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function workspace(open = false) {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const summaries: SessionSummary[] = ['a', 'b', 'c'].map((id, index) => ({
    id,
    toolId: 'sql-formatter',
    name: id,
    isOpen: open,
    createdAt: index + 1,
    updatedAt: index + 1,
  }));
  const documents: Record<string, SessionDocument> = Object.fromEntries(
    summaries.map(({ id }) => [
      id,
      { id, schemaVersion: 1, source: `SELECT '${id}';`, revision: 0, options: { wordWrap: true } },
    ]),
  );
  const repository = {
    list: vi.fn().mockResolvedValue(summaries),
    read: vi.fn((id: string) => Promise.resolve(documents[id])),
    getPreference: vi.fn().mockResolvedValue(undefined),
    setPreference: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    recordAccess: vi.fn().mockResolvedValue(undefined),
    closeMany: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: SessionRepository, useValue: repository }],
  });
  const state = TestBed.inject(SessionState);
  await state.initialize();
  return { state, repository, summaries, documents };
}

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

describe('recently viewed sessions', () => {
  it('builds recents from summaries without loading bodies and falls back to creation time for legacy records', async () => {
    const { state, repository, summaries } = await workspace();
    summaries[0]!.lastViewedAt = 100;
    summaries[0]!.updatedAt = 500;
    summaries[1]!.updatedAt = 200;
    summaries[2]!.createdAt = 300;
    Reflect.deleteProperty(summaries[2]!, 'updatedAt');
    expect(state.recentSessions().map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(repository.read).not.toHaveBeenCalled();
  });
  it('records viewing independently of edits, autosaves, ordering and closure', async () => {
    const { state, repository } = await workspace();
    await state.activate('a');
    const first = state.activeSession()!.lastViewedAt;
    expect(state.activeSession()!.updatedAt).toBe(1);
    expect(repository.save).not.toHaveBeenCalled();
    vi.setSystemTime(20_000);
    state.updateSource('a', 'changed');
    state.updateOptions('a', { wordWrap: false });
    await state.autosave.flush();
    expect(state.activeSession()!.lastViewedAt).toBe(first);
    await state.activate('b');
    expect(state.recentSessions()[0]!.id).toBe('b');
    const calls = repository.recordAccess.mock.calls.length;
    await state.activate('b');
    state.reorder(['b', 'a']);
    expect(repository.recordAccess).toHaveBeenCalledTimes(calls);
    const history = state.recentSessions().map((item) => [item.id, item.lastViewedAt]);
    await state.close('b');
    expect(state.activeId()).toBe('a');
    expect(repository.recordAccess).toHaveBeenCalledTimes(calls);
    await state.close('a');
    expect(state.recentSessions().map((item) => [item.id, item.lastViewedAt])).toEqual(history);
    await state.deleteMany(['b']);
    expect(state.recentSessions().some((item) => item.id === 'b')).toBe(false);
  });
  it('marks new sessions and only the initially active restored session as viewed', async () => {
    const { state, repository } = await workspace(true);
    expect(repository.recordAccess).toHaveBeenCalledExactlyOnceWith('a', 10_000);
    expect(
      state
        .summaries()
        .filter((item) => item.lastViewedAt !== undefined)
        .map((item) => item.id),
    ).toEqual(['a']);
    const id = await state.create('output-analyzer');
    expect(state.recentSessions()[0]!.id).toBe(id);
    expect(state.activeSession()!.lastViewedAt).toBeGreaterThan(10_000);
  });
  it('keeps failures recoverable without advancing recency and retries the same saved session', async () => {
    const { state, repository } = await workspace();
    repository.read.mockRejectedValueOnce(new Error('Read failed'));
    expect(await state.activate('a')).toBe(false);
    expect(state.activeId()).toBeNull();
    expect(state.openingError()).toBe('Read failed');
    expect(state.summaries()[0]!.lastViewedAt).toBeUndefined();
    expect(await state.activate('a')).toBe(true);
    expect(state.document('a')!.options['wordWrap']).toBe(true);
    expect(state.activeId()).toBe('a');
    expect(state.openingError()).toBe('');
  });
  it('deduplicates pending reopens and ignores a read superseded by another selection', async () => {
    const { state, repository, documents } = await workspace();
    const pending = deferred<SessionDocument>();
    repository.read.mockImplementationOnce(() => pending.promise);
    const first = state.activate('a');
    expect(state.openingId()).toBe('a');
    expect(await state.activate('a')).toBe(false);
    expect(await state.activate('b')).toBe(true);
    pending.resolve(documents['a']!);
    expect(await first).toBe(false);
    expect(state.activeId()).toBe('b');
    expect(state.summaries().find((item) => item.id === 'a')!.lastViewedAt).toBeUndefined();
    expect(repository.read).toHaveBeenCalledTimes(2);
  });
  it('ignores a delayed reopen after creating a new session or deleting the requested session', async () => {
    const { state, repository, documents } = await workspace();
    const pending = deferred<SessionDocument>();
    repository.read.mockImplementationOnce(() => pending.promise);
    const opening = state.activate('a');
    const id = await state.create('sql-formatter');
    pending.resolve(documents['a']!);
    expect(await opening).toBe(false);
    expect(state.activeId()).toBe(id);
    const deleted = deferred<SessionDocument>();
    repository.read.mockImplementationOnce(() => deleted.promise);
    const second = state.activate('c');
    await state.deleteMany(['c']);
    deleted.resolve(documents['c']!);
    expect(await second).toBe(false);
    expect(state.activeId()).toBe(id);
    expect(state.document('c')).toBeUndefined();
  });
});
