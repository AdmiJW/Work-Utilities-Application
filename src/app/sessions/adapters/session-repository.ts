import { Injectable } from '@angular/core';
import Dexie, { EntityTable } from 'dexie';
import { SessionDocument, SessionSummary } from '../models/tool-session';
import { WorkspacePreference } from '../models/workspace-preference';
import { preserveLatestView } from '../functions/session-recency';

interface Preference {
  key: string;
  value: unknown;
}

@Injectable({ providedIn: 'root' })
export class SessionRepository {
  private readonly database = new Dexie('workplace-utilities');
  private readonly summaries: EntityTable<SessionSummary, 'id'>;
  private readonly documents: EntityTable<SessionDocument, 'id'>;
  private readonly preferences: EntityTable<Preference, 'key'>;

  constructor() {
    this.database
      .version(1)
      .stores({ summaries: 'id, toolId, updatedAt', documents: 'id', preferences: 'key' });
    this.summaries = this.database.table('summaries');
    this.documents = this.database.table('documents');
    this.preferences = this.database.table('preferences');
  }

  list(): Promise<SessionSummary[]> {
    return this.summaries.toArray();
  }
  async read(id: string): Promise<SessionDocument | undefined> {
    const document = await this.documents.get(id);
    if (!document) return undefined;
    if (document.schemaVersion !== undefined && document.schemaVersion !== 1)
      throw new Error(
        'This session was saved by an unsupported application version. Its stored content has not been changed.',
      );
    return { ...document, schemaVersion: 1, revision: document.revision ?? 0 };
  }

  async save(summary: SessionSummary, document: SessionDocument): Promise<void> {
    await this.database.transaction('rw', this.summaries, this.documents, async () => {
      await this.summaries.put(preserveLatestView(summary, await this.summaries.get(summary.id)));
      await this.documents.put(document);
    });
  }

  async saveSummary(summary: SessionSummary): Promise<void> {
    await this.database.transaction('rw', this.summaries, async () => {
      await this.summaries.put(preserveLatestView(summary, await this.summaries.get(summary.id)));
    });
  }

  async recordAccess(id: string, lastViewedAt?: number): Promise<void> {
    await this.database.transaction('rw', this.summaries, async () => {
      const stored = await this.summaries.get(id);
      if (!stored) return;
      await this.summaries.put(
        preserveLatestView(
          { ...stored, isOpen: true, ...(lastViewedAt === undefined ? {} : { lastViewedAt }) },
          stored,
        ),
      );
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction('rw', this.summaries, this.documents, async () => {
      await this.summaries.delete(id);
      await this.documents.delete(id);
    });
  }

  async closeMany(summaries: SessionSummary[], workspace: WorkspacePreference): Promise<void> {
    await this.database.transaction('rw', this.summaries, this.preferences, async () => {
      await this.summaries.bulkPut(summaries);
      await this.preferences.put({ key: 'workspace', value: workspace });
    });
  }

  async deleteMany(ids: string[], workspace: WorkspacePreference): Promise<void> {
    await this.database.transaction(
      'rw',
      this.summaries,
      this.documents,
      this.preferences,
      async () => {
        await this.summaries.bulkDelete(ids);
        await this.documents.bulkDelete(ids);
        await this.preferences.put({ key: 'workspace', value: workspace });
      },
    );
  }

  async getPreference(key: string): Promise<unknown> {
    return (await this.preferences.get(key))?.value;
  }
  async setPreference(key: string, value: unknown): Promise<void> {
    await this.preferences.put({ key, value });
  }
}
