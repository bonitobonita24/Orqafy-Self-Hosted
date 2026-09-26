// @orqafy/geofence ESLint (flat config) — ports packages/geofence/.eslintrc.cjs.
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
