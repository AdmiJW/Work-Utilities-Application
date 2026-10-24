import { ToolId } from './tool-session';

export interface WorkspacePreference {
  order: string[];
  activeId: string | null;
  counters: Record<ToolId, number>;
}
