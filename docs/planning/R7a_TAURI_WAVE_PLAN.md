# Tauri Desktop Wave — Build Plan (`apps/desktop`)

**Written:** 2026-09-26 · **Status:** GROUNDWORK ONLY — the desktop track is **DEFERRED / not started**.
Authority for the whole desktop wave when it is greenlit. Product decisions are locked (D-3/D-7/D-8/D-11/
D-14/D-15/D-19); this is the execution plan built on top of them, not a re-decision of any of them.

> ⚠ **This is a plan, not a signal to build.** D-3 puts the native desktop app on a *later track, not v1*.
> Nothing here is authorized for execution. Starting the wave is an **owner-gated `[WHAT]`** (timing) that
> must clear the open questions in §7 + the prerequisites in §8 first. HARD HOLD — local only, nothing pushed.

---

## 0. Purpose & scope

Turn the settled desktop research (R7 packaging/signing/updater/sidecar · R8 sync cadence · the existing
`@orqafy/sync` port) into an ordered, chunked build wave — the same execution artifact
`docs/tasks/mobile-wave-plan.md` is for the Expo app. It maps what the desktop **client** reuses vs builds
net-new, sequences the chunks with per-chunk done-criteria, and surfaces the open `[WHAT]`s for when the
owner greenlights the track.

- **In scope:** the plan for `apps/desktop` — a **Tauri v2 desktop CLIENT** (Windows + macOS + Linux), its
  Rust sidecar supervising the **adopted** sync engine (`nextcloudcmd`), packaging/signing/auto-update, and
  the reuse-vs-net-new boundary against the existing web app + `@orqafy/*` packages.
- **Out of scope of this doc:** re-deriving R7/R8 (cited, not duplicated); building any app code; re-opening
  any locked decision; the mobile app (its own wave); the server (Compose per D-3, untouched by this).

## 1. The locked decisions this rests on (verbatim positions — do NOT re-decide)

- **D-3 · Server install form:** *"Docker Compose first. A native desktop installer (Tauri/Electron) is a
  **later track, not v1**."* → The desktop app is deferred; the **server is always Compose**, never bundled.
- **D-7 · Client platforms:** *"the desktop app is a **CLIENT ONLY**. The server is still installed via
  Docker Compose — D-3 stands and is not superseded. The desktop app connects to a server; it does not
  bundle or become one."* → *"Bundling a database or object store into the desktop app is explicitly out of
  scope."* Targets: **Windows and macOS** (D-7); Linux AppImage follows from R7's build matrix.
- **D-8 · One language:** *"TypeScript across the whole product … a TypeScript desktop shell."* Tauri's Rust
  is the *"deliberate, contained exception."*
- **D-11 · Desktop shell — Tauri:** *"Tauri, accepting roughly **50–300 lines of Rust confined to sidecar
  supervision**."* ~17 MB installer vs ~112 MB Electron, lower RAM. *"If the Rust surface ever grows beyond
  sidecar supervision, that is a signal to revisit."*
- **D-14 · Desktop sync — adopt, don't build:** *"bundle **Nextcloud's headless/command-line sync client**
  and supervise it from the Tauri shell … The user sees **one app**; we write **no sync engine**."*
  R8 confirmed `nextcloudcmd` is **one-shot** → the sidecar drives cadence (debounced fs-watch + timer,
  serialized per folder). Fallback if impractical = D-10a option (b) WebDAV-in-client.
- **D-15 · LAN-first / offline-first:** *"v1 targets a **LAN install with no VPS required**."* Remote access
  (Pangolin) is an optional add-on. Offline-first is a design commitment.
- **D-19 · Geofence:** on-device/offline, presence-only — **native-mobile-only** (geofencing is not a
  desktop capability; the desktop client has no geofence surface).

**HARD CONSTRAINT (from D-14, restated so the wave cannot drift):** File sync is **adopted, never built.**
The Rust sidecar **wraps and supervises** `nextcloudcmd` (spawn / lifecycle / restart / cadence / status
relay) — it must **never** reimplement scan/diff/transfer/conflict. Writing a sync engine is D-10a option
(b), a months-long owner-gated escalation behind the `FileSyncProvider` port, not part of this wave.

---

## 2. What the desktop app IS (architecture)

