import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository';
import { SessionDocument, SessionSummary } from '../models/tool-session';
import { SessionState } from './session-state';

async function workspace() {
  vi.useFakeTimers();
  const summaries: SessionSummary[] = ['one', 'two', 'three'].map((id) => ({
    id,
    toolId: 'sql-formatter',
    name: id,
    createdAt: 0,
    updatedAt: 0,
    isOpen: true,
  }));
  const documents: Record<string, SessionDocument> = Object.fromEntries(
    summaries.map(({ id }) => [
      id,
      { id, schemaVersion: 1, revision: 0, source: `SELECT '${id}';`, options: {} },
    ]),
  );
  const preferences = new Map<string, unknown>();
  const repository = {
    list: vi.fn().mockResolvedValue(summaries),
    read: vi.fn((id: string) => Promise.resolve(documents[id])),
    getPreference: vi.fn((key: string) => Promise.resolve(preferences.get(key))),
    setPreference: vi.fn((key: string, value: unknown) => {
      preferences.set(key, value);
      return Promise.resolve();
    }),
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
  return { state, repository, preferences };
}

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

describe('workspace ordering and batch session lifecycle', () => {
  it('persists valid ordering without changing the active tab and rejects incomplete/duplicate orders', async () => {
    const { state, preferences } = await workspace();
    state.reorder(['three', 'one', 'two']);
    expect(state.openSessions().map((item) => item.id)).toEqual(['three', 'one', 'two']);
    expect(state.activeId()).toBe('one');
    expect(preferences.get('workspace')).toMatchObject({
      order: ['three', 'one', 'two'],
      activeId: 'one',
    });
    state.reorder(['one', 'one', 'two']);
    state.reorder(['one']);
    expect(state.openSessions()[0]!.id).toBe('three');
  });
  it('leaves all target tabs open when any save fails, then archives them together after a successful retry', async () => {
    const { state, repository } = await workspace();
    state.updateSource('one', 'latest edit');
    repository.save.mockRejectedValueOnce(new Error('Quota exceeded'));
    expect(await state.closeMany(['one', 'two'])).toBe(false);
    expect(state.openSessions()).toHaveLength(3);
    expect(state.document('one')!.source).toBe('latest edit');
    expect(repository.closeMany).not.toHaveBeenCalled();
    expect(await state.closeMany(['one', 'two'])).toBe(true);
    expect(state.openSessions().map((item) => item.id)).toEqual(['three']);
    expect(state.activeId()).toBe('three');
    expect(state.summaries().filter((item) => !item.isOpen)).toHaveLength(2);
    expect(repository.closeMany).toHaveBeenCalledTimes(1);
  });
  it('retains tabs when the close transaction fails and chooses the nearest survivor after retry', async () => {
    const { state, repository } = await workspace();
    await state.activate('two');
    repository.closeMany.mockRejectedValueOnce(new Error('Storage unavailable'));
    expect(await state.closeMany(['two'])).toBe(false);
    expect(state.activeId()).toBe('two');
    expect(await state.closeMany(['two'])).toBe(true);
    expect(state.activeId()).toBe('one');
  });
  it('resumes pending saves after a failed deletion, and never resurrects successfully deleted sessions', async () => {
    const { state, repository } = await workspace();
    state.updateSource('one', 'recover me');
    repository.deleteMany.mockRejectedValueOnce(new Error('Delete failed'));
    expect(await state.deleteMany(['one', 'two'])).toBe(false);
    expect(state.openSessions()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'one' }),
      expect.objectContaining({ source: 'recover me' }),
    );
    state.updateSource('one', 'discard me');
    expect(await state.deleteMany(['one', 'two'])).toBe(true);
    const savedCount = repository.save.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(repository.save).toHaveBeenCalledTimes(savedCount);
    expect(state.summaries().map((item) => item.id)).toEqual(['three']);
    expect(state.document('one')).toBeUndefined();
  });
});
