import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCodeXml,
  lucideTableProperties,
  lucideX,
  lucideArrowRightToLine,
  lucidePanelsTopLeft,
  lucidePencil,
} from '@ng-icons/lucide';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { SessionSummary } from '../../../sessions/public-api';

@Component({
  selector: 'app-session-tabs',
  imports: [NgIcon, ContextMenu, CdkDrag, CdkDragHandle, CdkDropList, CdkScrollable],
  providers: [
    provideIcons({
      lucideCodeXml,
      lucideTableProperties,
      lucideX,
      lucideArrowRightToLine,
      lucidePanelsTopLeft,
      lucidePencil,
    }),
  ],
  templateUrl: './session-tabs.html',
  styleUrl: './session-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTabs {
  readonly sessions = input.required<SessionSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly activate = output<string>();
  readonly closeSession = output<string>();
  readonly closeSessions = output<string[]>();
  readonly reorderSessions = output<string[]>();
  readonly renameSession = output<{ id: string; name: string }>();
  readonly renamingId = signal<string | null>(null);
  readonly draftName = signal('');
  readonly dragging = signal(false);
  private readonly menu = viewChild.required<ContextMenu>('tabMenu');
  private readonly menuTarget = signal<SessionSummary | null>(null);
  readonly menuItems = computed<MenuItem[]>(() => {
    const target = this.menuTarget();
    const index = this.sessions().findIndex((item) => item.id === target?.id);
    return [
      {
        label: 'Close',
        icon: 'lucideX',
        command: () => target && this.closeSession.emit(target.id),
      },
      {
        label: 'Close to the Right',
        icon: 'lucideArrowRightToLine',
        disabled: index < 0 || index === this.sessions().length - 1,
        command: () =>
          this.closeSessions.emit(
            this.sessions()
              .slice(index + 1)
              .map((item) => item.id),
          ),
      },
      {
        label: 'Close All',
        icon: 'lucidePanelsTopLeft',
        command: () => this.closeSessions.emit(this.sessions().map((item) => item.id)),
      },
      { separator: true },
      { label: 'Rename', icon: 'lucidePencil', command: () => target && this.rename(target) },
    ];
  });

  openMenu(event: MouseEvent, session: SessionSummary): void {
    event.preventDefault();
    this.menuTarget.set(session);
    this.menu().show(event);
  }

  select(id: string): void {
    if (!this.dragging()) this.activate.emit(id);
  }

  drop(event: CdkDragDrop<SessionSummary[]>): void {
    const sessions = [...this.sessions()];
    moveItemInArray(sessions, event.previousIndex, event.currentIndex);
    this.reorderSessions.emit(sessions.map((item) => item.id));
  }

  rename(session: SessionSummary): void {
    this.draftName.set(session.name);
    this.renamingId.set(session.id);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('#session-name-input');
      input?.focus();
      input?.select();
    });
  }

  finishRename(): void {
    const id = this.renamingId();
    if (id && this.draftName().trim())
      this.renameSession.emit({ id, name: this.draftName().trim() });
    this.renamingId.set(null);
  }

  onKey(event: KeyboardEvent, session: SessionSummary): void {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.openMenu(
        new MouseEvent('contextmenu', { clientX: bounds.left, clientY: bounds.bottom }),
        session,
      );
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      this.rename(session);
      return;
    }
    const index = this.sessions().findIndex((item) => item.id === session.id);
    const last = this.sessions().length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % (last + 1)
        : event.key === 'ArrowLeft'
          ? (index + last) % (last + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    const id = this.sessions()[next]!.id;
    this.activate.emit(id);
    setTimeout(() => document.getElementById(`tab-${id}`)?.focus());
  }
}
