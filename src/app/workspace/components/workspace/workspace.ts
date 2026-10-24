import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Type,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePanelsTopLeft,
  lucideChevronRight,
  lucideSun,
  lucideMoon,
  lucideWifi,
  lucideWifiOff,
  lucideCheckCheck,
  lucideLoaderCircle,
  lucideLockKeyhole,
  lucideCircleAlert,
  lucideDownload,
} from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { AppearanceState } from '../../../appearance/public-api';
import { OfflineState } from '../../../offline-support/public-api';
import {
  SessionState,
  SessionRepository,
  TOOL_DEFINITIONS,
  ToolId,
  WorkspaceLock,
} from '../../../sessions/public-api';
import { ToolSidebar } from '../tool-sidebar/tool-sidebar';
import { SessionTabs } from '../session-tabs/session-tabs';
import { WorkspaceWelcome } from '../workspace-welcome/workspace-welcome';
import { SessionLibrary } from '../session-library/session-library';
import { RecentSessions } from '../recent-sessions/recent-sessions';

@Component({
  selector: 'app-workspace',
  imports: [
    NgComponentOutlet,
    NgIcon,
    Button,
    ToolSidebar,
    SessionTabs,
    WorkspaceWelcome,
    SessionLibrary,
    RecentSessions,
  ],
  providers: [
    provideIcons({
      lucidePanelsTopLeft,
      lucideChevronRight,
      lucideSun,
      lucideMoon,
      lucideWifi,
      lucideWifiOff,
      lucideCheckCheck,
      lucideLoaderCircle,
      lucideLockKeyhole,
      lucideCircleAlert,
      lucideDownload,
    }),
  ],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  readonly sessions = inject(SessionState);
  readonly appearance = inject(AppearanceState);
  readonly offline = inject(OfflineState);
  readonly lock = inject(WorkspaceLock);
  readonly tools = inject(TOOL_DEFINITIONS);
  private readonly repository = inject(SessionRepository);
  readonly collapsed = signal(false);
  readonly libraryOpen = signal(false);
  readonly activeComponent = signal<{ sessionId: string; component: Type<unknown> } | null>(null);
  readonly activeViews = computed(() => {
    const view = this.activeComponent();
    return view?.sessionId === this.sessions.activeId() ? [view] : [];
  });
  readonly loadingError = signal('');
  readonly activeTool = computed(
    () => this.tools.find((tool) => tool.id === this.sessions.activeSession()?.toolId) ?? null,
  );
  readonly toolInputs = computed(() => ({ sessionId: this.sessions.activeId() }));
  readonly activeCharacters = computed(() => {
    const id = this.sessions.activeId();
    return id ? (this.sessions.document(id)?.source.length ?? 0) : 0;
  });
  readonly activeLines = computed(() => {
    const id = this.sessions.activeId();
    const source = id ? (this.sessions.document(id)?.source ?? '') : '';
    return 1 + (source.match(/\r\n|\r|\n/g)?.length ?? 0);
  });
  private loadNumber = 0;

  constructor() {
    void this.initialize();
    effect(() => {
      const id = this.sessions.activeId();
      this.activeComponent.set(null);
      this.loadingError.set('');
      const load = ++this.loadNumber;
      const tool = untracked(() =>
        this.tools.find((item) => item.id === this.sessions.activeSession()?.toolId),
      );
      if (id && tool)
        void tool
          .loadComponent()
          .then((component) => {
            if (load === this.loadNumber) this.activeComponent.set({ sessionId: id, component });
          })
          .catch(() =>
            this.loadingError.set('The tool could not be loaded. Reconnect and reload this page.'),
          );
    });
  }

  async initialize(): Promise<void> {
    if (!(await this.lock.claim())) return;
    await this.sessions.initialize();
    try {
      this.collapsed.set((await this.repository.getPreference('sidebar-collapsed')) === true);
    } catch {
      /* The session status exposes storage errors. */
    }
  }

  async create(toolId: ToolId): Promise<void> {
    await this.sessions.create(toolId);
  }
  toggleSidebar(): void {
    this.collapsed.update((value) => !value);
    void this.repository
      .setPreference('sidebar-collapsed', this.collapsed())
      .catch(() => undefined);
  }
}
