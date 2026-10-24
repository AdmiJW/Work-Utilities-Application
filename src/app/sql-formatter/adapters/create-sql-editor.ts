import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import { conf, language } from 'monaco-editor/languages/definitions/sql/sql.js';

let initialized = false;

function initializeEditor(): void {
  if (initialized) return;
  globalThis.MonacoEnvironment = {
    getWorker: () =>
      new Worker(new URL('../workers/sql-editor.worker', import.meta.url), { type: 'module' }),
  };
  monaco.languages.register({ id: 'sql' });
  monaco.languages.setLanguageConfiguration('sql', conf);
  monaco.languages.setMonarchTokensProvider('sql', language);
  monaco.editor.defineTheme('workplace-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editorLineNumber.foreground': '#9aabc0',
      'editor.selectionBackground': '#dbeafe',
      'editor.lineHighlightBackground': '#f8fafc',
    },
  });
  monaco.editor.defineTheme('workplace-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#101b2e',
      'editor.foreground': '#e3ebf7',
      'editorLineNumber.foreground': '#62748e',
      'editor.selectionBackground': '#244575',
      'editor.lineHighlightBackground': '#152238',
    },
  });
  initialized = true;
}

export function createSqlEditor(
  host: HTMLElement,
  sessionId: string,
  source: string,
  dark: boolean,
  wordWrap = false,
): monaco.editor.IStandaloneCodeEditor {
  initializeEditor();
  const uri = monaco.Uri.parse(`inmemory://workplace/${sessionId}.sql`);
  const existing = monaco.editor.getModel(uri);
  const model = existing ?? monaco.editor.createModel(source, 'sql', uri);
  if (!existing)
    model.setEOL(
      source.includes('\r\n')
        ? monaco.editor.EndOfLineSequence.CRLF
        : monaco.editor.EndOfLineSequence.LF,
    );
  if (model.getValue() !== source) model.setValue(source);
  return monaco.editor.create(host, {
    model,
    theme: dark ? 'workplace-dark' : 'workplace-light',
    automaticLayout: true,
    fontSize: 13,
    lineHeight: 23,
    fontFamily: "'Cascadia Code', Consolas, monospace",
    minimap: { enabled: false },
    padding: { top: 18, bottom: 18 },
    scrollBeyondLastLine: false,
    wordWrap: wordWrap ? 'on' : 'off',
    ariaLabel: 'SQL editor',
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
    renderLineHighlight: 'all',
    smoothScrolling: false,
  });
}

export function setSqlEditorTheme(dark: boolean): void {
  monaco.editor.setTheme(dark ? 'workplace-dark' : 'workplace-light');
}
export function disposeSqlModel(sessionId: string): void {
  monaco.editor.getModel(monaco.Uri.parse(`inmemory://workplace/${sessionId}.sql`))?.dispose();
}
