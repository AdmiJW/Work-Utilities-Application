import { Injectable, signal } from '@angular/core';
import { SessionDocument } from '../models/tool-session';

/** Only the latest navigation may reveal a document or record a view. */
@Injectable({ providedIn: 'root' })
export class SessionNavigation {
  private request = 0;
  private readonly openingState = signal<string | null>(null);
  private readonly errorState = signal('');
  readonly openingId = this.openingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  cancel(): void {
    this.request++;
    this.openingState.set(null);
    this.errorState.set('');
  }

  async select(
    id: string,
    read: () => Promise<SessionDocument | undefined>,
    reveal: (document: SessionDocument) => boolean,
  ): Promise<boolean> {
    if (this.openingId() === id) return false;
    const request = ++this.request;
    this.openingState.set(id);
    this.errorState.set('');
    try {
      const document = await read();
      if (request !== this.request) return false;
      if (!document) throw new Error('The saved document could not be found.');
      return reveal(document);
    } catch (error) {
      if (request === this.request)
        this.errorState.set(
          error instanceof Error ? error.message : 'This session could not be opened. Try again.',
        );
      return false;
    } finally {
      if (request === this.request) this.openingState.set(null);
    }
  }
}
