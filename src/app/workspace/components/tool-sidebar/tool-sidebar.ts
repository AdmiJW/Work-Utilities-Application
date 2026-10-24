import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCommand,
  lucideCodeXml,
  lucideTableProperties,
  lucidePlus,
  lucideFolderOpen,
  lucideWrench,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
} from '@ng-icons/lucide';
import { ToolDefinition, ToolId } from '../../../sessions/public-api';

@Component({
  selector: 'app-tool-sidebar',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCommand,
      lucideCodeXml,
      lucideTableProperties,
      lucidePlus,
      lucideFolderOpen,
      lucideWrench,
      lucidePanelLeftClose,
      lucidePanelLeftOpen,
    }),
  ],
  templateUrl: './tool-sidebar.html',
  styleUrl: './tool-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolSidebar {
  readonly tools = input.required<readonly ToolDefinition[]>();
  readonly activeTool = input<ToolId | null>(null);
  readonly collapsed = input(false);
  readonly savedCount = input(0);
  readonly createSession = output<ToolId>();
  readonly openLibrary = output<void>();
  readonly toggleCollapsed = output<void>();
}
