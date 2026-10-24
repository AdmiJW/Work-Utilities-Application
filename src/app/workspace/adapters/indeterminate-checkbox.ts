import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';

/** PrimeNG 22 renders its mixed icon but does not set the native input's indeterminate property. */
@Directive({ selector: 'p-checkbox[appIndeterminateCheckbox]' })
export class IndeterminateCheckbox {
  readonly appIndeterminateCheckbox = input(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      const mixed = this.appIndeterminateCheckbox();
      const input =
        this.host.nativeElement.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (input) input.indeterminate = mixed;
    });
  }
}
