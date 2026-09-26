// @orqafy/storage ESLint (flat config) — ports packages/storage/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
