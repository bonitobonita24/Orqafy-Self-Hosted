// @orqafy/api-client ESLint (flat config) — ports packages/api-client/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
