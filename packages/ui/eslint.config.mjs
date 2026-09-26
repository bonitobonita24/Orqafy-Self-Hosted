// @orqafy/ui ESLint (flat config) — ports packages/ui/.eslintrc.cjs.
// Old config added `env: { browser: true }` on top of the base node env.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname, browser: true });
