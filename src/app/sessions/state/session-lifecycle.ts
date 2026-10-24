import { Injectable, inject, signal } from '@angular/core';
import { SessionRepository } from '../adapters/session-repository';
import { SessionSummary } from '../models/tool-session';
import { WorkspacePreference } from '../models/workspace-preference';
import { SessionAutosave } from './session-autosave';

/** Serializes destructive lifecycle changes against pending document writes. */
@Injectable({ providedIn: 'root' })
export class SessionLifecycle {
  private readonly repository = inject(SessionRepository);
  private readonly autosave = inject(SessionAutosave);
  private readonly busyState = signal(false);
  private readonly lockedIds = new Set<string>();
  readonly busy = this.busyState.asReadonly();

  isLocked(id: string): boolean {
    return this.lockedIds.has(id);
  }

  async commit(
    summaries: SessionSummary[],
    workspace: WorkspacePreference,
    permanently: boolean,
  ): Promise<void> {
    if (this.busy()) throw new Error('Another session operation is still running.');
    const ids = summaries.map((item) => item.id);
    ids.forEach((id) => this.lockedIds.add(id));
    this.busyState.set(true);
    let committed = false;
    let suspended = false;
    try {
      if (!permanently) {
        const saved = await Promise.all(ids.map((id) => this.autosave.flush(id)));
        if (saved.some((success) => !success))
          throw new Error(
            'Save failed. The selected tabs are still open so you can recover their content.',
          );
      }
      await this.autosave.suspend(ids);
      suspended = true;
      if (permanently) await this.repository.deleteMany(ids, workspace);
      else
        await this.repository.closeMany(
          summaries.map((item) => ({ ...item, isOpen: false })),
          workspace,
        );
      committed = true;
    } finally {
      if (suspended) this.autosave.resume(ids, committed);
      ids.forEach((id) => this.lockedIds.delete(id));
      this.busyState.set(false);
    }
  }
}
