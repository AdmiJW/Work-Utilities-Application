import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Workspace } from './workspace/public-api';

@Component({
  imports: [Workspace],
  selector: 'app-root',
  template: '<app-workspace />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
