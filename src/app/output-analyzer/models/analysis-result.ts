export interface ResultColumn {
  name: string;
  expression: string;
}

export interface ResultRow {
  lineNumber: number;
  values: string[];
}

export interface OutputStatement {
  index: number;
  marker: string;
  sql: string;
  kind: string;
  tableName: string;
  columns: ResultColumn[];
  rows: ResultRow[];
  observedRows: number;
  reportedRows: number | null;
  messages: string[];
}

export interface AnalysisDiagnostic {
  statementIndex: number | null;
  lineNumber: number;
  message: string;
  raw: string;
}

export interface AnalysisResult {
  statements: OutputStatement[];
  diagnostics: AnalysisDiagnostic[];
  parsedRows: number;
}

export interface SelectedCell {
  columnName: string;
  rowNumber: number;
  value: string;
}
