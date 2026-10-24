import type { Type } from '@angular/core';
import type { ToolId } from './tool-session';

export interface ToolDefinition {
  id: ToolId;
  title: string;
  description: string;
  icon: string;
  loadComponent: () => Promise<Type<unknown>>;
}
