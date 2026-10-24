import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionRepository } from '../adapters/session-repository';
import { SessionDocument, SessionSummary, ToolId } from '../models/tool-session';
import { SessionAutosave } from './session-autosave';
import { readWorkspacePreference } from '../functions/read-workspace-preference';
import { SessionLifecycle } from './session-lifecycle';
import { SessionNavigation } from './session-navigation';
import { nextViewedAt, sortRecentSessions } from '../functions/session-recency';

@Injectable({ providedIn: 'root' })
export class SessionState {
  private readonly repository = inject(SessionRepository);
  readonly autosave = inject(SessionAutosave);
  private readonly lifecycle = inject(SessionLifecycle);
  private readonly navigation = inject(SessionNavigation);
  readonly openingId = this.navigation.openingId;
  readonly openingError = this.navigation.error;
  readonly busy = this.lifecycle.busy;
  private readonly summariesState = signal<SessionSummary[]>([]);
  private readonly documentsState = signal<Record<string, SessionDocument>>({});
  private readonly order = signal<string[]>([]);
  private readonly counters: Record<ToolId, number> = { 'sql-formatter': 0, 'output-analyzer': 0 };
  readonly summaries = this.summariesState.asReadonly();
  readonly recentSessions = computed(() => sortRecentSessions(this.summaries()));
  private readonly activeIdState = signal<string | null>(null);
  private readonly readyState = signal(false);
  private readonly errorState = signal('');
  readonly activeId = this.activeIdState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly openSessions = computed(() =>
    this.order()
      .map((id) => this.summariesState().find((item) => item.id === id))
      .filter((item): item is SessionSummary => !!item?.isOpen),
  );
  readonly activeSession = computed(
    () => this.summariesState().find((item) => item.id === this.activeId()) ?? null,
  );

