# Expo Mobile Wave — Build Plan (`apps/mobile`)

**Started:** 2026-09-09 · **Status:** IN PROGRESS (chunk 1). Multi-session wave, milestone-save between chunks.
Authority for the whole mobile wave. Product decisions locked (D-6/D-15/D-19/D-25); this is execution.

## Verification bar (READ FIRST — no device here)
There is **no physical device or simulator** in this environment (live geofence-over-tunnel is the existing
BLOCKED-hardware task in TASK_QUEUE). This wave's done-bar is therefore **static + unit**, per
`docs/tasks/phase4-part6.md`:
- `tsc --noEmit` green · ESLint green · `vitest` green for pure logic
- Expo **config validity** (`npx expo config --json` resolves; `app.json` plugins parse)
- The **geofence background task registers** at module scope (verified by unit test of the wiring, not a live fix)
A native build / on-device geofence trigger is explicitly OUT of scope until hardware exists.

## Locked scope (PRODUCT.md + DESIGN §6/§8 + R6)
- Native Expo app, **sideload/self-build** (D-6), **offline-first** (D-15). Field/Site Staff = primary user.
- **Mobile-First screens:** My Tasks · geofence alert (on-device) · photo capture · apply-for-leave · notifications center.
- **Mobile-Ready:** dashboard · projects/board · Gantt (view-only) · leave approvals · calendar · files browse+upload · review tray · clients · settings.
- **Deferred:** background push (UnifiedPush/APNs) = v1.x · client portal + finance = v2.

## Reuse (Rule 13 — mobile imports API only, NEVER `@orqafy/db`/jobs/storage/sync/web)
- ✅ `@orqafy/geofence` — pure: `haversineMeters`, `evaluateRegionState`, `prioritizeRegions(regions,origin,cap=20)` (iOS 20-cap), `DwellTracker` (3-min app-side dwell), `DEFAULT_DWELL_MS=180000`, `RegionState`, `GeofenceRegion`.
- ✅ `@orqafy/api-client` — `createOrqafyClient({url,headers})` → typed tRPC client; `AppRouter` type-only.
- ✅ `@orqafy/shared` — Zod schemas + inferred types + `Location` VO + `Permission`.
- ✅ `@orqafy/ui/theme` **token VALUES only** (`tokens.ts` pure HSL) — NOT the web components.
- The mobile **outbound queue is NEW** in `apps/mobile` (`@orqafy/sync` is the Tauri/Nextcloud provider, not this).

## Integration gaps to resolve ([HOW], decided)
1. **Auth transport** — web is Auth.js v5 cookie/JWT session; not portable to Expo, and **no server bearer path exists yet**. PLAN: add server-side token issuance + accept `Authorization: Bearer` in the tRPC context (`apps/web`), mobile stores the token (SecureStore) and passes it via `createOrqafyClient({headers})`. Persistent auth = long-lived token; offline reads work from cache after expiry. (Chunk 3.)
2. **`createOrqafyClient` is thin** — missing the `superjson` transformer the server requires; no subscription link. PLAN: add `transformer: superjson`; add `httpSubscriptionLink`/`splitLink` for the notification stream. (Chunk 3.)
3. **Expo SDK / typings** — pinned to **SDK 54** (documented GA floor per R6 §7; bumpable). Confirm exact `LocationRegion` field names from SDK typings before chunk 4 geofence coding.

## Conventions (match the monorepo)
pnpm@10.33 / node ≥22 / `workspace:*` deps · `"type":"module"`, `"license":"AGPL-3.0-or-later"`, `"private":true` ·
TS extends `../../tsconfig.base.json` · **ESLint v8 legacy** `.eslintrc.cjs` `extends ['../../.eslintrc.js']` ·
turbo tasks (`typecheck`/`lint`/`test`/`build`) · **Metro**: `watchFolders=[monorepoRoot]`,
`resolver.nodeModulesPaths=[project, monorepoRoot]`. Asset guard forbids committing `.ai_prompt/`, `AI/`,
`starter/admincn/`, `.claude/`, `CLAUDE.md`, `inputs.yml`. HARD HOLD — local commits only, nothing pushed.

## Chunks
1. **Scaffold** (this session) — `apps/mobile` Expo SDK 54 dev-build app: package.json (pinned deps),
   `app.json` (config plugins: expo-location Always + iOS bg + Android bg + foreground-service; expo-camera;
   expo-notifications), `metro.config.js` (monorepo), `babel.config.js`, `tsconfig.json` (extends base + RN/jsx),
   `.eslintrc.cjs`, expo-router bottom-tab nav shell, `theme/` from `tokens.ts`, placeholder screens.
   Verify: `pnpm install`, `tsc --noEmit`, `expo config` resolves.
2. **Offline data layer** — expo-sqlite cached read model + durable append-only outbound queue
   (client-id idempotency, `createdAt`, LWW-by-`updatedAt`, tombstones). TDD the queue/merge logic (pure, vitest).
3. **Auth + tRPC transport** — server bearer path (gap 1) + extended `createOrqafyClient` (gap 2) + SecureStore token.
4. **Geofence integration** — `expo-location`/`expo-task-manager` module-scope task wired to `@orqafy/geofence`
   (`prioritizeRegions` re-arm on `startGeofencingAsync`, `DwellTracker` → `expo-notifications` local notif).
5. **Core screens** — My Tasks · photo capture (expo-camera → queued upload) · apply-leave · notifications.

## Log
- 2026-09-09: wave promoted by owner; scout brief + context7 (SDK 54 config plugins, monorepo Metro) captured; plan written; chunk 1 starting on `feat/mobile-scaffold`.
- 2026-09-09: CHUNK 1 (scaffold) done + verified (uncommitted, HARD HOLD). `apps/mobile` hand-authored; `npx expo install` pinned the SDK 54 line — expo ~54.0.37, expo-router ~6.0.24, expo-location ~19.0.8, expo-task-manager ~14.0.9, expo-camera ~17.0.10, expo-notifications ~0.32.17, expo-sqlite ~16.0.10, expo-secure-store ~15.0.8, expo-constants ~18.0.14, expo-linking ~8.0.12, expo-status-bar ~3.0.9, react-native-safe-area-context ~5.6.2, react-native-screens ~4.16.0, react 19.1.0, react-native 0.81.5. Verified green: `tsc --noEmit`, ESLint, `expo config` resolves, no forbidden imports, asset-guard clean. Deviations: (a) `@orqafy/ui` added as a workspace dep — required for the `@orqafy/ui/theme` VALUES import (Rule 13 carve-out; verify grep omits `ui`); (b) no `"type":"module"` on the mobile pkg (Expo app: CJS metro/babel + `expo-router/entry` main); (c) `.eslintrc.cjs` RN `env` key dropped — needs `eslint-plugin-react-native` (not in declared devDeps), only injects unused RN globals. TODO assets: no icon/splash/adaptive-icon binaries yet — `app.json` intentionally omits those fields; add + wire when brand assets exist (before a real native build).
