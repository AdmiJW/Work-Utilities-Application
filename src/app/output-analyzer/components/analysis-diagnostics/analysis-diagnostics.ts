import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnalysisDiagnostic, OutputStatement } from '../../models/analysis-result';

@Component({
  selector: 'app-analysis-diagnostics',
  templateUrl: './analysis-diagnostics.html',
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
      padding: 20px;
    }
    h2 {
      font-size: 14px;
      margin: 0 0 8px;
    }
    .intro {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    details {
      border: 1px solid var(--border);
      border-radius: 7px;
      margin-bottom: 10px;
      background: var(--panel);
    }
    summary {
      cursor: pointer;
      padding: 12px 14px;
      font-size: 12px;
      line-height: 1.8;
    }
    .location {
      font-size: 10px;
      color: var(--accent);
      display: block;
      margin-bottom: 5px;
    }
    pre {
      margin: 0;
      padding: 14px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      line-height: 1.8;
      overflow: auto;
      background: var(--panel-raised);
      white-space: pre;
    }
    .statement-card {
      border: 1px solid var(--border);
      border-radius: 7px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .card-heading {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px;
      font-size: 12px;
    }
    .count {
      margin-left: auto;
      color: var(--muted);
      font-size: 11px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisDiagnostics {
  readonly diagnostics = input<AnalysisDiagnostic[]>([]);
  readonly statements = input<OutputStatement[]>([]);
  readonly mode = input<'diagnostics' | 'summary'>('diagnostics');
}
