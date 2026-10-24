import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  input,
  DestroyRef,
  ElementRef,
  Injector,
  viewChild,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTableProperties,
  lucideFileUp,
  lucidePlay,
  lucideDownload,
  lucideChevronDown,
  lucideChevronRight,
  lucideClipboardList,
  lucideTriangleAlert,
  lucideFileText,
  lucideCopy,
  lucideX,
  lucidePanelRightOpen,
} from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { AppearanceState } from '../../../appearance/public-api';
import {
  copyText,
  FileDrop,
  FileImportDialog,
  ImportDecision,
} from '../../../file-transfer/public-api';
import { SessionState } from '../../../sessions/public-api';
import { AnalyzerState } from '../../state/analyzer-state';
import { ResultGrid } from '../result-grid/result-grid';
import { CellInspector } from '../cell-inspector/cell-inspector';
import { AnalysisDiagnostics } from '../analysis-diagnostics/analysis-diagnostics';
import { OutputFileImport } from '../../state/output-file-import';
import { InspectorLayout } from '../../adapters/inspector-layout';

@Component({
  selector: 'app-output-analyzer',
  imports: [
    Button,
    Dialog,
    NgIcon,
    ResultGrid,
    CellInspector,
    AnalysisDiagnostics,
    FileDrop,
    FileImportDialog,
  ],
  providers: [
    OutputFileImport,
    provideIcons({
      lucideTableProperties,
      lucideFileUp,
      lucidePlay,
      lucideDownload,
      lucideChevronDown,
      lucideChevronRight,
      lucideClipboardList,
      lucideTriangleAlert,
      lucideFileText,
      lucideCopy,
      lucideX,
      lucidePanelRightOpen,
    }),
  ],
  templateUrl: './output-analyzer.html',
  styleUrl: './output-analyzer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutputAnalyzer {
  readonly sessionId = input.required<string>();
  readonly sessions = inject(SessionState);
  readonly appearance = inject(AppearanceState);
  readonly tasks = inject(AnalyzerState);
  readonly imports = inject(OutputFileImport);
  private readonly injector = inject(Injector);
  readonly sourceInput = viewChild<ElementRef<HTMLTextAreaElement>>('sourceInput');
  readonly runtime = computed(() => this.tasks.get(this.sessionId()));
  readonly document = computed(() => this.sessions.document(this.sessionId()));
  readonly source = computed(() => this.document()?.source ?? '');
  readonly inputCollapsed = computed(() => this.document()?.options['inputCollapsed'] === true);
  readonly name = computed(
    () =>
      this.sessions.summaries().find((item) => item.id === this.sessionId())?.name ??
      'Output Analyzer',
  );
  readonly decodeMode = computed(() =>
    this.document()?.options['jsonDecodeMode'] === 'deep' ? 'deep' : 'shallow',
  );
  readonly result = computed(() => this.runtime().result());
  readonly selectStatements = computed(
    () => this.result()?.statements.filter((statement) => statement.kind === 'SELECT') ?? [],
  );
  readonly hasSummaries = computed(
    () => this.result()?.statements.some((statement) => statement.kind !== 'SELECT') ?? false,
  );
  readonly activeStatements = computed(() =>
    this.selectStatements().filter(
      (statement) => String(statement.index) === this.runtime().selectedSheet(),
    ),
  );
  readonly stale = computed(
    () => !!this.result() && this.runtime().analyzedRevision() !== (this.document()?.revision ?? 0),
  );
  readonly canExport = computed(
    () =>
      !!this.result()?.statements.length &&
      !this.stale() &&
      !this.runtime().analyzing() &&
      !this.runtime().exporting(),
  );
  readonly layout = new InspectorLayout((width) =>
    this.sessions.updateOptions(this.sessionId(), { inspectorWidth: width }),
  );
  private restored = false;

  constructor() {
    effect(() => {
      const document = this.document();
      const runtime = this.runtime();
      if (!this.restored && document) {
        this.restored = true;
        this.layout.restore(document.options['inspectorWidth']);
        if (
          document.options['analyzed'] === true &&
          !untracked(runtime.result) &&
          !untracked(runtime.analyzing)
        )
          untracked(() => this.tasks.analyze(this.sessionId()));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.imports.dispose();
      this.layout.dispose();
    });
  }

  sourceChanged(event: Event): void {
    this.sessions.updateSource(this.sessionId(), (event.target as HTMLTextAreaElement).value);
    this.rememberSelection();
  }
  rememberSelection(): void {
    const input = this.sourceInput()?.nativeElement;
    if (input) this.imports.rememberSelection(this.sessionId(), input);
  }
  toggleInput(): void {
    this.sessions.updateOptions(this.sessionId(), { inputCollapsed: !this.inputCollapsed() });
  }
  selectSheet(value: string): void {
    this.runtime().selectedSheet.set(value);
    this.runtime().selectedCell.set(null);
    this.runtime().inspectorOpen.set(false);
    this.sessions.updateOptions(this.sessionId(), { selectedSheet: value });
  }
  saveGridView(event: { sheetIndex: number; value: string }): void {
    this.sessions.updateOptions(this.sessionId(), { [`grid-${event.sheetIndex}`]: event.value });
  }
  gridView(index: number): string {
    const value = this.document()?.options[`grid-${index}`];
    return typeof value === 'string' ? value : '';
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.openFiles(files);
  }
  async openFiles(files: File[]): Promise<void> {
    this.rememberSelection();
    if (await this.imports.open(files, this.sessionId())) this.focusSource();
  }
  decideImport(decision: ImportDecision): void {
    if (this.imports.decide(decision)) this.focusSource();
  }
  private focusSource(): void {
    afterNextRender(
      () => {
        const input = this.sourceInput()?.nativeElement;
        const selection = this.imports.selection(this.sessionId());
        input?.focus();
        input?.setSelectionRange(selection.start, selection.end);
      },
      { injector: this.injector },
    );
  }

  async copySql(sql: string): Promise<void> {
    try {
      await copyText(sql);
    } catch (error) {
      this.runtime().error.set(error instanceof Error ? error.message : 'Copy failed.');
    }
  }
}
