import { Page } from '@playwright/test';

export interface SavedSessionFixture {
  id: string;
  name: string;
  toolId: 'sql-formatter' | 'output-analyzer';
  source: string;
  createdAt: number;
  updatedAt?: number;
  lastViewedAt?: number;
  options?: Record<string, unknown>;
  missingDocument?: boolean;
}

/** Seed persisted sessions only; normal UI actions still exercise opening and restoration. */
export async function seedSavedSessions(
  page: Page,
  sessions: SavedSessionFixture[],
): Promise<void> {
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('workplace-utilities');
        opening.onerror = () =>
          reject(opening.error ?? new Error('Could not open fixture storage.'));
        opening.onsuccess = () => {
          const database = opening.result;
          const transaction = database.transaction(
            ['summaries', 'documents', 'preferences'],
            'readwrite',
          );
          for (const record of records) {
            const { source, options, missingDocument, ...summary } = record;
            transaction.objectStore('summaries').put({ ...summary, isOpen: false });
            if (!missingDocument)
              transaction.objectStore('documents').put({
                id: record.id,
                schemaVersion: 1,
                revision: 0,
                source,
                options: options ?? {},
              });
          }
          transaction.objectStore('preferences').put({
            key: 'workspace',
            value: {
              order: [],
              activeId: null,
              counters: { 'sql-formatter': 20, 'output-analyzer': 20 },
            },
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error ?? new Error('Could not persist fixture sessions.'));
          };
        };
      }),
    sessions,
  );
}
