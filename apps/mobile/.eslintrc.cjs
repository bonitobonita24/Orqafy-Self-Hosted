module.exports = {
  root: false,
  extends: [
    '../../.eslintrc.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
  ],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: { version: 'detect' },
  },
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
  // NOTE: the `env: { 'react-native/react-native': true }` key from the CHUNK-1
  // spec requires `eslint-plugin-react-native` (not a declared devDep); omitted
  // intentionally — it only injects unused RN globals no source here uses.
};
