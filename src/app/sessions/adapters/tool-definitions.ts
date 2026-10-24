import { InjectionToken } from '@angular/core';
import type { ToolDefinition } from '../models/tool-definition';

export const TOOL_DEFINITIONS = new InjectionToken<readonly ToolDefinition[]>('Tool definitions');
