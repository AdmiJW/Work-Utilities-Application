import { AnalysisResult } from '../models/analysis-result';
import { WorkbookIssue, WorkbookSheet } from '../models/workbook-plan';

export function prepareWorkbookSheets(result: AnalysisResult): WorkbookSheet[] {
  const sheets = result.statements
    .filter((statement) => statement.kind === 'SELECT')
    .map((statement): WorkbookSheet => ({
      name: [...`${String(statement.index).padStart(2, '0')} ${statement.tableName}`]
        .map((character) => ('\\/*?:[]'.includes(character) ? '_' : character))
        .join('')
        .slice(0, 31)
        .replace(/'+$/, ''),
      headerRow: 7,
      filterColumns: statement.columns.length,
      rows: [
        ['SQL Statement', statement.sql],
        ['Run marker', statement.marker],
        ['Observed rows', String(statement.observedRows)],
        ['Parsed rows', String(statement.rows.length)],
        [
          'Reported rows',
          statement.reportedRows === null ? 'Not reported' : String(statement.reportedRows),
        ],
        [],
        statement.columns.length
          ? statement.columns.map((column) => column.name)
          : ['Unsupported projection — raw output is in Diagnostics'],
        ...statement.rows.map((row) => row.values),
      ],
    }));
  const summaries = result.statements.filter((statement) => statement.kind !== 'SELECT');
  if (summaries.length)
    sheets.push({
      name: '_Statements',
      headerRow: 1,
      filterColumns: 6,
      rows: [
        ['Statement', 'Run marker', 'Kind', 'SQL', 'Reported rows', 'Messages'],
        ...summaries.map((statement) => [
          String(statement.index),
          statement.marker,
          statement.kind,
          statement.sql,
          statement.reportedRows === null ? 'Not reported' : String(statement.reportedRows),
          statement.messages.join('\n'),
        ]),
      ],
    });
  if (result.diagnostics.length)
    sheets.push({
      name: '_Diagnostics',
      headerRow: 1,
      filterColumns: 4,
      rows: [
        ['Statement', 'Source line', 'Reason', 'Raw text'],
        ...result.diagnostics.map((diagnostic) => [
          diagnostic.statementIndex === null ? '' : String(diagnostic.statementIndex),
          String(diagnostic.lineNumber),
          diagnostic.message,
          diagnostic.raw,
        ]),
      ],
    });
  return sheets;
}

export function validateWorkbookSheets(sheets: WorkbookSheet[]): WorkbookIssue[] {
  const issues: WorkbookIssue[] = [];
  if (!sheets.length)
    issues.push({
      sheet: 'Workbook',
      row: 0,
      column: 0,
      message: 'There are no recognized statements to export.',
    });
  for (const sheet of sheets) {
    if (sheet.rows.length > 1_048_576)
      issues.push({
        sheet: sheet.name,
        row: 1_048_577,
        column: 1,
        message: 'This worksheet exceeds Excel’s row limit, including metadata and headers.',
      });
    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
      const row = sheet.rows[rowIndex]!;
      if (row.length > 16_384)
        issues.push({
          sheet: sheet.name,
          row: rowIndex + 1,
          column: 16_385,
          message: 'This row exceeds Excel’s column limit.',
        });
      for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
        const value = row[columnIndex]!;
        if (value.length > 32_767)
          issues.push({
            sheet: sheet.name,
            row: rowIndex + 1,
            column: columnIndex + 1,
            message: `${value.length.toLocaleString()} characters exceeds Excel’s 32,767-character cell limit. The full value remains in the app.`,
          });
        else if ((value.match(/\n/g)?.length ?? 0) > 253)
          issues.push({
            sheet: sheet.name,
            row: rowIndex + 1,
            column: columnIndex + 1,
            message: 'This cell exceeds Excel’s 253-line-feed limit.',
          });
      }
    }
  }
  return issues;
}
