/** @type {import('eslint').Linter.Config} */
// apps/web ESLint — extends the monorepo root (type-aware TS rules) with the
// browser env. The three strictest type-aware rules are relaxed at THIS layer
// only: the app is glue code against third-party boundaries (Next.js, Auth.js
// v5, tRPC, TanStack Query) whose types surface `any` at the seam. The pure
// packages (@orqafy/shared, /db, /ui, /api-client) keep the rules at `error`.
module.exports = {
  root: true,
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
  },
  ignorePatterns: ['node_modules/', '.next/', 'next-env.d.ts', 'dist/'],
};
