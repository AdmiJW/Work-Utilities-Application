import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionState, SessionDocument } from '../../sessions/public-api';
import { parseOutputFile } from '../functions/parse-output-file';
import { AnalyzerState } from './analyzer-state';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  constructor() {
    TestWorker.instances.push(this);
  }
  postMessage(): void {
    /* Messages are completed explicitly by the test. */
  }
  terminate(): void {
    /* Keep queued callbacks available to exercise a late event. */
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  TestBed.resetTestingModule();
});

describe('background analysis ownership', () => {
  it('ignores a late failure from a superseded worker and accepts the current result', () => {
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
    const source = "SQL Statement Run: --1SELECT CONCAT_WS('|',Id,State) FROM Demo\n0001|ACTIVE";
    const document: SessionDocument = {
      id: 'session',
      schemaVersion: 1,
      source,
      revision: 1,
      options: {},
    };
    const sessions = {
      summaries: signal([{ id: 'session', isOpen: true }]),
      document: () => document,
      updateOptions: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SessionState, useValue: sessions }] });
    const state = TestBed.inject(AnalyzerState);
    state.analyze('session');
    state.analyze('session');
    const [oldWorker, currentWorker] = TestWorker.instances;
    oldWorker!.onerror?.(new ErrorEvent('error'));
    expect(state.get('session').analyzing()).toBe(true);
    expect(state.get('session').error()).toBe('');
    const result = parseOutputFile(source);
    currentWorker!.onmessage?.(new MessageEvent('message', { data: { type: 'complete', result } }));
    expect(state.get('session').analyzing()).toBe(false);
    expect(state.get('session').result()?.parsedRows).toBe(1);
  });
});
