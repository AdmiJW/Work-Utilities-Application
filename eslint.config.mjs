import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier/flat';

const dependencies = {
  workspace: ['sessions', 'appearance', 'offline-support', 'file-transfer'],
  'sql-formatter': ['sessions', 'sql-language', 'appearance', 'file-transfer'],
  'output-analyzer': ['sessions', 'sql-language', 'appearance', 'file-transfer'],
  sessions: [],
  'sql-language': [],
  appearance: ['sessions'],
  'offline-support': ['sessions'],
  'file-transfer': [],
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'src/generated/**',
      'node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  {
    files: ['**/*.mjs'],
    ...eslint.configs.recommended,
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: { '@angular-eslint/prefer-inject': 'error' },
  },
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { project: './e2e/tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/app/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': Object.keys(dependencies).map((type) => ({
        type,
        pattern: `src/app/${type}`,
      })),
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: Object.entries(dependencies).map(([from, allowed]) => ({
            from: { element: { type: from } },
            disallow: {
              to: [
                {
                  element: {
                    type: Object.keys(dependencies).filter(
                      (type) => type !== from && !allowed.includes(type),
                    ),
                  },
                },
                { element: { type: allowed, fileInternalPath: '!public-api.ts' } },
              ],
            },
            message:
              'Import another feature only through its public-api.ts and an allowed dependency direction.',
          })),
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
  prettier,
);
