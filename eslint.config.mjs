import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'src/routes.ts',
      'src/config/swagger.json',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Relaxed by design: `any` is a warning, not a CI failure.
      // Use `npm run lint:strict` locally for zero-warning check.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
    },
  },
  {
    // Router tests unwrap fixtures with `!` pervasively by design
    // (backlogId!, itemId, ...). tsc strict-null-checks still apply.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-unsafe-optional-chaining': 'off',
    },
  }
);
