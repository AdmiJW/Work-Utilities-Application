export type ToolId = 'sql-formatter' | 'output-analyzer';

export interface SessionSummary {
  id: string;
  toolId: ToolId;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastViewedAt?: number;
  isOpen: boolean;
}

export interface SessionDocument {
  id: string;
  schemaVersion: number;
  source: string;
  revision: number;
  options: Record<string, unknown>;
}