A thin **Tauri v2 shell** that renders the **existing web UI** and talks to a user-supplied Orqafy server
over the **same tRPC API the web and mobile clients use** — plus a **Rust sidecar** that supervises the
bundled `nextcloudcmd` so a project folder stays synced and the user sees one application.

```
┌───────────────────────── apps/desktop (Tauri v2) ─────────────────────────┐
│  WebView (TypeScript, reuses apps/web UI)                                   │
│    → tRPC over HTTP(S) → user's Orqafy server  (@orqafy/api-client)         │
│    → sync status/actions via Tauri events/commands (IPC)                    │
│                                                                            │
│  Rust core (D-11: ~50–300 LOC, sidecar supervision ONLY)                    │
│    externalBin: binaries/orqafy-sync-<triple>  ==  bundled `nextcloudcmd`   │
│    ShellExt::sidecar().spawn() → own lifecycle, restart w/ capped backoff,  │
│    drive cadence (debounced fs-watch + timer, per-folder lock), relay status│
│    (wraps @orqafy/sync's NextcloudCmdDriver contract — R8 §3.2)             │
└────────────────────────────────────────────────────────────────────────────┘
        │ HTTP(S) tRPC                         │ WebDAV (nextcloudcmd → Nextcloud)
        ▼                                      ▼
   Orqafy server (Compose, D-3)          Nextcloud (Compose sidecar, D-10)
```

### 2.1 UI reuse posture — `[WHAT]` to confirm at greenlight (§7 Q2)
Two viable shapes, both keeping the app TypeScript-only per D-8. **Not decided here** — recorded as an open
question, with the recommended default called out:
- **(Recommended) Reuse the Next.js `apps/web` UI inside the WebView** — either pointed at the user's server
  URL, or a Tauri-served static export of the app-shell. Maximises reuse of every screen already built;
  desktop-specific surface is only the sync panel + settings. Lowest net-new UI.
- **(Alt) A dedicated `apps/desktop` React SPA** that reuses `@orqafy/ui` components + `@orqafy/api-client`.
  More control over desktop chrome, but re-implements navigation/screens the web app already has.

### 2.2 Topology — desktop-as-CLIENT (locked by D-7), LAN-first (D-15)
The desktop app is a **client of a server**, never a server (D-7). It connects to a user-supplied server
URL — on the **LAN by default** (D-15), optionally over the Pangolin tunnel when a firm opts in (D-9/D-15).
It bundles **no** Postgres/MinIO/Nextcloud (D-7). "Desktop-as-server" was the rejected option; this plan
does not revisit it.

### 2.3 The Rust sidecar's role (R7 §4 / DESIGN §9 — supervise the ADOPTED engine)
The sole non-TypeScript surface (D-11). Its 7-point spec is fixed by R7 §4.2 / DESIGN §9: (1) launch the
bundled `nextcloudcmd`; (2) own its lifecycle (kill on exit); (3) watch its `CommandEvent` stream;
(4) restart-on-crash, capped backoff; (5) **drive cadence** — debounced fs-watch + periodic timer,
serialized behind a per-project-folder lock (because `nextcloudcmd` is one-shot, R8 §1); (6) relay sync
state (idle/syncing/error/offline-queued) to the TS UI via Tauri events; (7) pass only validated args.
**No sync/conflict/domain logic in Rust** — that stays in `nextcloudcmd` (csync) and the server. If this
surface grows past supervise+relay, that is the D-11 signal to revisit Tauri.

### 2.4 Offline-first (D-15)
Field work continues without the server as a hard dependency. On the desktop the offline surface is
narrower than mobile (no geofence): a synced project folder stays available locally via `nextcloudcmd`'s
journal; tRPC reads degrade to last-known-good where cached; writes made offline are the server's concern
(the desktop reuses whatever the web client already does). **Gap:** the web app's current offline-write
behaviour on the desktop is unspecced — see §9 gaps.

---

## 3. Reuse vs net-new (the boundary map)

