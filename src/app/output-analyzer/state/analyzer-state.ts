import { Injectable, effect, inject } from '@angular/core';
import { downloadFile } from '../../file-transfer/public-api';
import { SessionState } from '../../sessions/public-api';
import { AnalysisResult } from '../models/analysis-result';
import { AnalyzerRuntime, createAnalyzerRuntime } from './analyzer-session-state';
import { WorkbookIssue } from '../models/workbook-plan';

type AnalysisMessage =
  | { type: 'progress'; progress: number }
  | { type: 'complete'; result: AnalysisResult }
  | { type: 'error'; error: string };
type ExportMessage =
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'invalid'; issues: WorkbookIssue[] }
  | { type: 'error'; error: string };

@Injectable({ providedIn: 'root' })
export class AnalyzerState {
  private readonly sessions = inject(SessionState);
  private readonly entries = new Map<string, AnalyzerRuntime>();

  constructor() {
    effect(() => {
      const open = new Set(
        this.sessions
          .summaries()
          .filter((item) => item.isOpen)
          .map((item) => item.id),
      );
      for (const [id, entry] of this.entries)
        if (!open.has(id)) {
          entry.analysisWorker?.terminate();
          entry.exportWorker?.terminate();
          this.entries.delete(id);
        }
    });
  }

  get(id: string): AnalyzerRuntime {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = createAnalyzerRuntime();
      this.entries.set(id, entry);
    }
    return entry;
  }

  analyze(id: string): void {
    const document = this.sessions.document(id);
    if (!document?.source.trim()) return;
    const entry = this.get(id);
    entry.analysisWorker?.terminate();
    entry.analyzing.set(true);
    entry.progress.set(0);
    entry.error.set('');
    entry.exportIssues.set([]);
    const revision = document.revision ?? 0;
    const worker = new Worker(new URL('../workers/analyze-output.worker', import.meta.url), {
      type: 'module',
    });
    entry.analysisWorker = worker;
    worker.onmessage = (event: MessageEvent<AnalysisMessage>) => {
      if (entry.analysisWorker !== worker) return;
      const message = event.data;
      if (message.type === 'progress') entry.progress.set(message.progress);
      else {
        entry.analyzing.set(false);
        worker.terminate();
        entry.analysisWorker = null;
        if (message.type === 'error') entry.error.set(message.error);
        else {
          entry.result.set(message.result);
          entry.analyzedRevision.set(revision);
          entry.selectedCell.set(null);
          entry.inspectorOpen.set(false);
          const savedSheet = document.options['selectedSheet'];
          const keys = message.result.statements
            .filter((item) => item.kind === 'SELECT')
            .map((item) => String(item.index));
          if (message.result.statements.some((item) => item.kind !== 'SELECT'))
            keys.push('summary');
          if (message.result.diagnostics.length) keys.push('diagnostics');
          entry.selectedSheet.set(
            typeof savedSheet === 'string' && keys.includes(savedSheet)
              ? savedSheet
              : (keys[0] ?? 'summary'),
          );
          if ((this.sessions.document(id)?.revision ?? 0) === revision) {
            const firstAnalysis =
              this.sessions.document(id)?.options['inputCollapsed'] === undefined;
            this.sessions.updateOptions(id, {
              analyzed: true,
              ...(firstAnalysis && message.result.statements.length
                ? { inputCollapsed: true }
                : {}),
            });
          }
        }
      }
    };
    worker.onerror = () => {
      if (entry.analysisWorker !== worker) return;
      entry.error.set(
        'The analysis worker could not run. Retry after the application is fully cached.',
      );
      entry.analyzing.set(false);
      worker.terminate();
      entry.analysisWorker = null;
    };
    worker.postMessage({ source: document.source });
  }

  cancel(id: string): void {
    const entry = this.get(id);
    entry.analysisWorker?.terminate();
    entry.analysisWorker = null;
    entry.analyzing.set(false);
    entry.error.set('Analysis cancelled. Your source text is unchanged.');
  }

  export(id: string): void {
    const entry = this.get(id);
    const result = entry.result();
    if (
      !result ||
      entry.analyzing() ||
      entry.analyzedRevision() !== (this.sessions.document(id)?.revision ?? 0)
    )
      return;
    entry.exportWorker?.terminate();
    entry.exporting.set(true);
    entry.error.set('');
    entry.exportIssues.set([]);
    const name = this.sessions.summaries().find((item) => item.id === id)?.name ?? 'results';
    const worker = new Worker(new URL('../workers/export-workbook.worker', import.meta.url), {
      type: 'module',
    });
    entry.exportWorker = worker;
    worker.onmessage = (event: MessageEvent<ExportMessage>) => {
      if (entry.exportWorker !== worker) return;
      entry.exporting.set(false);
      const message = event.data;
      if (message.type === 'invalid') entry.exportIssues.set(message.issues);
      else if (message.type === 'error') entry.error.set(message.error);
      else
        downloadFile(
          message.buffer,
          name,
          '.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      worker.terminate();
      entry.exportWorker = null;
    };
    worker.onerror = () => {
      if (entry.exportWorker !== worker) return;
      entry.error.set('The export worker could not run. Your results are still available.');
      entry.exporting.set(false);
      worker.terminate();
      entry.exportWorker = null;
    };
    worker.postMessage({ result });
  }
}
