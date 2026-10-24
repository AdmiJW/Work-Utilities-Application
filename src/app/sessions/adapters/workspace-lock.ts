import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceLock {
  readonly state = signal<'checking' | 'owned' | 'other'>('checking');
  private release: (() => void) | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release?.());
  }

  claim(): Promise<boolean> {
    if (this.state() === 'owned') return Promise.resolve(true);
    this.state.set('checking');
    if (!navigator.locks) {
      this.state.set('owned');
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      void navigator.locks
        .request('workplace-utilities-editor', { ifAvailable: true }, async (lock) => {
          if (!lock) {
            this.state.set('other');
            resolve(false);
            return;
          }
          this.state.set('owned');
          resolve(true);
          await new Promise<void>((release) => {
            this.release = release;
          });
        })
        .catch(() => {
          this.state.set('other');
          resolve(false);
        });
    });
  }
}