**Heavy reuse — already built, desktop consumes as-is:**
- ✅ `@orqafy/sync` — **the `FileSyncProvider` port + `NextcloudCmdDriver`/`WebDavSyncDriver` + factory
  already exist** (`packages/sync/src/{provider,nextcloudcmd-driver,webdav-driver,factory}.ts`). The argv
  builder (`buildNextcloudCmdArgs`) and env builder (`nextcloudCmdEnv`) are real + unit-friendly; the
  `syncOnce`/`start`/`stop` **spawn + supervising loop is explicitly stubbed** with `TODO(part-7): … Tauri
  sidecar`. **This wave IS "part 7":** the Rust sidecar fulfils that stubbed contract. Driver-swap to WebDAV
  fallback (D-10a b) stays behind this same port.
- ✅ `@orqafy/api-client` — `createOrqafyClient({url,headers})` typed tRPC client (already `superjson` +
  `splitLink`/`httpSubscriptionLink` after the mobile chunk-3a work). Desktop reuses it directly.
- ✅ `@orqafy/shared` — Zod schemas + inferred types + VOs + `Permission`.
- ✅ `@orqafy/ui` — shadcn/ui + Kibo + map components + `theme/` tokens (full component reuse for desktop,
  unlike mobile which took token VALUES only).
- ✅ `apps/web` screens — every already-built web screen (dashboard, board, Gantt, files, leave, review
  tray, clients, settings) is candidate reuse under §2.1.
- ✅ Server bearer-auth path — `apps/web` `/api/mobile/login` + `Authorization: Bearer` tRPC context
  (built for mobile) is **directly reusable** for desktop token auth (or desktop reuses Auth.js cookies if
  it embeds the web app same-origin — see §7 Q3).

**Net-new (this wave builds it):**
- 🔨 `apps/desktop/` — the Tauri v2 project: `src-tauri/` (Rust), `tauri.conf.json`, capabilities, WebView
  wiring, sync panel + settings UI, per-platform bundle config.
- 🔨 The **Rust sidecar** (~50–300 LOC, D-11): spawn/supervise `nextcloudcmd`, cadence loop, per-folder
  lock, capped backoff, status→TS event bridge — fulfilling the `@orqafy/sync` stub.
- 🔨 **Bundling of `nextcloudcmd`** as `externalBin` per target triple (Win/macOS/Linux) — sourcing the
  redistributable binary + its Qt/OpenSSL deps (footprint measured — R8 §5.3 gap).
- 🔨 **Cadence/fs-watch trigger** wiring (debounce, serialize) — the code R8 §3.2 checklists.
- 🔨 **Packaging + signing + auto-update** pipeline per platform (R7 §1–§3): minisign updater keys, static
  JSON manifest on our own domain, per-platform code signing.
- 🔨 **First-run / server-connection + folder-selection UX** (which server URL, which local folder syncs).
- 🔨 (Fallback only, NOT this wave) WebDAV-in-client engine — D-10a option (b), owner-gated escalation.

---

## 4. Verification bar (READ FIRST — environment limits)

Mirror of the mobile wave's "no device here" reality. This machine is a **WSL2 Linux dev box**: it can build
+ typecheck + unit-test, and can produce a **Linux AppImage**, but **cannot** produce or verify a signed/
notarized **macOS** or **Windows** artifact (needs Apple/Windows toolchains + real certs), and there is **no
release host** wired (HARD HOLD). So the wave's realistic done-bar per chunk is **static + unit + Linux-local
build**, with signing/notarization/updater end-to-end explicitly **deferred to a signing-capable CI + an
owner-authorized release channel**:
- `pnpm typecheck` (TS) green · `cargo check`/`cargo clippy` green for the Rust core · ESLint green ·
  `vitest` green for pure TS (sidecar arg/cadence logic that stays in `@orqafy/sync`).
- `cargo test` green for pure Rust helpers (backoff schedule, arg validation, debounce state machine).
- `pnpm tauri build` produces a **Linux AppImage** locally (unsigned OK — `--no-sign`, R7 §1).
- macOS `.app`/DMG + notarization, Windows NSIS/MSI + Authenticode, and the live updater feed are
  **CI + owner-gated**, verified only when a signing-capable runner + release host exist (§7 Q4/Q5, §8).

---

## 5. Chunks (ordered build wave)

Each chunk: scope · depends-on · reuse vs net-new · done-criterion. Multi-session; milestone-save between
chunks (mirrors the mobile wave). Chunks 6–7 are **owner/CI-gated** (signing + release infra).

