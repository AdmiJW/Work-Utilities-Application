import { SessionSummary } from '../models/tool-session';
import { WorkspacePreference } from '../models/workspace-preference';

export function readWorkspacePreference(
  summaries: SessionSummary[],
  saved: unknown,
): WorkspacePreference {
  const value = saved as Partial<WorkspacePreference> | undefined;
  const open = summaries.filter((item) => item.isOpen).map((item) => item.id);
  return {
    order: [
      ...new Set([
        ...(Array.isArray(value?.order) ? value.order.filter((id) => open.includes(id)) : []),
        ...open,
      ]),
    ],
    activeId:
      typeof value?.activeId === 'string' && open.includes(value.activeId)
        ? value.activeId
        : (open[0] ?? null),
    counters: { 'sql-formatter': 0, 'output-analyzer': 0, ...value?.counters },
  };
}
