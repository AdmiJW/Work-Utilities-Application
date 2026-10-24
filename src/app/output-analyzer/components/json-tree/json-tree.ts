import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideChevronDown, lucideBraces } from '@ng-icons/lucide';
import { decodeNestedJson } from '../../functions/inspect-json';
import { JsonTreeNode } from '../../models/json-inspection';

@Component({
  selector: 'app-json-tree',
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronRight, lucideChevronDown, lucideBraces })],
  templateUrl: './json-tree.html',
  styleUrl: './json-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JsonTree {
  readonly node = input.required<JsonTreeNode>();
  readonly source = input.required<string>();
  readonly depth = input(0);
  readonly inspectNested = output<string>();
  readonly expanded = linkedSignal(() => {
    this.node();
    return this.depth() === 0;
  });
  readonly isContainer = computed(
    () => this.node().kind === 'object' || this.node().kind === 'array',
  );
  readonly isExpanded = this.expanded.asReadonly();
  readonly raw = computed(() =>
    this.source().slice(this.node().offset, this.node().offset + this.node().length),
  );
  readonly preview = computed(() =>
    this.raw().length > 180 ? this.raw().slice(0, 180) + '…' : this.raw(),
  );
  readonly nested = computed(() => decodeNestedJson(this.source(), this.node()));
  toggle(): void {
    this.expanded.update((value) => !value);
  }
}
