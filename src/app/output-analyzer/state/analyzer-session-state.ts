import { signal } from '@angular/core';
import { AnalysisResult, SelectedCell } from '../models/analysis-result';
import { WorkbookIssue } from '../models/workbook-plan';

export function createAnalyzerRuntime() {
  return {
    result: signal<AnalysisResult | null>(null),
    progress: signal(0),
    analyzing: signal(false),
    exporting: signal(false),
    error: signal(''),
    selectedSheet: signal(''),
    selectedCell: signal<SelectedCell | null>(null),
    inspectorOpen: signal(false),
    analyzedRevision: signal(-1),
    exportIssues: signal<WorkbookIssue[]>([]),
    analysisWorker: null as Worker | null,
    exportWorker: null as Worker | null,
  };
}

export type AnalyzerRuntime = ReturnType<typeof createAnalyzerRuntime>;
