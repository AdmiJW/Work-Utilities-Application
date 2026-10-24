import { ESLint } from 'eslint';

const eslint = new ESLint();
const filePath = 'src/app/sql-formatter/functions/format-sql-as-one-line.ts';
const cases = [
  {
    name: 'allowed public dependency',
    source:
      "import type { SqlToken } from '../../sql-language/public-api'; export type Probe = SqlToken;",
    forbidden: false,
  },
  {
    name: 'forbidden deep import',
    source:
      "import type { AnalysisResult } from '../../output-analyzer/models/analysis-result'; export type Probe = AnalysisResult;",
    forbidden: true,
  },
  {
    name: 'forbidden private entry in an allowed module',
    source:
      "import type { SqlToken } from '../../sql-language/models/sql-token'; export type Probe = SqlToken;",
    forbidden: true,
  },
  {
    name: 'allowed same-feature internal import',
    source: "export { prettifySql as Probe } from './prettify-sql';",
    forbidden: false,
  },
  {
    name: 'forbidden dependency direction',
    source:
      "import { Workspace } from '../../workspace/public-api'; export const Probe = Workspace;",
    forbidden: true,
  },
];
for (const example of cases) {
  const [result] = await eslint.lintText(example.source, { filePath });
  const rejected = result.messages.some((message) => message.ruleId === 'boundaries/dependencies');
  if (rejected !== example.forbidden) throw new Error(`Boundary check failed: ${example.name}`);
  console.log(`Verified: ${example.name}`);
}
