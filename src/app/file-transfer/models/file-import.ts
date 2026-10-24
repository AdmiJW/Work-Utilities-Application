export type ImportDecision = 'replace' | 'insert' | 'cancel';

export interface PendingFileImport<T> {
  fileName: string;
  source: string;
  target: T;
}
