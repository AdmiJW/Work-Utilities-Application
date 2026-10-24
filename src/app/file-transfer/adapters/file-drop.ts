import { Directive, ElementRef, inject, output, signal } from '@angular/core';

@Directive({
  selector: '[appFileDrop]',
  host: {
    '[class.file-drag-over]': 'over()',
    '(dragenter)': 'enter($event)',
    '(dragleave)': 'leave($event)',
    '(dragover)': 'preventFileNavigation($event)',
    '(drop)': 'drop($event)',
    '(document:dragover)': 'preventFileNavigation($event)',
    '(document:drop)': 'preventFileNavigation($event)',
    '(document:dragend)': 'reset()',
  },
})
export class FileDrop {
  readonly filesDropped = output<File[]>();
  readonly over = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  preventFileNavigation(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  }
  enter(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      this.over.set(true);
    }
  }
  leave(event: DragEvent): void {
    if (
      !(event.relatedTarget instanceof Node) ||
      !this.host.nativeElement.contains(event.relatedTarget)
    )
      this.reset();
  }
  drop(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    this.reset();
    this.filesDropped.emit(Array.from(event.dataTransfer.files));
  }
  reset(): void {
    this.over.set(false);
  }
}
