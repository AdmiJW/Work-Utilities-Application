import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { IRange } from 'monaco-editor';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlignLeft,
  lucideDownload,
  lucideFileUp,
  lucideMinimize2,
  lucideCodeXml,
  lucideWrapText,
} from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { AppearanceState } from '../../../appearance/public-api';
import {
  downloadFile,
  FileDrop,
  FileImportDialog,
  FileImportState,
  ImportDecision,
  PendingFileImport,
} from '../../../file-transfer/public-api';
import { SessionState } from '../../../sessions/public-api';
import { formatSqlAsOneLine } from '../../functions/format-sql-as-one-line';
import { prettifySql } from '../../functions/prettify-sql';
import { SqlEditor } from '../sql-editor/sql-editor';

interface SqlImportTarget {
  sessionId: string;
  revision: number;
  empty: boolean;
  selection: IRange | null;
}

@Component({
  selector: 'app-sql-formatter',
  imports: [Button, NgIcon, SqlEditor, FileDrop, FileImportDialog],
  providers: [
    provideIcons({
      lucideAlignLeft,
      lucideDownload,
      lucideFileUp,
      lucideMinimize2,
      lucideCodeXml,
      lucideWrapText,
    }),
  ],
  templateUrl: './sql-formatter.html',
  styleUrl: './sql-formatter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SqlFormatter {
  readonly sessionId = input.required<string>();
  readonly sessions = inject(SessionState);
  readonly appearance = inject(AppearanceState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editor = viewChild.required(SqlEditor);
  readonly source = computed(() => this.sessions.document(this.sessionId())?.source ?? '');
  readonly name = computed(
    () =>
      this.sessions.summaries().find((item) => item.id === this.sessionId())?.name ??
      'SQL Formatter',
  );
  readonly wordWrap = computed(
    () => this.sessions.document(this.sessionId())?.options['wordWrap'] === true,
  );
  readonly editorView = computed(() => {
    const value = this.sessions.document(this.sessionId())?.options['editorView'];
    return typeof value === 'string' ? value : '';
  });
  readonly error = signal('');
  readonly fileImport = new FileImportState<SqlImportTarget>();
  private pickerTarget: SqlImportTarget | null = null;

  format(mode: 'pretty' | 'compact'): void {
    this.error.set('');
    try {
      this.sessions.updateSource(
        this.sessionId(),
        mode === 'pretty' ? prettifySql(this.source()) : formatSqlAsOneLine(this.source()),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The SQL could not be formatted.');
    }
  }
  export(): void {
    downloadFile(this.source(), this.name(), '.sql', 'application/sql;charset=utf-8');
  }
  toggleWrap(): void {
    this.sessions.updateOptions(this.sessionId(), { wordWrap: !this.wordWrap() });
  }
  openPicker(input: HTMLInputElement): void {
    this.pickerTarget = this.captureTarget();
    input.click();
  }
  async importFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.openFiles(files, this.pickerTarget ?? this.captureTarget());
    this.pickerTarget = null;
  }
  async openFiles(files: File[], target = this.captureTarget()): Promise<void> {
    const request = await this.fileImport.read(files, '.sql', target);
    if (!request || this.destroyRef.destroyed) return;
    if (!this.validTarget(request)) return;
    if (target.empty) this.applyImport(request, 'replace');
    else this.fileImport.pending.set(request);
  }
  decideImport(decision: ImportDecision): void {
    const request = this.fileImport.pending();
    this.fileImport.pending.set(null);
    if (request && decision !== 'cancel' && this.validTarget(request))
      this.applyImport(request, decision);
  }
  private applyImport(
    request: PendingFileImport<SqlImportTarget>,
    decision: 'replace' | 'insert',
  ): void {
    this.editor().importText(request.source, decision === 'replace', request.target.selection);
  }
  private validTarget(request: PendingFileImport<SqlImportTarget>): boolean {
    const document = this.sessions.document(request.target.sessionId);
    if (
      request.target.sessionId !== this.sessionId() ||
      document?.revision !== request.target.revision
    ) {
      this.fileImport.error.set(
        'The session changed while opening the file. Open the file again to choose where to import it.',
      );
      return false;
    }
    return true;
  }
  private captureTarget(): SqlImportTarget {
    const document = this.sessions.document(this.sessionId());
    return {
      sessionId: this.sessionId(),
      revision: document?.revision ?? 0,
      empty: !this.source().length,
      selection: this.editor().captureSelection(),
    };
  }
}
