// Shared ESLint 9 flat-config base for the Orqafy monorepo.
// Faithful port of the former root `.eslintrc.js` (ESLint 8 / typescript-eslint v7).
//
// typescript-eslint v8 mapping:
//   - `plugin:@typescript-eslint/recommended`                       ─┐ both are folded into
//   - `plugin:@typescript-eslint/recommended-requiring-type-checking`─┴ `recommendedTypeChecked`
//     (recommendedTypeChecked is a superset of recommended — confirmed via typescript-eslint docs).
//   - `eslint:recommended`  →  `@eslint/js` `js.configs.recommended`.
//   - `prettier` (eslint-config-prettier) stays LAST so it disables all formatting rules.
//
// Each workspace's `eslint.config.mjs` imports `baseConfig()` and passes its own
// `tsconfigRootDir` (+ `browser: true` where the old `env` set it), exactly as the
// old per-workspace `.eslintrc.cjs` files did via `parserOptions` / `env`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

// Global ignores — 1:1 with the former root `ignorePatterns`, expressed as flat-config
// globs (`**/…` so they match at any depth, matching the old gitignore-style semantics).
// `.expo/` and `.turbo/` are added because ESLint 8's eslintrc auto-ignored dot-directories
// by default; flat config does NOT, so we re-state them to preserve the old lint surface.
export const baseIgnores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/*.config.js',
    '**/*.config.mjs',
    '**/*.config.cjs',
  ],
};

/**
 * The shared base config array, applied by every workspace.
 *
 * @param {object} opts
 * @param {string} opts.tsconfigRootDir  Absolute dir holding the workspace tsconfig
 *                                       (`import.meta.dirname` — replaces the old `__dirname`).
 * @param {boolean} [opts.browser=false] Add browser globals (old `env: { browser: true }`).
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function baseConfig({ tsconfigRootDir, browser = false }) {
  return tseslint.config(
    baseIgnores,
    // Preserve the ESLint 8 eslintrc default (OFF). Flat config flips this meta-option
    // to "warn"; the old config never enabled it, so keep it off for behavior parity.
    // (This is not a rule — no rule is relaxed.)
    { linterOptions: { reportUnusedDisableDirectives: 'off' } },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Old `env: { node: true, es2022: true }` (+ optional browser) → explicit globals.
        globals: {
          ...globals.node,
          ...globals.es2022,
          ...(browser ? globals.browser : {}),
        },
        parserOptions: {
          // Old `parserOptions.project: ['./tsconfig.json']` + `tsconfigRootDir: __dirname`.
          project: ['./tsconfig.json'],
          tsconfigRootDir,
        },
      },
      rules: {
        // The three rules the old base explicitly set (on top of the recommended sets).
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/strict-boolean-expressions': 'error',
      },
    },
    // Keep LAST — turns off formatting rules that would fight Prettier.
    eslintConfigPrettier,
  );
}
