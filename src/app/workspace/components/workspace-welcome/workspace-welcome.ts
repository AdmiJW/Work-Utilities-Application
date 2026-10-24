import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUpRight,
  lucideCodeXml,
  lucideTableProperties,
  lucideHardDrive,
  lucideWifiOff,
  lucideLayers,
} from '@ng-icons/lucide';
import { ToolDefinition, ToolId } from '../../../sessions/public-api';

@Component({
  selector: 'app-workspace-welcome',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideArrowUpRight,
      lucideCodeXml,
      lucideTableProperties,
      lucideHardDrive,
      lucideWifiOff,
      lucideLayers,
    }),
  ],
  templateUrl: './workspace-welcome.html',
  styleUrl: './workspace-welcome.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceWelcome {
  readonly tools = input.required<readonly ToolDefinition[]>();
  readonly createSession = output<ToolId>();
}
