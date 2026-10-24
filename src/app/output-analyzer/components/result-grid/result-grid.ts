import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellClickedEvent,
  CellFocusedEvent,
  CellDoubleClickedEvent,
  CellKeyDownEvent,
  FullWidthCellKeyDownEvent,
  ColDef,
  ColumnState,
  FilterModel,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';
import { OutputStatement, ResultRow, SelectedCell } from '../../models/analysis-result';

ModuleRegistry.registerModules([AllCommunityModule]);

interface SavedView {
  signature: string;
  filters: FilterModel;
  columns: ColumnState[];
}

@Component({
  selector: 'app-result-grid',
  imports: [AgGridAngular],
  template: `<ag-grid-angular
    style="width:100%;height:100%"
    [rowData]="statement().rows"
    [columnDefs]="columns()"
    [defaultColDef]="defaults"
    [theme]="theme()"
    [getRowId]="getRowId"
    [animateRows]="false"
    (gridReady)="ready($event)"
    (cellClicked)="clicked($event)"
    (cellFocused)="focused($event)"
    (cellDoubleClicked)="inspect($event)"
    (cellKeyDown)="keyDown($event)"
    (filterChanged)="saveView()"
    (sortChanged)="saveView()"
    (columnResized)="$event.finished && saveView()"
    (columnMoved)="$event.finished && saveView()"
  />`,
  styles: ':host { display: block; height: 100%; min-height: 180px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultGrid {
  readonly statement = input.required<OutputStatement>();
  readonly dark = input(false);
  readonly savedView = input('');
  readonly cellSelected = output<SelectedCell>();
  readonly inspectCell = output<void>();
  readonly viewChanged = output<{ sheetIndex: number; value: string }>();
  private api: GridApi<ResultRow> | undefined;
  private restoring = true;
  readonly defaults: ColDef<ResultRow> = {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    cellDataType: false,
    minWidth: 130,
    cellStyle: { whiteSpace: 'pre' },
  };
  readonly getRowId = (params: { data: ResultRow }) => String(params.data.lineNumber);
  readonly columns = computed<ColDef<ResultRow>[]>(() => [
    {
      headerName: '#',
      colId: '__row',
      width: 60,
      minWidth: 60,
      maxWidth: 80,
      pinned: 'left',
      filter: false,
      sortable: false,
      valueGetter: (params) => String((params.node?.rowIndex ?? 0) + 1),
      cellClass: 'muted',
    },
    ...this.statement().columns.map((column, index): ColDef<ResultRow> => ({
      headerName: column.name,
      headerTooltip: column.expression,
      colId: String(index),
      width: Math.min(320, Math.max(160, column.name.length * 9 + 40)),
      valueGetter: (params) => params.data?.values[index] ?? '',
      cellClass: 'mono',
    })),
  ]);
  readonly theme = computed(() =>
    themeQuartz.withParams({
      backgroundColor: this.dark() ? '#101b2e' : '#ffffff',
      foregroundColor: this.dark() ? '#e3ebf7' : '#24344b',
      headerBackgroundColor: this.dark() ? '#152238' : '#f8fafc',
      headerTextColor: this.dark() ? '#9aaec7' : '#62748e',
      borderColor: this.dark() ? '#26354b' : '#e2e8f0',
      accentColor: '#3b82f6',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 12,
      rowHeight: 32,
      headerHeight: 36,
      spacing: 6,
    }),
  );

  ready(event: GridReadyEvent<ResultRow>): void {
    this.api = event.api;
    try {
      const saved: unknown = JSON.parse(this.savedView() || 'null');
      if (
        saved &&
        typeof saved === 'object' &&
        'signature' in saved &&
        saved.signature === this.signature() &&
        'filters' in saved &&
        'columns' in saved &&
        Array.isArray(saved.columns)
      ) {
        const view = saved as SavedView;
        this.api.applyColumnState({ state: view.columns, applyOrder: true });
        this.api.setFilterModel(view.filters);
      }
    } catch {
      /* A stale view preference falls back to the default grid. */
    }
    this.restoring = false;
  }

  clicked(event: CellClickedEvent<ResultRow>): void {
    if (event.data) this.select(event.data, event.column.getColId());
  }
  inspect(event: CellDoubleClickedEvent<ResultRow>): void {
    if (event.data && this.select(event.data, event.column.getColId())) this.inspectCell.emit();
  }
  keyDown(event: CellKeyDownEvent<ResultRow> | FullWidthCellKeyDownEvent<ResultRow>): void {
    if (
      event.event instanceof KeyboardEvent &&
      event.event.key === 'Enter' &&
      event.data &&
      'column' in event &&
      event.column &&
      this.select(event.data, event.column.getColId())
    )
      this.inspectCell.emit();
  }
  focused(event: CellFocusedEvent<ResultRow>): void {
    if (event.rowIndex === null || !event.column || typeof event.column === 'string') return;
    const row = event.api.getDisplayedRowAtIndex(event.rowIndex)?.data;
    if (row) this.select(row, event.column.getColId());
  }
  private select(row: ResultRow, columnId: string): boolean {
    const index = Number(columnId);
    if (!Number.isInteger(index) || index < 0 || index >= this.statement().columns.length)
      return false;
    this.cellSelected.emit({
      columnName: this.statement().columns[index]!.name,
      rowNumber: row.lineNumber,
      value: row.values[index] ?? '',
    });
    return true;
  }
  private signature(): string {
    return JSON.stringify(this.statement().columns.map((column) => column.name));
  }
  saveView(): void {
    if (!this.api || this.restoring) return;
    this.viewChanged.emit({
      sheetIndex: this.statement().index,
      value: JSON.stringify({
        signature: this.signature(),
        filters: this.api.getFilterModel(),
        columns: this.api.getColumnState(),
      }),
    });
  }
}
