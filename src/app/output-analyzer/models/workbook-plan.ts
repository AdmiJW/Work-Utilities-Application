export interface WorkbookSheet {
  name: string;
  rows: string[][];
  headerRow: number;
  filterColumns: number;
}

export interface WorkbookIssue {
  sheet: string;
  row: number;
  column: number;
  message: string;
}
