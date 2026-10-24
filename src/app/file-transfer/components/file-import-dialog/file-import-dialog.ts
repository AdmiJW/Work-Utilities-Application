import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileInput, lucideReplace, lucideX } from '@ng-icons/lucide';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { ImportDecision } from '../../models/file-import';

@Component({
  selector: 'app-file-import-dialog',
  imports: [Dialog, Button, NgIcon],
  providers: [provideIcons({ lucideFileInput, lucideReplace, lucideX })],
  template: `
    <p-dialog
      header="Import file"
      closeAriaLabel="Cancel file import"
      [visible]="fileName() !== null"
      (visibleChange)="!$event && decision.emit('cancel')"
      [modal]="true"
      [style]="{ width: '490px' }"
    >
      <p>
        Import <strong>{{ fileName() }}</strong> into this session?
      </p>
      <div class="import-actions">
        <p-button
          size="small"
          severity="secondary"
          [text]="true"
          (onClick)="decision.emit('cancel')"
          ><ng-icon name="lucideX" />Cancel</p-button
        >
        <p-button
          size="small"
          severity="secondary"
          [outlined]="true"
          (onClick)="decision.emit('insert')"
          ><ng-icon name="lucideFileInput" />Insert at cursor</p-button
        >
        <p-button size="small" (onClick)="decision.emit('replace')"
          ><ng-icon name="lucideReplace" />Replace all</p-button
        >
      </div>
    </p-dialog>
    <p-dialog
      header="Cannot open file"
      closeAriaLabel="Close file error"
      [visible]="!!error()"
      (visibleChange)="!$event && dismissError.emit()"
      [modal]="true"
      [style]="{ width: '440px' }"
    >
      <p role="alert">{{ error() }}</p>
      <div class="import-actions">
        <p-button size="small" (onClick)="dismissError.emit()">OK</p-button>
      </div>
    </p-dialog>
  `,
  styles: `
    p {
      font-size: 13px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }
    .import-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileImportDialog {
  readonly fileName = input<string | null>(null);
  readonly error = input('');
  readonly decision = output<ImportDecision>();
  readonly dismissError = output<void>();
}
