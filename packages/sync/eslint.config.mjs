// @orqafy/sync ESLint (flat config) — ports packages/sync/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
