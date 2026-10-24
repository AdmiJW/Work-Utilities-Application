import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository';
import { SessionDocument, SessionSummary } from '../models/tool-session';
import { SessionAutosave } from './session-autosave';

const summary: SessionSummary = {
  id: 'one',
  toolId: 'sql-formatter',
  name: 'One',
  createdAt: 0,
  updatedAt: 0,
  isOpen: true,
};
const document = (source: string): SessionDocument => ({
  id: 'one',
  schemaVersion: 1,
  source,
  revision: 0,
  options: {},
});

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

describe('session autosave', () => {
  it('debounces edits for ten seconds and restarts the timer after another edit', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: SessionRepository, useValue: { save } }],
    });
    const autosave = TestBed.inject(SessionAutosave);
    autosave.schedule(summary, document('first'));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(save).not.toHaveBeenCalled();
    autosave.schedule(summary, document('latest'));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(summary, document('latest'));
    expect(autosave.status()).toBe('saved');
  });
  it('drains an in-flight save, suspends newer edits, and discards them after a successful deletion', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const save = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SessionRepository, useValue: { save } }],
    });
    const autosave = TestBed.inject(SessionAutosave);
    autosave.schedule(summary, document('first'));
    const flushing = autosave.flush();
    await Promise.resolve();
    autosave.schedule(summary, document('latest'));
    const suspended = autosave.suspend(['one']);
    finish();
    await suspended;
    await flushing;
    autosave.resume(['one'], true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.status()).toBe('saved');
  });
  it('flushes a newer edit that arrives during an in-flight write', async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: SessionRepository, useValue: { save } }],
    });
    const autosave = TestBed.inject(SessionAutosave);
    autosave.schedule(summary, document('first'));
    const flushing = autosave.flush();
    await Promise.resolve();
    autosave.schedule(summary, document('latest'));
    release!();
    expect(await flushing).toBe(true);
    expect(save).toHaveBeenLastCalledWith(summary, document('latest'));
    expect(autosave.status()).toBe('saved');
  });
  it('retains failed saves and supports retry without claiming success', async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Quota exceeded'))
      .mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: SessionRepository, useValue: { save } }],
    });
    const autosave = TestBed.inject(SessionAutosave);
    autosave.schedule(summary, document('keep this'));
    expect(await autosave.flush()).toBe(false);
    expect(autosave.status()).toBe('error');
    expect(autosave.error()).toContain('Quota');
    expect(await autosave.flush()).toBe(true);
    expect(autosave.status()).toBe('saved');
  });
});