  async initialize(): Promise<void> {
    if (this.ready()) return;
    try {
      this.summariesState.set(await this.repository.list());
      const workspace = readWorkspacePreference(
        this.summaries(),
        await this.repository.getPreference('workspace'),
      );
      this.order.set(workspace.order);
      Object.assign(this.counters, workspace.counters);
      if (workspace.activeId) await this.activate(workspace.activeId);
    } catch (error) {
      this.fail(error);
    }
    this.readyState.set(true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.autosave.flush();
    });
    window.addEventListener('pagehide', () => {
      void this.autosave.flush();
    });
  }

  document(id: string): SessionDocument | undefined {
    return this.documentsState()[id];
  }

  async create(toolId: ToolId, name?: string, source = ''): Promise<string> {
    if (this.busy()) throw new Error('Wait for the current session operation to finish.');
    this.navigation.cancel();
    const id = crypto.randomUUID();
    const counter = ++this.counters[toolId];
    const title = toolId === 'sql-formatter' ? 'SQL Formatter' : 'Output Analyzer';
    const now = Date.now();
    const summary: SessionSummary = {
      id,
      toolId,
      name: name ?? `${title} ${String(counter).padStart(2, '0')}`,
      createdAt: now,
      updatedAt: now,
      lastViewedAt: nextViewedAt(this.summaries()),
      isOpen: true,
    };
    const document: SessionDocument = { id, schemaVersion: 1, source, revision: 0, options: {} };
    this.summariesState.update((items) => [...items, summary]);
    this.documentsState.update((items) => ({ ...items, [id]: document }));
    this.order.update((ids) => [...ids, id]);
    this.activeIdState.set(id);
    this.autosave.schedule(summary, document);
    this.persistWorkspace();
    await this.autosave.flush(id);
    return id;
  }

  async activate(id: string, options: { recordView?: boolean } = {}): Promise<boolean> {
    if (this.busy()) return false;
    if (this.activeId() === id) {
      this.navigation.cancel();
      return true;
    }
    if (!this.summaries().some((item) => item.id === id)) return false;
    return this.navigation.select(
      id,
      () => {
        const cached = this.document(id);
        return cached ? Promise.resolve(cached) : this.repository.read(id);
      },
      (document) => {
        const summary = this.summariesState().find((item) => item.id === id);
        if (!summary || this.busy()) return false;
        const lastViewedAt =
          options.recordView === false ? undefined : nextViewedAt(this.summaries());
        this.documentsState.update((items) => ({ ...items, [id]: items[id] ?? document }));
        this.summariesState.update((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, isOpen: true, ...(lastViewedAt === undefined ? {} : { lastViewedAt }) }
              : item,
          ),
        );
        if (!summary.isOpen) {
          this.order.update((ids) => [...ids.filter((key) => key !== id), id]);
        }
        this.activeIdState.set(id);
        this.persistWorkspace();
        if (lastViewedAt !== undefined || !summary.isOpen)
          void this.repository
            .recordAccess(id, lastViewedAt)
            .catch((error: unknown) => this.fail(error));
        return true;
      },
    );
  }

  updateSource(id: string, source: string): void {
    if (this.lifecycle.isLocked(id)) return;
    const document = this.document(id);
    if (!document || document.source === source) return;
    this.documentsState.update((items) => ({
      ...items,
      [id]: {
        ...document,
        source,
        revision: (document.revision ?? 0) + 1,
        options: { ...document.options, analyzed: false },
      },
    }));
    this.touch(id);
  }

  updateOptions(id: string, options: Record<string, unknown>): void {
    if (this.lifecycle.isLocked(id)) return;
    const document = this.document(id);
    if (!document) return;
    this.documentsState.update((items) => ({
      ...items,
      [id]: { ...document, options: { ...document.options, ...options } },
    }));
    this.touch(id);
  }

  rename(id: string, name: string): void {
    if (this.lifecycle.isLocked(id)) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    this.summariesState.update((items) =>
      items.map((item) => (item.id === id ? { ...item, name: trimmed } : item)),
    );
    this.touch(id);
  }

  close(id: string): Promise<boolean> {
    return this.closeMany([id]);
  }

  closeMany(ids: string[]): Promise<boolean> {
    return this.removeFromWorkspace(ids, false);
  }

  deleteMany(ids: string[]): Promise<boolean> {
    return this.removeFromWorkspace(ids, true);
  }

  reorder(ids: string[]): void {
    if (this.busy()) return;
    const open = this.openSessions().map((item) => item.id);
    if (
      ids.length !== open.length ||
      new Set(ids).size !== open.length ||
      ids.some((id) => !open.includes(id))
    )
      return;
    this.order.set([...ids]);
    this.persistWorkspace();
  }

  private async removeFromWorkspace(ids: string[], permanently: boolean): Promise<boolean> {
    if (this.busy()) return false;
    const targets = this.summaries().filter(
      (item) => ids.includes(item.id) && (permanently || item.isOpen),
    );
    if (!targets.length) return true;
    this.navigation.cancel();
    const removed = new Set(targets.map((item) => item.id));
    const order = this.order().filter((id) => !removed.has(id));
    const active = this.activeId();
    const index = this.order().indexOf(active ?? '');
    const activeId =
      active && !removed.has(active)
        ? active
        : (this.order()
            .slice(0, index)
            .findLast((id) => !removed.has(id)) ??
          order[0] ??
          null);
    this.errorState.set('');
    try {
      await this.lifecycle.commit(
        targets,
        { order, activeId, counters: this.counters },
        permanently,
      );
      this.summariesState.update((items) =>
        permanently
          ? items.filter((item) => !removed.has(item.id))
          : items.map((item) => (removed.has(item.id) ? { ...item, isOpen: false } : item)),
      );
      this.order.set(order);
      this.documentsState.update((items) =>
        Object.fromEntries(Object.entries(items).filter(([id]) => !removed.has(id))),
      );
      if (activeId !== active) {
        this.activeIdState.set(null);
        if (activeId) await this.activate(activeId, { recordView: false });
      }
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private touch(id: string): void {
    this.summariesState.update((items) =>
      items.map((item) => (item.id === id ? { ...item, updatedAt: Date.now() } : item)),
    );
    this.schedule(id);
  }

  private schedule(id: string): void {
    const summary = this.summariesState().find((item) => item.id === id);
    const document = this.document(id);
    if (summary && document) this.autosave.schedule(summary, document);
  }

  private persistWorkspace(): void {
    void this.repository
      .setPreference('workspace', {
        order: this.order(),
        activeId: this.activeId(),
        counters: this.counters,
      })
      .catch((error: unknown) => this.fail(error));
  }

  private fail(error: unknown): void {
    this.errorState.set(error instanceof Error ? error.message : 'Browser storage is unavailable.');
  }
}
