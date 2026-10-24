import { Injectable, inject, signal } from '@angular/core';
import { SessionRepository } from '../adapters/session-repository';
import { SessionDocument, SessionSummary } from '../models/tool-session';

interface PendingSave {
  summary: SessionSummary;
  document: SessionDocument;
  revision: number;
}

@Injectable({ providedIn: 'root' })
export class SessionAutosave {
  private readonly repository = inject(SessionRepository);
  private readonly pending = new Map<string, PendingSave>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly suspended = new Set<string>();
  private revision = 0;
  readonly status = signal<'saved' | 'saving' | 'error'>('saved');
  readonly error = signal('');

  schedule(summary: SessionSummary, document: SessionDocument): void {
    this.pending.set(summary.id, {
      summary: { ...summary },
      document: { ...document, options: structuredClone(document.options) },
      revision: ++this.revision,
    });
    clearTimeout(this.timers.get(summary.id));
    this.status.set('saving');
    if (this.suspended.has(summary.id)) return;
    this.timers.set(
      summary.id,
      setTimeout(() => {
        void this.flush(summary.id);
      }, 10_000),
    );
  }

  async flush(id?: string): Promise<boolean> {
    const ids = id ? [id] : [...new Set([...this.pending.keys(), ...this.queues.keys()])];
    const outcomes = await Promise.all(
      ids.map(async (key) => {
        if (this.suspended.has(key)) return false;
        do {
          if (this.suspended.has(key)) return false;
          if (!(await this.save(key))) return false;
        } while (this.pending.has(key));
        return true;
      }),
    );
    if (outcomes.every(Boolean) && this.pending.size === 0) {
      this.status.set('saved');
      this.error.set('');
    }
    return outcomes.every(Boolean);
  }

  private async save(id: string): Promise<boolean> {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    let succeeded = true;
    const task = (this.queues.get(id) ?? Promise.resolve()).then(async () => {
      const pending = this.pending.get(id);
      if (!pending) return;
      try {
        await this.repository.save(pending.summary, pending.document);
        if (this.pending.get(id)?.revision === pending.revision) this.pending.delete(id);
      } catch (error) {
        succeeded = false;
        this.status.set('error');
        this.error.set(
          error instanceof Error ? error.message : 'Browser storage could not save this session.',
        );
      }
    });
    this.queues.set(id, task);
    await task;
    if (this.queues.get(id) === task) this.queues.delete(id);
    return succeeded;
  }

  async discard(id: string): Promise<void> {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.pending.delete(id);
    await this.queues.get(id);
    this.refreshStatus();
  }

  async suspend(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.suspended.add(id);
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
    await Promise.all(
      ids.flatMap((id) => {
        const queue = this.queues.get(id);
        return queue ? [queue] : [];
      }),
    );
  }

  resume(ids: string[], discard = false): void {
    for (const id of ids) {
      this.suspended.delete(id);
      if (discard) this.pending.delete(id);
      else {
        const pending = this.pending.get(id);
        if (pending) this.schedule(pending.summary, pending.document);
      }
    }
    this.refreshStatus();
  }

  private refreshStatus(): void {
    if (!this.pending.size && !this.queues.size) {
      this.status.set('saved');
      this.error.set('');
    }
  }
}
