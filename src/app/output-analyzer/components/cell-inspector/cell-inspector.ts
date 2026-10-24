import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideCopy,
  lucideBraces,
  lucideArrowLeft,
  lucideMaximize2,
} from '@ng-icons/lucide';
import { copyText } from '../../../file-transfer/public-api';
import { SelectedCell } from '../../models/analysis-result';
import { JsonInspection, JsonDecodeMode, JsonInspectionView } from '../../models/json-inspection';
import { JsonTree } from '../json-tree/json-tree';

@Component({
  selector: 'app-cell-inspector',
  host: { tabindex: '0', role: 'region', 'aria-label': 'Cell inspector' },
  imports: [NgIcon, JsonTree],
  providers: [
    provideIcons({ lucideX, lucideCopy, lucideBraces, lucideArrowLeft, lucideMaximize2 }),
  ],
  templateUrl: './cell-inspector.html',
  styleUrl: './cell-inspector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellInspector {
  readonly cell = input.required<SelectedCell>();
  readonly closed = output<void>();
  readonly decodeMode = input<JsonDecodeMode>('shallow');
  readonly decodeModeChange = output<JsonDecodeMode>();
  readonly inspection = signal<JsonInspection | null>(null);
  readonly inspecting = signal(false);
  readonly mode = signal<'tree' | 'pretty'>('tree');
  readonly rawExpanded = signal(true);
  readonly lens = signal<string[]>([]);
  readonly copyStatus = signal('');
  readonly viewSource = signal('');
  readonly notice = signal('');
  readonly jsonSource = computed(() => this.lens().at(-1) ?? this.cell().value);
  private worker: Worker | null = null;

  constructor() {
    effect(() => {
      this.cell();
      this.decodeMode();
      this.lens.set([]);
      this.copyStatus.set('');
    });
    effect(() => {
      const source = this.jsonSource();
      const mode = this.decodeMode();
      this.worker?.terminate();
      this.inspection.set(null);
      this.inspecting.set(true);
      this.notice.set('');
      const worker = new Worker(new URL('../../workers/inspect-json.worker', import.meta.url), {
        type: 'module',
      });
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<JsonInspectionView>) => {
        if (this.worker === worker) {
          this.inspection.set(event.data.inspection);
          this.viewSource.set(event.data.source);
          this.notice.set(event.data.notice);
          this.inspecting.set(false);
          worker.terminate();
          this.worker = null;
        }
      };
      worker.onerror = () => {
        if (this.worker !== worker) return;
        this.inspecting.set(false);
        worker.terminate();
        this.worker = null;
      };
      worker.postMessage({ source, mode });
    });
    inject(DestroyRef).onDestroy(() => this.worker?.terminate());
  }

  async copy(value: string): Promise<void> {
    try {
      await copyText(value);
      this.copyStatus.set('Copied');
    } catch (error) {
      this.copyStatus.set(error instanceof Error ? error.message : 'Copy unavailable');
    }
  }

  inspectNested(value: string): void {
    this.lens.update((items) => [...items, value]);
  }
  back(): void {
    this.lens.update((items) => items.slice(0, -1));
  }
}
