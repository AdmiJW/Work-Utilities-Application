import { ToolDefinition } from './sessions/public-api';

export const toolDefinitions: readonly ToolDefinition[] = [
  {
    id: 'sql-formatter',
    title: 'SQL Formatter',
    description: 'Write, format & export',
    icon: 'lucideCodeXml',
    loadComponent: () => import('./sql-formatter/public-api').then((module) => module.SqlFormatter),
  },
  {
    id: 'output-analyzer',
    title: 'DER/DPR Output Analyzer',
    description: 'From logs to clarity',
    icon: 'lucideTableProperties',
    loadComponent: () =>
      import('./output-analyzer/public-api').then((module) => module.OutputAnalyzer),
  },
];
