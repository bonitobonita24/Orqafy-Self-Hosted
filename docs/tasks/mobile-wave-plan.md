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
- 2026-09-10: CHUNK 2 (offline-first data layer) built + verified (uncommitted, HARD HOLD — PM to verify+commit).
  New under `apps/mobile/src/offline/`: PURE TDD modules `types.ts` (OutboxEntry/Tombstone/SyncableRecord/
  ReconcileResult/CacheStore/OutboxStore/TombstoneStore/SendFn), `outbox.ts` (idempotent enqueue, sortOutbox
  FIFO, nextPending, immutable markSyncing/markSynced/markFailed+attempts), `reconcile.ts` (record-level LWW +
  soft-conflict + tombstone-suppression + fullSync server-delete), `sync-engine.ts` (pure deterministic
  drainOutbox with injected SendFn — no timers), `index.ts` (re-exports PURE api only). Typecheck-only expo
  adapter in `sqlite/`: `db.ts` (openDatabaseAsync + migrate → cache_records/outbox/tombstones/sync_meta),
  `stores.ts` (SqliteCache/Outbox/TombstoneStore over the confirmed SDK54 async API runAsync/getAllAsync/
  getFirstAsync/withTransactionAsync), `sqlite/index.ts`. Tests co-located (vitest ^2.1.8, node env):
  outbox.test (12) · reconcile.test (10) · sync-engine.test (7) = **29 green**. Added `vitest` devDep +
  `vitest.config.ts` (excludes `src/offline/sqlite/**`) + `"test":"vitest run"`.
  Verified green: `pnpm --filter @orqafy/mobile test` (29/29) · `typecheck` (exit 0, covers sqlite adapter types) ·
  `lint` (exit 0) · `grep -rE "expo-|react-native" src/offline/*.ts` empty (pure logic has no native imports) ·
  `grep -rE "@orqafy/(db|jobs|storage|sync|web)" src` empty (Rule 13). Pure logic imports nothing from any
  `@orqafy/*` pkg (fully generic over `SyncableRecord`), so Rule 13 is trivially clean.
  ⚠ **Record-level-LWW simplification (justified deviation from DESIGN §8's "per field" wording):** the
  `@orqafy/shared` schemas carry a SINGLE `updatedAt` per record (no per-field timestamps), so per-field LWW is
  not representable without a schema change. Chunk 2 implements **record-level LWW by `updatedAt`** instead: an
  incoming server record wins only when strictly newer; a win that collides with a local pending/failed edit is
  returned in `conflicts` (UI shows "updated on server since you edited" — never a silent clobber). The §8
  "task completion is monotonic" nuance and true per-field merge are deferred to a later chunk if/when the schema
  grows per-field metadata; noted here so the divergence is intentional and traceable. Photos = create-only
  outbox entries, never flagged (verified by test). Deviations: none beyond this. Not committed.
- 2026-09-09: CHUNK 1 (scaffold) done + verified (uncommitted, HARD HOLD). `apps/mobile` hand-authored; `npx expo install` pinned the SDK 54 line — expo ~54.0.37, expo-router ~6.0.24, expo-location ~19.0.8, expo-task-manager ~14.0.9, expo-camera ~17.0.10, expo-notifications ~0.32.17, expo-sqlite ~16.0.10, expo-secure-store ~15.0.8, expo-constants ~18.0.14, expo-linking ~8.0.12, expo-status-bar ~3.0.9, react-native-safe-area-context ~5.6.2, react-native-screens ~4.16.0, react 19.1.0, react-native 0.81.5. Verified green: `tsc --noEmit`, ESLint, `expo config` resolves, no forbidden imports, asset-guard clean. Deviations: (a) `@orqafy/ui` added as a workspace dep — required for the `@orqafy/ui/theme` VALUES import (Rule 13 carve-out; verify grep omits `ui`); (b) no `"type":"module"` on the mobile pkg (Expo app: CJS metro/babel + `expo-router/entry` main); (c) `.eslintrc.cjs` RN `env` key dropped — needs `eslint-plugin-react-native` (not in declared devDeps), only injects unused RN globals. TODO assets: no icon/splash/adaptive-icon binaries yet — `app.json` intentionally omits those fields; add + wire when brand assets exist (before a real native build).
- 2026-09-10: CHUNK 3a (server bearer auth + api-client transport) built + verified (uncommitted, HARD HOLD — PM to verify+live-test+commit). Resolves integration gaps 1 (auth transport) + 2 (thin api-client).
  NEW: `apps/web/src/lib/mobile-token.ts` (`server-only`; `signMobileToken`/`verifyMobileToken`, jose HS256) ·
  `apps/web/src/app/api/mobile/login/route.ts` (`runtime='nodejs'` POST; mirrors Auth.js `authorize()` exactly:
  zod → lowercased email → isActive → bcrypt `verifyPassword`; uniform 401, no enumeration) ·
  `apps/web/src/lib/mobile-token.test.ts` (vitest, 7 tests) · `apps/web/vitest.config.ts` +
  `apps/web/test/server-only.stub.ts`.
  MODIFIED: `apps/web/src/server/context.ts` (`createTRPCContext(req?)` — bearer PRE-branch before the unchanged
  cookie `auth()` fallback; header-only; `isActive` re-checked from DB every request; permissions ALWAYS
  DB-resolved, NEVER from the token) · `apps/web/src/app/api/trpc/[trpc]/route.ts` (`createTRPCContext(req)`) ·
  `apps/web/src/middleware.ts` (`/api/mobile` added to `PUBLIC_PREFIXES`) ·
  `packages/api-client/src/client.ts` (added `transformer: superjson` + `splitLink`/`httpSubscriptionLink`
  mirroring providers.tsx; public `{url,headers}` signature unchanged, headers → httpBatchLink false-branch).
  Deps: `jose@^6.2.12` + `vitest@^2.1.8` (apps/web), `superjson@^2.2.6` (packages/api-client); `pnpm install`
  ran (lockfile touched, all resolved from store, no downloads).
  Security properties enforced: HS256 alg-PINNED on sign+verify (alg:none / HS-tamper / foreign-secret / expired
  / wrong-typ all → null, test-proven) · token claim = userId (subject) ONLY, zero permission/role data · caller
  `isActive` re-checked from DB per request (stateless-token revocation) · bearer read ONLY from Authorization
  header, never a cookie · uniform 401 on the login endpoint (no user-enumeration) · AUTH_SECRET read fails
  CLOSED if unset.
  Verified: `pnpm --filter @orqafy/web typecheck` exit 0 · `lint` exit 0 · `test` 7/7 green · `pnpm --filter
  @orqafy/api-client typecheck && lint` exit 0. Diff-review confirmed the cookie path is byte-for-byte
  preserved as the fallback and no permission is read from the token.
  ⚠ FOLLOW-UPS: (1) rate-limit `/api/mobile/login` (per-IP + per-email lockout) before any non-localhost
  exposure — marked `// TODO` in the route; a stateless login has no brute-force protection. (2) The api-client
  `httpSubscriptionLink` carries NO auth headers (per spec — headers go to the batch branch only, mirroring
  providers.tsx's cookie model); the mobile notification stream will need bearer auth wired via
  connectionParams/query at chunk 4/5. (3) NEW vitest setup added to apps/web (it had none) — mirrors the mobile
  pkg's vitest ^2.1.8; `server-only` is aliased to a no-op stub for the node test env (it throws outside an RSC
  bundler). Deviations: none beyond (3). Not committed.
- 2026-09-10: CHUNK 3b (mobile auth + tRPC transport) built + verified (uncommitted, HARD HOLD — PM to verify+commit).
  Consumes the chunk-3a server bearer path + extended api-client. All NEW under `apps/mobile/src/`:
  `config.ts` (resolves `EXPO_PUBLIC_API_URL`, default `http://localhost:56483`, trailing-slash-stripped;
  exports `API_URL`/`TRPC_URL`/`MOBILE_LOGIN_URL`) · `auth/token-store.ts` (expo-secure-store wrapper,
  `TOKEN_KEY='orqafy.mobile.token'`, `save/get/clearToken`; get returns null on missing/unreadable) ·
  `auth/auth.ts` (`login()` → POST mobile-login, `saveToken`, returns `AuthUser`; typed `AuthError`
  'Invalid credentials' on 401 / 'Login failed' otherwise; defensive fetch+JSON; `logout()`=clearToken;
  `AuthUser={id,name,email}`) · `api/client.ts` (`createAuthedClient(token)` → `createOrqafyClient({url:TRPC_URL,
  headers: token!==null ? {Authorization:'Bearer …'} : {}})`; `getAuthedClient()` reads token then builds;
  documents the rebuild-after-token-change contract since the client captures headers at creation) ·
  `auth/AuthContext.tsx` (React-only provider + `useAuth()`; exposes `{user,loading,signIn,signOut,client}`;
  on mount reads token → hydrates `user` via `client.auth.me.query()` wrapped in try/catch — expired/invalid
  token clears token + signed-out; `me.name/email` are `string|null` → coerced `?? ''`; client REBUILT never
  mutated) · `offline/send.ts` (`createOutboxSend(client):SendFn` — typed `${entityType}/${op}` dispatch
  registry with a throwing default `No outbox mapping for …`; registry left EMPTY with a `// chunk 5: fill
  mappings` note — no router procedure mapped, exact input contracts unknown until screens exist) ·
  `offline/send.test.ts` (2 vitest, throw-on-unmapped proven with a stub client).
  MODIFIED: `app/_layout.tsx` (AuthProvider wraps the Tabs so `useAuth` is app-wide; placeholder screens kept,
  no login UI — that's chunk 5) · `.eslintrc.cjs` (Rule-13 hardening: `@typescript-eslint/no-restricted-imports`
  — `paths` bans the exact `@orqafy/ui` barrel while ALLOWING `@orqafy/ui/theme`; `patterns` bans
  `@orqafy/{db,jobs,storage,sync,web}` + `/*` subpaths; core `no-restricted-imports` turned off per the
  extension-rule contract).
  Verified green: `pnpm --filter @orqafy/mobile typecheck` exit 0 · `lint` exit 0 (rule live-checked — flags the
  ui barrel + `@orqafy/db`, does NOT flag `@orqafy/ui/theme`) · `test` 31/31 (29 prior + 2 new send) ·
  `grep -rnE "@orqafy/(db|jobs|storage|sync|web)" apps/mobile/src` empty · `grep -rn "from '@orqafy/ui" src`
  = only `@orqafy/ui/theme`. NO `npx expo install` needed (secure-store/constants already present; URL via
  `process.env.EXPO_PUBLIC_API_URL`, expo-constants unused). Outbox registry maps NOTHING yet (chunk 5 fills it);
  drainOutbox is wired to a real throwing seam. Deviation: `offline/send.ts` placed co-located in `src/offline/`
  (imports `./types`) rather than a separate dir — matches the item-6 title path; the spec's `../offline/types`
  was read as "the offline types module". Not committed.
