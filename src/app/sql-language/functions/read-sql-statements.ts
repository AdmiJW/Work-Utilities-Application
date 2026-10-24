import { SqlToken } from '../models/sql-token';
import { tokenizeSql } from './tokenize-sql';

export function significantSqlTokens(source: string): SqlToken[] {
  return tokenizeSql(source).filter((token) => token.kind !== 'space' && token.kind !== 'comment');
}

export function readSqlStatements(source: string): SqlToken[][] {
  const statements: SqlToken[][] = [];
  let statement: SqlToken[] = [];
  for (const token of tokenizeSql(source)) {
    if (token.kind === 'symbol' && token.text === ';') {
      if (statement.some((item) => item.kind !== 'space' && item.kind !== 'comment'))
        statements.push(statement);
      statement = [];
    } else statement.push(token);
  }
  if (statement.some((item) => item.kind !== 'space' && item.kind !== 'comment'))
    statements.push(statement);
  return statements;
}

/** WITH statements are classified by their outer statement, not a CTE's inner SELECT. */
export function getSqlStatementKind(source: string): string {
  let depth = 0;
  for (const token of significantSqlTokens(source)) {
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (
      depth === 0 &&
      /^(SELECT|INSERT|UPDATE|DELETE|MERGE|DECLARE|BEGIN|IF|EXEC|CREATE|ALTER|DROP|GO)$/i.test(
        token.text,
      )
    )
      return token.text.toUpperCase();
  }
  return 'UNKNOWN';
}
