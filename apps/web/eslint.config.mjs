// apps/web ESLint (flat config) — ports the former apps/web/.eslintrc.cjs.
// Extends the monorepo base with the browser env. The six strictest type-aware
// rules are relaxed at THIS layer only: the app is glue code against third-party
// boundaries (Next.js, Auth.js v5, tRPC, TanStack Query) whose types surface
// `any` at the seam. The pure packages (@orqafy/shared, /db, /ui, /api-client)
// keep the rules at `error`.
import { baseConfig } from '../../eslint.base.mjs';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, browser: true }),
  {
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
    },
  },
  // Old ignorePatterns extra (node_modules/.next/dist are covered by the base).
  { ignores: ['next-env.d.ts'] },
];
