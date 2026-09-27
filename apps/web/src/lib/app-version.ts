import pkg from '../../package.json';

/**
 * The web app version, for the white-label sidebar footer (fleet standard:
 * version tag + Powerbyte credit). Resolution order:
 *   1. NEXT_PUBLIC_APP_VERSION — a deploy-time override (public, inlined at build).
 *   2. apps/web/package.json `version` — the source of truth in the repo.
 *   3. "0.1.0" — last-resort fallback if neither is present.
 */
export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version ?? '0.1.0';
