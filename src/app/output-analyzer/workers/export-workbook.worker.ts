import { writeExcelWorkbook } from '../adapters/write-excel-workbook';
import {
  prepareWorkbookSheets,
  validateWorkbookSheets,
} from '../functions/prepare-workbook-sheets';
import { AnalysisResult } from '../models/analysis-result';

self.onmessage = async (event: MessageEvent<{ result: AnalysisResult }>) => {
  try {
    const sheets = prepareWorkbookSheets(event.data.result);
    const issues = validateWorkbookSheets(sheets);
    if (issues.length) {
      self.postMessage({ type: 'invalid', issues });
      return;
    }
    const buffer = await writeExcelWorkbook(sheets);
    self.postMessage({ type: 'complete', buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Workbook generation failed.',
    });
  }
};