**Chunk 1 — Scaffold `apps/desktop` (Tauri v2 shell).**
- Scope: Tauri v2 project — `src-tauri/` (Cargo, `tauri.conf.json`, `main.rs` minimal), WebView pointed at
  the reused UI (§2.1 decision), monorepo wiring (`workspace:*`, turbo tasks, AGPL license field, base
  tsconfig), dev script that does **not** duplicate a running server (edit-and-reload).
- Depends-on: §7 Q2 (UI reuse posture) answered.
- Reuse: `@orqafy/ui`, `@orqafy/api-client`, `apps/web` shell. Net-new: the Tauri project + Rust skeleton.
- Done: `pnpm --filter @orqafy/desktop typecheck`+`lint` green · `cargo check` green · `pnpm tauri dev`
  opens the shell rendering a reused screen · asset-guard clean · no forbidden imports.

**Chunk 2 — Server connection + auth transport.**
- Scope: first-run "connect to your server" UX (server URL, LAN-first per D-15), token/session acquisition,
  persistent secure credential storage (OS keychain via a Tauri store), `createOrqafyClient` wired.
- Depends-on: Chunk 1; §7 Q3 (cookie-same-origin vs bearer-token) answered.
- Reuse: `@orqafy/api-client`; the server bearer path built for mobile (or Auth.js cookies if same-origin).
- Net-new: desktop credential store + connection UX. Done: authenticated tRPC call succeeds against a live
  dev server; token persists across restart; typecheck/lint/`cargo check` green.

