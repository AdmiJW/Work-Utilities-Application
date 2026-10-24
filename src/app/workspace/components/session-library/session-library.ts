import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideTrash2,
  lucideCodeXml,
  lucideTableProperties,
  lucideFolderOpen,
  lucideArrowUpRight,
  lucideCalendarDays,
  lucideArrowDownAZ,
} from '@ng-icons/lucide';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Tag } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { OfflineState } from '../../../offline-support/public-api';
import { SessionState, SessionRepository } from '../../../sessions/public-api';
import { IndeterminateCheckbox } from '../../adapters/indeterminate-checkbox';

@Component({
  selector: 'app-session-library',
  imports: [Dialog, Button, Checkbox, Tag, NgIcon, FormsModule, IndeterminateCheckbox],
  providers: [
    provideIcons({
      lucideSearch,
      lucideTrash2,
      lucideCodeXml,
      lucideTableProperties,
      lucideFolderOpen,
      lucideArrowUpRight,
      lucideCalendarDays,
      lucideArrowDownAZ,
    }),
  ],
  templateUrl: './session-library.html',
  styleUrl: './session-library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionLibrary {
  readonly visible = model(false);
  readonly sessions = inject(SessionState);
  readonly offline = inject(OfflineState);
  private readonly repository = inject(SessionRepository);
  readonly search = signal('');
  readonly sort = signal<'date' | 'name'>('date');
  readonly selected = signal<Set<string>>(new Set());
  readonly deleteTargets = signal<string[]>([]);
  readonly deleting = signal(false);
  readonly filtered = computed(() =>
    this.sessions
      .summaries()
      .filter((item) => item.name.toLowerCase().includes(this.search().trim().toLowerCase()))
      .toSorted((a, b) =>
        this.sort() === 'date'
          ? b.updatedAt - a.updatedAt
          : a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
      ),
  );
  readonly allSelected = computed(
    () =>
      this.filtered().length > 0 && this.filtered().every((item) => this.selected().has(item.id)),
  );
  readonly partiallySelected = computed(() => this.selected().size > 0 && !this.allSelected());
  readonly selectedIds = computed(() => [...this.selected()]);
  readonly deletingOpenCount = computed(
    () =>
      this.sessions
        .summaries()
        .filter((item) => item.isOpen && this.deleteTargets().includes(item.id)).length,
  );

  constructor() {
    effect(() => {
      this.search();
      if (!this.visible()) untracked(() => this.deleteTargets.set([]));
      untracked(() => this.selected.set(new Set()));
    });
    void this.repository
      .getPreference('library-sort')
      .then((value) => {
        if (value === 'date' || value === 'name') this.sort.set(value);
      })
      .catch(() => undefined);
  }

  setSort(value: 'date' | 'name'): void {
    this.sort.set(value);
    void this.repository.setPreference('library-sort', value).catch(() => undefined);
  }
  toggle(id: string): void {
    this.selected.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.filtered().map((item) => item.id)),
    );
  }
  async reopen(id: string): Promise<void> {
    if (await this.sessions.activate(id)) this.visible.set(false);
  }
  async deleteSelected(): Promise<void> {
    this.deleting.set(true);
    try {
      if (await this.sessions.deleteMany(this.deleteTargets())) {
        this.selected.set(new Set());
        this.deleteTargets.set([]);
      }
    } finally {
      this.deleting.set(false);
    }
  }
  updatedAt(value: number): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
