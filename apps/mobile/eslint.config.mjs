// apps/mobile ESLint (flat config) — ports the former apps/mobile/.eslintrc.cjs.
// Extends the monorepo base + React / React-Hooks, and carries the Rule-13 guard.
import { baseConfig } from '../../eslint.base.mjs';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),

  // Old: extends ['plugin:react/recommended', 'plugin:react/jsx-runtime'].
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  // Old: extends ['plugin:react-hooks/recommended'] — register the plugin + its
  // recommended ruleset (rules-of-hooks: error, exhaustive-deps: warn).
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  {
    // Old: settings.react.version 'detect'.
    settings: { react: { version: 'detect' } },
    rules: {
      // Rule 13 (chunk-3b hardening): mobile imports API only. Ban the server/data
      // packages outright and the @orqafy/ui component *barrel*, while ALLOWING the
      // @orqafy/ui/theme subpath (token VALUES — the sole sanctioned ui import).
      // The core rule is disabled per typescript-eslint's extension-rule contract.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          // Exact-name match — does NOT catch the allowed `@orqafy/ui/theme` subpath.
          paths: [
            {
              name: '@orqafy/ui',
              message:
                'Rule 13: import token VALUES from "@orqafy/ui/theme" only — never the @orqafy/ui component barrel.',
            },
          ],
          patterns: [
            {
              group: [
                '@orqafy/db',
                '@orqafy/db/*',
                '@orqafy/jobs',
                '@orqafy/jobs/*',
                '@orqafy/storage',
                '@orqafy/storage/*',
                '@orqafy/sync',
                '@orqafy/sync/*',
                '@orqafy/web',
                '@orqafy/web/*',
              ],
              message:
                'Rule 13: mobile may not import server/data packages — use @orqafy/api-client (API only).',
            },
          ],
        },
      ],
    },
  },
];

// NOTE: the `env: { 'react-native/react-native': true }` key from the CHUNK-1
// spec requires `eslint-plugin-react-native` (not a declared devDep); omitted
// intentionally — it only injects unused RN globals no source here uses.
