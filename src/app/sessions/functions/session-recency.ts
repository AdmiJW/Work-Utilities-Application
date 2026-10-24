import { SessionSummary } from '../models/tool-session';

export function sessionRecency(session: SessionSummary): number {
  return session.lastViewedAt ?? session.updatedAt ?? session.createdAt;
}

export function sortRecentSessions(sessions: readonly SessionSummary[]): SessionSummary[] {
  return sessions.toSorted(
    (a, b) => sessionRecency(b) - sessionRecency(a) || a.id.localeCompare(b.id),
  );
}

export function nextViewedAt(sessions: readonly SessionSummary[]): number {
  return sessions.reduce((next, item) => Math.max(next, (item.lastViewedAt ?? 0) + 1), Date.now());
}

export function preserveLatestView(
  summary: SessionSummary,
  stored?: SessionSummary,
): SessionSummary {
  const lastViewedAt = Math.max(summary.lastViewedAt ?? 0, stored?.lastViewedAt ?? 0);
  return lastViewedAt ? { ...summary, lastViewedAt } : summary;
}
