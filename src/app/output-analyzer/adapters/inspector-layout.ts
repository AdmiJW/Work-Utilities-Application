import { signal } from '@angular/core';

/** Owns pointer/keyboard resizing without coupling it to parsing or inspector content. */
export class InspectorLayout {
  readonly width = signal(360);
  private drag: AbortController | null = null;
  constructor(private readonly commit: (width: number) => void) {}

  restore(width: unknown): void {
    if (typeof width === 'number') this.width.set(this.clamp(width));
  }
  beginResize(event: PointerEvent): void {
    event.preventDefault();
    this.dispose();
    const start = event.clientX;
    const initial = this.width();
    const drag = new AbortController();
    this.drag = drag;
    window.addEventListener(
      'pointermove',
      (move) => this.width.set(this.clamp(initial + start - move.clientX)),
      { signal: drag.signal },
    );
    window.addEventListener(
      'pointerup',
      () => {
        this.commit(this.width());
        this.dispose();
      },
      { once: true, signal: drag.signal },
    );
    window.addEventListener('pointercancel', () => this.dispose(), {
      once: true,
      signal: drag.signal,
    });
  }
  resizeWithKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.width.set(
      event.key === 'Home'
        ? 280
        : event.key === 'End'
          ? 650
          : this.clamp(this.width() + (event.key === 'ArrowLeft' ? 20 : -20)),
    );
    this.commit(this.width());
  }
  dispose(): void {
    this.drag?.abort();
    this.drag = null;
  }
  private clamp(width: number): number {
    return Math.max(280, Math.min(650, width));
  }
}
