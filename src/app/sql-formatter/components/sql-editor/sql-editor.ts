import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { editor, IRange } from 'monaco-editor';
import { createSqlEditor, setSqlEditorTheme } from '../../adapters/create-sql-editor';
import { SqlEditorModels } from '../../state/sql-editor-models';

@Component({
  selector: 'app-sql-editor',
  template: '<div #editorHost class="editor-host" data-testid="sql-editor"></div>',
  styles:
    ':host { display: block; height: 100%; min-height: 200px; } .editor-host { height: 100%; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SqlEditor {
  readonly sessionId = input.required<string>();
  readonly source = input.required<string>();
  readonly dark = input(false);
  readonly savedView = input('');
  readonly wordWrap = input(false);
  readonly sourceChange = output<string>();
  readonly viewChanged = output<string>();
  readonly host = viewChild.required<ElementRef<HTMLElement>>('editorHost');
  private readonly models = inject(SqlEditorModels);
  private instance: editor.IStandaloneCodeEditor | undefined;

  constructor() {
    afterNextRender(() => {
      this.instance = createSqlEditor(
        this.host().nativeElement,
        this.sessionId(),
        this.source(),
        this.dark(),
        this.wordWrap(),
      );
      this.models.register(this.sessionId());
      try {
        const saved: unknown = JSON.parse(this.savedView() || 'null');
        if (saved && typeof saved === 'object' && 'viewState' in saved && 'cursorState' in saved)
          this.instance.restoreViewState(saved as editor.ICodeEditorViewState);
      } catch {
        /* Ignore obsolete editor view settings. */
      }
      this.instance.onDidChangeModelContent(() => {
        if (this.instance) this.sourceChange.emit(this.instance.getValue());
      });
      this.instance.onDidChangeCursorPosition(() => this.saveView());
      this.instance.onDidScrollChange(() => this.saveView());
    });
    effect(() => {
      const source = this.source();
      if (this.instance && this.instance.getValue() !== source) {
        const model = this.instance.getModel();
        if (model) {
          this.instance.pushUndoStop();
          this.instance.executeEdits('workplace-format', [
            { range: model.getFullModelRange(), text: source },
          ]);
          this.instance.pushUndoStop();
        }
      }
    });
    effect(() => {
      const dark = this.dark();
      if (this.instance) setSqlEditorTheme(dark);
    });
    effect(() => {
      const wrap = this.wordWrap();
      this.instance?.updateOptions({ wordWrap: wrap ? 'on' : 'off' });
    });
    inject(DestroyRef).onDestroy(() => this.instance?.dispose());
  }
  captureSelection(): IRange | null {
    return this.instance?.getSelection() ?? null;
  }
  importText(source: string, replace: boolean, selection: IRange | null): void {
    const instance = this.instance;
    const model = instance?.getModel();
    if (!instance || !model) return;
    instance.pushUndoStop();
    // Record text offsets in the destination EOL convention so undo removes the entire replacement.
    if (replace) model.pushEOL(source.includes('\r\n') ? 1 : 0);
    instance.executeEdits('work-import', [
      {
        range: replace
          ? model.getFullModelRange()
          : (selection ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
        text: source,
      },
    ]);
    instance.pushUndoStop();
    instance.focus();
  }
  private saveView(): void {
    const state = this.instance?.saveViewState();
    if (state) this.viewChanged.emit(JSON.stringify(state));
  }
}
