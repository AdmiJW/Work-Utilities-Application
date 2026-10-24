import { Injectable, effect, inject } from '@angular/core';
import { SessionState } from '../../sessions/public-api';
import { disposeSqlModel } from '../adapters/create-sql-editor';

@Injectable({ providedIn: 'root' })
export class SqlEditorModels {
  private readonly sessions = inject(SessionState);
  private readonly ids = new Set<string>();
  constructor() {
    effect(() => {
      const openIds = new Set(
        this.sessions
          .summaries()
          .filter((item) => item.isOpen)
          .map((item) => item.id),
      );
      for (const id of this.ids)
        if (!openIds.has(id)) {
          disposeSqlModel(id);
          this.ids.delete(id);
        }
    });
  }
  register(id: string): void {
    this.ids.add(id);
  }
}