**Chunk 3 — Rust sidecar: spawn + lifecycle + status bridge (supervise, don't build).**
- Scope: bundle `nextcloudcmd` as `externalBin` per host triple; `shell:allow-execute` capability scoped to
  the sidecar with a **validated arg allow-list**; `ShellExt::sidecar().spawn()`; own the child (kill on
  exit); consume `CommandEvent::{Stdout,Stderr,Terminated,Error}`; emit sync state as Tauri events → TS UI.
- Depends-on: Chunk 1; a sourced `nextcloudcmd` binary (§8 prerequisite).
- Reuse: `@orqafy/sync` `buildNextcloudCmdArgs`/`nextcloudCmdEnv` (the argv/env contract already exists);
  DESIGN §9 / R7 §4.2 spec. Net-new: the Rust supervision code + the TS event listener + sync-panel UI.
- Done: sidecar launches + a manual `syncOnce` transfers a file to a dev Nextcloud; kill-on-exit verified
  (no orphan process); status events reach the UI; `cargo clippy` clean; **Rust LOC within the D-11
  50–300 budget** (recorded).

**Chunk 4 — Continuous cadence (the R8 recommendation, no engine written).**
- Scope: debounced filesystem-watch trigger + periodic timer (default poll 30–60 s / debounce ~2 s per the
  `@orqafy/sync` config defaults), **serialized behind a per-project-folder mutex**, exponential backoff +
  cap on non-zero exit, exit-code/`--silent`-output parsing into the change feed. Per-project folder→
  invocation config.
- Depends-on: Chunk 3.
- Reuse: `SyncConfig` schema (`pollIntervalMs`/`watchDebounceMs`/`excludes`/`conflictPolicy` already
  defined). Net-new: the supervising loop (fulfils the `NextcloudCmdDriver` `start`/`stop` stub).
- Done: a local change syncs within debounce; a remote change appears within the poll interval; two rapid
  bursts coalesce to one run; a killed run resumes cleanly (csync journal); no concurrent run on one folder
  (mutex proven by test). `notify_push` fast-follow explicitly deferred (R8 §3.1, unverified).

**Chunk 5 — Sync UX + settings + offline-first surface.**
- Scope: sync status panel (idle/syncing/error/offline-queued), folder picker, exclude patterns, conflict
  policy selector, retry control; degrade-to-cache reads where the reused web UI supports it; error surfacing
  for repeated sidecar failure.
- Depends-on: Chunks 2–4.
- Reuse: `@orqafy/ui` components; `SyncStatus`/`SyncResult` shapes from the port. Net-new: the panel/settings
  screens. Done: full local sync loop drives a visible, correct status UI; typecheck/lint/`cargo` green.

**Chunk 6 — Packaging + code signing (per platform) [OWNER/CI-gated].**
- Scope: per-platform bundle config (R7 §1): macOS Developer ID + hardened runtime + notarization/stapling
  (notarytool); Windows Authenticode (SignTool thumbprint or `signCommand` — Azure Trusted Signing/EV);
  Linux AppImage optional GPG. CI keychain/cert import; sidecar signed **inside-out with the `.app`** on
  macOS. Certificates + credentials live in the **Server-Setups vault** (SOPS+age), never the repo.
- Depends-on: Chunks 1–5; **real signing certs + a signing-capable CI runner** (§8 prerequisite, owner-gated).
- Reuse: R7 §1 matrix verbatim. Net-new: the CI signing pipeline + config. Done: a **signed** installer per
  target opens without an OS gatekeeper block on a clean machine (verified on real Win/macOS — out of this
  dev box's reach; CI/owner-gated).

**Chunk 7 — Auto-update (self-hosted minisign) [OWNER-gated release channel].**
- Scope: `bundle.createUpdaterArtifacts:true`; generate the **minisign** keypair (`tauri signer generate`),
  pubkey in `tauri.conf.json`, **private key → Server-Setups vault** (losing it = no future updates);
  static-JSON `latest.json` manifest on **our own domain** (D-2, no store); a small script to populate the
  manifest `signature` from each `.sig`; HTTPS release host.
- Depends-on: Chunk 6; **an owner-authorized release host/domain** (HARD HOLD).
- Reuse: R7 §3 verbatim. Net-new: the release-manifest script + host wiring. Done: an installed client
  detects + verifies (minisign) + applies an update from our endpoint. Confirm R7 §5 unverified items
  (macOS `.app.tar.gz` re-notarization, Linux AppImage in-place replace) during this chunk.

---

## 6. Risks & unknowns

- **`nextcloudcmd` redistributable footprint** (Qt + OpenSSL) on Win/macOS is unmeasured (R8 §5.3) — could
  bloat the ~17 MB Tauri promise. Measure before Chunk 3 locks.
- **Journal-corruption under concurrent runs** — the per-folder mutex is derived from csync behaviour, not
  stress-tested (R8 §5.4). Validate under rapid fs bursts in Chunk 4.
- **Per-project scaling** — N project folders = N `nextcloudcmd` invocations; cost on a modest box unmeasured
  (R8 §5.5).
- **macOS notarization needs a PAID Apple Developer account** — a free account cannot notarize (R7 §1.1).
- **Losing the minisign private key = permanently unable to update installed clients** (R7 §3.4). Vault
  discipline is load-bearing.
- **Rust LOC creep past ~300** would breach D-11's contract → a revisit-Tauri signal, not a silent expansion.
- **R7 §5 unverified items** (notarytool transport, `skipStapling` key casing, updater in-place semantics,
  updater capability wiring) — each must be confirmed at its chunk, not assumed.
- **Windows/macOS artifacts cannot be built or verified on this WSL2 box** — Chunks 6–7 need real toolchains
  + a signing CI; the wave can only fully complete on that infra.

## 7. OPEN `[WHAT]` questions (deferred — for PENDING_DECISIONS.md at greenlight, do NOT answer now)

These are **not blocking** and must **not** be invented. When the owner greenlights the track, they move into
`PENDING_DECISIONS.md` and are answered before the dependent chunk:
- **Q1 · Timing / greenlight** — when does the desktop track start? (D-3 says post-v1; the trigger is owner's.)
  → answered 2026-09-27 (D-30): stays **DEFERRED (post-v1)**. On-device mobile verification, the Pangolin
  throughput test, geofence-over-tunnel, the security audit and the sync-engine resource check come first.
- **Q2 · UI reuse posture** — reuse `apps/web` inside the WebView (recommended, §2.1) vs a dedicated
  `apps/desktop` SPA on `@orqafy/ui`? Gates Chunk 1.
  → answered 2026-09-27 (D-30): **reuse `apps/web` inside the Tauri WebView**; no separate SPA.
- **Q3 · Auth model** — reuse the mobile **bearer-token** path, or Auth.js **cookies same-origin** (if the
  web app is embedded)? Gates Chunk 2.
  → answered 2026-09-27 (D-30): **Auth.js cookie session, same origin**; the embedded web app keeps its
  normal session. A scoped token is added ONLY if native Rust code must call the Orqafy API directly; the
  Nextcloud sidecar authenticates separately.
- **Q4 · Sync engine final confirmation** — D-14 keeps `nextcloudcmd`; confirm it survives the BLOCKED
  sync-engine resource-cost check (§8) before Chunk 3 locks. If it fails, escalate to D-10a option (b)
  (WebDAV-in-client) — an owner-gated engine build, not this wave.
- **Q5 · Code-signing certificates** — Apple Developer Program membership (paid, for notarization), a
  Windows Authenticode cert (OV vs EV; SignTool vs Azure Trusted Signing), Linux GPG key? Gates Chunk 6.
- **Q6 · Auto-update release channel** — which domain/host serves installers + `latest.json`, and when is a
  distribution channel authorized (HARD HOLD)? Gates Chunk 7.
- **Q7 · `notify_push` fast-follow** — wire the sidecar to Nextcloud's `notify_push` for near-instant
  remote-change latency (R8 §3.1)? Post-Chunk-4, unverified feasibility.

Q4–Q7 stay **parked** (hardware / certs / release host) — not answered by D-30 (2026-09-27).

## 8. Prerequisites / blocked-on

The wave cannot fully proceed until these clear. The first two are **existing BLOCKED tasks** in
`docs/TASK_QUEUE.md` (not re-created here — referenced):
- **[BLOCKED-post-scaffold] Sync-engine resource-cost check** (TASK_QUEUE) — measure idle + sync-load
  RAM/CPU on a desktop-as-server box already running Postgres+Valkey+MinIO **before the engine choice is
  locked**. Gates Q4 / Chunk 3–4.
- **[BLOCKED-infra] Pangolin throughput test** (TASK_QUEUE, BLOCKING before any customer install) — Newt
  ≥1.16.0 + `USE_NATIVE_MAIN_INTERFACE=true` + host networking; historically ~1–6 MB/s single-stream. The
  **no-delta-sync** cost of Nextcloud (D-10) makes tunnel throughput load-bearing for remote sync. Gates
  remote-access sync UX (not LAN-first Chunk 4).
- **`nextcloudcmd --help` on the actually-bundled binary** (R8 §5.1) — confirm no hidden loop/daemon flag +
  the real option surface before Chunk 3.
- **`nextcloudcmd` redistributable binary + deps sourced** per target triple (Win/macOS/Linux) — before Chunk 3.
- **Signing certs + a signing-capable CI runner** (Q5) — before Chunk 6.
- **An owner-authorized release host/domain** (Q6, HARD HOLD) — before Chunk 7.

## 9. Gaps in the existing research (flagged, not filled)

What R7/R8/DESIGN do **not** cover and this wave must resolve when it runs:
- **Desktop offline-first write behaviour is unspecced.** DESIGN §8 details offline-first for *mobile* (cache
  + outbound queue + reconnect conflict handling); there is **no equivalent spec for the desktop client's
  tRPC writes made offline**. R7/R8 cover only file *sync*, not app-data offline. → new spec at Chunk 5.
- **UI reuse mechanism is undecided** (§2.1 / Q2) — no research picks WebView-embeds-web vs dedicated SPA.
- **First-run server-connection + folder-selection UX** has no design (mockup covers the web dashboard only).
- **Multi-project folder mapping** — how projects map to synced local folders / Nextcloud Team folders on the
  *desktop* is unspecced (R8 assumes "one invocation per project folder" but not the UX/config model).
- **Desktop auth-token lifecycle** (refresh/expiry/revocation on the desktop) is not covered — mobile's
  bearer work (chunk-3a) is reusable but its desktop lifecycle (long-lived vs refresh) is unaddressed.
- **`notify_push` independent-subscriber feasibility** stays unverified (R8 §5.2) — a known open, not new.

---

## Log
- 2026-09-26: Plan written (groundwork). Grounded in R7 (packaging/signing/updater/sidecar), R8 (sync
  cadence — `nextcloudcmd` one-shot confirmed), DESIGN §8/§9, and the **already-existing `@orqafy/sync`
  port** (provider + drivers + factory; spawn/loop stubbed as `TODO(part-7)` = this wave). D-3/D-7/D-8/D-11/
  D-14/D-15 quoted verbatim; no decision re-opened. Desktop track remains DEFERRED — HARD HOLD, not started.
