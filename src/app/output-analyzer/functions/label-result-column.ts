import { SqlToken } from '../../sql-language/public-api';

function identifier(token: SqlToken | undefined): boolean {
  return !!token && ['word', 'quoted'].includes(token.kind) && !/^\d/.test(token.text);
}

/** Preserve provenance and expressions instead of guessing a name from identifiers inside them. */
export function labelResultColumn(tokens: SqlToken[], expression: string, index: number): string {
  if (
    tokens.length % 2 === 1 &&
    tokens.every((token, position) => (position % 2 === 0 ? identifier(token) : token.text === '.'))
  )
    return expression;
  // An explicitly named scalar SELECT output may supply its own meaningful label.
  const scalarSelect = tokens[0]?.text === '(' && tokens[1]?.text.toUpperCase() === 'SELECT';
  let depth = 0;
  for (let position = 0; position < tokens.length; position++) {
    const token = tokens[position]!;
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (scalarSelect && depth === 1 && token.text.toUpperCase() === 'FROM') break;
    if (
      token.text.toUpperCase() === 'AS' &&
      depth === (scalarSelect ? 1 : 0) &&
      identifier(tokens[position + 1])
    ) {
      const alias = tokens[position + 1]!.text;
      const following = tokens[position + 2]?.text.toUpperCase();
      if (!following || (scalarSelect && ['FROM', ')'].includes(following))) return alias;
    }
  }
  return expression || `Column ${index + 1}`;
}
