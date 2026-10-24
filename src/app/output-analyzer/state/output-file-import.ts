import { Injectable, inject } from '@angular/core';
import { FileImportState, ImportDecision, PendingFileImport } from '../../file-transfer/public-api';
import { SessionState } from '../../sessions/public-api';

interface TextSelection {
  start: number;
  end: number;
}
interface OutputImportTarget {
  sessionId: string;
  revision: number;
  empty: boolean;
  selection: TextSelection;
}

@Injectable()
export class OutputFileImport {
  private readonly sessions = inject(SessionState);
  readonly state = new FileImportState<OutputImportTarget>();
  private disposed = false;

  selection(id: string): TextSelection {
    const value = this.sessions.document(id)?.options['sourceSelection'];
    if (
      value &&
      typeof value === 'object' &&
      'start' in value &&
      'end' in value &&
      typeof value.start === 'number' &&
      typeof value.end === 'number'
    )
      return { start: value.start, end: value.end };
    return { start: 0, end: 0 };
  }
  rememberSelection(id: string, input: HTMLTextAreaElement): void {
    const selection = { start: input.selectionStart, end: input.selectionEnd };
    const previous = this.selection(id);
    if (selection.start !== previous.start || selection.end !== previous.end)
      this.sessions.updateOptions(id, { sourceSelection: selection });
  }
  async open(files: File[], id: string): Promise<boolean> {
    const document = this.sessions.document(id);
    if (!document) return false;
    const request = await this.state.read(files, '.txt', {
      sessionId: id,
      revision: document.revision,
      empty: !document.source.length,
      selection: this.selection(id),
    });
    if (!request || this.disposed || !this.valid(request)) return false;
    if (request.target.empty) return this.apply(request, 'replace');
    this.state.pending.set(request);
    return false;
  }
  decide(decision: ImportDecision): boolean {
    const request = this.state.pending();
    this.state.pending.set(null);
    return (
      !!request && decision !== 'cancel' && this.valid(request) && this.apply(request, decision)
    );
  }
  dispose(): void {
    this.disposed = true;
  }
  private valid(request: PendingFileImport<OutputImportTarget>): boolean {
    if (this.sessions.document(request.target.sessionId)?.revision === request.target.revision)
      return true;
    this.state.error.set(
      'The session changed while opening the file. Open the file again to choose where to import it.',
    );
    return false;
  }
  private apply(
    request: PendingFileImport<OutputImportTarget>,
    decision: 'replace' | 'insert',
  ): boolean {
    const { sessionId, selection } = request.target;
    const document = this.sessions.document(sessionId)!;
    const source = document.source;
    const start = Math.min(source.length, selection.start);
    const end = Math.min(source.length, selection.end);
    const value =
      decision === 'replace'
        ? request.source
        : source.slice(0, start) + request.source + source.slice(end);
    const cursor = (decision === 'replace' ? 0 : start) + request.source.length;
    this.sessions.updateSource(sessionId, value);
    this.sessions.updateOptions(sessionId, {
      ...(document.options['inputCollapsed'] === true ? { inputCollapsed: false } : {}),
      fileName: request.fileName,
      sourceSelection: { start: cursor, end: cursor },
    });
    return true;
  }
}
