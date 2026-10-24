import { signal } from '@angular/core';
import { readTextFile } from '../adapters/read-text-file';
import { PendingFileImport } from '../models/file-import';

/** Shared file validation/read/confirmation state; editor-specific edits stay in each tool. */
export class FileImportState<T> {
  readonly pending = signal<PendingFileImport<T> | null>(null);
  readonly error = signal('');
  readonly reading = signal(false);

  async read(
    files: readonly File[],
    extension: '.sql' | '.txt',
    target: T,
  ): Promise<PendingFileImport<T> | null> {
    if (!files.length) return null;
    if (this.reading() || this.pending()) {
      this.error.set('Finish the current file import before opening another file.');
      return null;
    }
    this.error.set('');
    if (files.length !== 1) {
      this.error.set('Only one file is allowed at a time.');
      return null;
    }
    const file = files[0]!;
    if (!file.name.toLowerCase().endsWith(extension)) {
      this.error.set(`Choose a ${extension} file.`);
      return null;
    }
    this.reading.set(true);
    try {
      return { fileName: file.name, source: await readTextFile(file), target };
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The file could not be opened.');
      return null;
    } finally {
      this.reading.set(false);
    }
  }
}
