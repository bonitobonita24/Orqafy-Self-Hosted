// @orqafy/shared ESLint (flat config) — ports packages/shared/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
