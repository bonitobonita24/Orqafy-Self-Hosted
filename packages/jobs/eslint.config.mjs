// @orqafy/jobs ESLint (flat config) — ports packages/jobs/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
