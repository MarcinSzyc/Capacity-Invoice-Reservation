// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {ignores: ['dist', 'coverage', 'node_modules', 'generated', 'eslint.config.mjs']},
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-nested-ternary': 'error',
      'max-depth': ['error', 2],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // ADR-0002: the data access library is forbidden in application/ as well as domain/.
    files: ['src/modules/**/application/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/*',
                'prisma',
                '.prisma/*',
                '**/generated/**',
                '**/persistence/**',
              ],
              message: 'Persistence stays in infrastructure: no ORM in application (ADR-0002).',
            },
          ],
        },
      ],
    },
  },
  {
    // CLAUDE.md §2: the domain layer is framework free and never sees persistence.
    files: ['src/modules/**/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', '@nestjs/**'],
              message: 'Domain is framework free: no @nestjs imports (CLAUDE.md §2).',
            },
            {
              group: [
                '@prisma/*',
                'prisma',
                '.prisma/*',
                '**/generated/**',
                '**/persistence/**',
                '**/messaging/**',
              ],
              message: 'Persistence stays in infrastructure: no Prisma in domain (ADR-0002).',
            },
            {
              group: ['**/infrastructure/**', '**/application/**'],
              message: 'Domain never imports outward; dependencies enter through ports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {globals: {process: 'readonly'}},
  },
  {
    files: ['**/*.test.ts', '**/*.integration-test.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
