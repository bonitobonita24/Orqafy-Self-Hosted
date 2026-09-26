// @orqafy/db ESLint (flat config) — ports packages/db/.eslintrc.cjs.
// Lints src/ + prisma/ (both are in db's tsconfig include, so type-aware linting works).
import { baseConfig } from '../../eslint.base.mjs';

export default baseConfig({ tsconfigRootDir: import.meta.dirname });
