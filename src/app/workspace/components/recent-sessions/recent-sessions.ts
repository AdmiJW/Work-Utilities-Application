import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHistory,
  lucideCodeXml,
  lucideTableProperties,
  lucideArrowUpRight,
  lucideFolderOpen,
  lucidePlus,
  lucideLoaderCircle,
} from '@ng-icons/lucide';
import { SessionSummary, ToolDefinition, ToolId } from '../../../sessions/public-api';

@Component({
  selector: 'app-recent-sessions',
  imports: [DatePipe, NgIcon],
  providers: [
    provideIcons({
      lucideHistory,
      lucideCodeXml,
      lucideTableProperties,
      lucideArrowUpRight,
      lucideFolderOpen,
      lucidePlus,
      lucideLoaderCircle,
    }),
  ],
  templateUrl: './recent-sessions.html',
  styleUrl: './recent-sessions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentSessions {
  readonly sessions = input.required<SessionSummary[]>();
  readonly tools = input.required<readonly ToolDefinition[]>();
  readonly openingId = input<string | null>(null);
  readonly error = input('');
  readonly reopen = output<string>();
  readonly createSession = output<ToolId>();
  readonly openLibrary = output<void>();
  readonly visibleSessions = computed(() => this.sessions().slice(0, 8));

  toolTitle(id: ToolId): string {
    return id === 'output-analyzer' ? 'Output Analyzer' : 'SQL Formatter';
  }
  timestamp(session: SessionSummary): number {
    return session.lastViewedAt ?? session.updatedAt ?? session.createdAt;
  }
}
