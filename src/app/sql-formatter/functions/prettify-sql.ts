import { format } from 'sql-formatter';

export function prettifySql(source: string): string {
  return format(source, { language: 'transactsql', tabWidth: 4, keywordCase: 'upper' });
}
