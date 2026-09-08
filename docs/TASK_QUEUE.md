# Task Queue — Orqafy-Self-Hosted

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.

## 🔴 / 🟡 Open


- 🔴 **Real-device geofence-over-tunnel test** (iOS + Android) before Phase 3 — R-1 found **no source**
  proving a VPN blocks geofence *triggering*; the open risk is notification *delivery* within the OS wake
  budget over an idle WireGuard tunnel. Decides whether the reverse-tunnel choice (Pangolin `newt`) is
  merely preferred or actually required. Done: measured trigger→delivery latency on both platforms,
  recorded in `docs/planning/R1_REMOTE_ACCESS.md`. `<source: agent-found 2026-09-06>`


- 🔴 **Sync-engine resource-cost check** — whichever engine wins, measure idle and sync-load RAM/CPU on
  a desktop-as-server box already running Postgres + Valkey + MinIO before the choice is locked.
  Done: figures recorded in the winning engine's decision doc. `<source: agent-found 2026-09-06>`
- 🔴 **Pangolin throughput test — BLOCKING before any customer install** — Newt/Gerbil has
  maintainer-acknowledged sequential-packet processing: historically ~1–6 MB/s single-stream, reaching
  ~180 Mbit/s only with **Newt ≥1.16.0 + `USE_NATIVE_MAIN_INTERFACE=true` + host networking**. Those
  settings are mandatory in our bundle. Done: measured real throughput for a large photo upload over
  the tunnel, recorded in `docs/planning/R1a_PANGOLIN_SIZING.md`. `<source: agent-found 2026-09-06>`
- 🔴 **Verify headless Nextcloud continuous-sync approach (D-14 caveat)** — the headless/CLI client is
  understood to be one-shot, not a daemon. Confirm how continuous background sync is driven (scheduler,
  fs-watch, or a supervising loop) from the Tauri Rust sidecar. Done: a working continuous-sync PoC, or
  a documented switch to the WebDAV-in-our-client fallback. `<source: agent-found 2026-09-06>`
- 🔴 **Offline-first mobile design (D-15)** — cached task list, LOCAL geofence evaluation with no server
  contact, outbound queue for photo uploads + task updates, conflict handling on reconnect. A v1 design
  commitment, not a later retrofit. Done: reflected in PRODUCT.md mobile section + DESIGN.md.
  `<source: agent-found 2026-09-06>`
- 🔴 **Desktop packaging workstream** — Tauri chosen (D-11). Remaining: code signing + notarisation +
  auto-update per platform, and documenting the Rust sidecar-supervision surface as the sole
  non-TypeScript code. Done: recorded in DESIGN.md. `<source: agent-found 2026-09-06>`
- 🔴 **Verify Expo background-geofencing capability via context7** before Phase 3 — confirm current
  `expo-location`/`expo-task-manager` background geofence support + iOS permission requirements.
  Done: findings recorded in the PRODUCT.md mobile section. `<source: agent-found 2026-09-06>`
- 🟡 **MOCKUP.jsx** — IN FLIGHT (design worker). Clickable shadcn-styled mockup, realistic PH
  construction data, all declared screens. Done: rendered and owner-approved. `<source: owner 2026-09-06>`

## ✅ Done recently

- ✅ **Public-repo asset guard** — `scripts/check-public-assets.sh` (`--staged`/`--tracked`) +
  `scripts/install-git-hooks.sh` wiring pre-commit/pre-push. Refuses `.ai_prompt/`, `AI/`,
  `starter/admincn/`, `.claude/`, `CLAUDE.md`. Verified: a force-added `.ai_prompt/` commit was refused.
  README contributor note added. (`chore/asset-guard`, 2026-09-08).
- ✅ **README stage refreshed** — corrected "pre-spec / interview not yet run" → "spec approved ·
  pre-scaffold" (`docs/readme-status-refresh`, 2026-09-08).
- ✅ **PRODUCT.md owner-approved** (2026-09-06).
- ✅ **DESIGN.md** → `docs/DESIGN.md`. Tokens (slate base + blueprint-blue primary + geofence-amber
  accent), IBM Plex Sans + JetBrains Mono, component conventions, the geofence assertive treatment, and
  the per-page Mobile First/Ready table (2026-09-06).

- ✅ **Planning Assistant interview** → `docs/PRODUCT.md` written (12 required sections + conditional +
  Design Identity + Out of Scope). Interview produced D-17…D-23. Feature-boundary [WHAT] resolved.
  **Awaiting owner approval before Phase 2.8 mockup / DESIGN.md** (2026-09-06).

- ✅ **R-3b file-sync re-comparison** → `docs/planning/R3b_FILE_SYNC_REVISED.md`. Corrected R-3's wrong
  claim that Syncthing has no access-control boundary (it does — server-side, `lib/model/model.go:1982`).
  Owner's hard per-user read-only requirement decided it: **Nextcloud** (D-10), since Syncthing has no
  per-device read-only. Own-build priced honestly at 4–7 months (2026-09-06).
- ✅ **R-5 document-AI feasibility** → `docs/planning/R5_DOCUMENT_AI.md`. **Qualified yes** — free,
  CPU-only, licence-clean, TypeScript-only, but DB-matching-first; LLM-first is not feasible on this
  hardware. L0+L2 carry ~55–80% with no LLM. Licence blockers found: Surya weights (OpenRAIL-M revenue
  cap), Gemma (gated + use restrictions), Llama (non-free terms). Clean lane: RapidOCR/Tesseract +
  Ollama + Qwen3-4B/Phi-4-mini. Thin slice 3–4 weeks, full v1 3–3.5 months (2026-09-06).

- ✅ **R-1 remote-access overlay survey** → `docs/planning/R1_REMOTE_ACCESS.md`. Pangolin CE (AGPL-3.0)
  reverse tunnel primary, plain Traefik + port-forward fallback. Cloudflare Tunnel disqualified on ToS
  (self-hosted large-file/video restrictions); Netmaker ruled out (paid CGNAT relay + `pro/` licence
  claims modification ownership) (2026-09-06).
- ✅ **R-2 NAS storage access (DH2300)** → `docs/planning/R2_NAS_STORAGE.md`. **No Docker, no S3 on this
  model** (verified per-model). MinIO runs on the Linux host over an NFS mount of a Btrfs RAID-1 share;
  no-NAS fallback is the identical code path on local disk (2026-09-06).
- ✅ **R-3 file-sync engine** → `docs/planning/R3_FILE_SYNC.md`. **Nextcloud** (Team folder per project),
  Seafile CE fallback; **Syncthing rejected** — no user model, would force us to hand-write the whole
  server-authoritative access-control layer. Overturns the seed brief's Syncthing prior (2026-09-06).
- ✅ **R-4 Kaneo teardown** → `docs/planning/R4_KANEO_TEARDOWN.md`. Verdict: shortens ~10% of the build
  (~600–900 liftable lines + ~2 weeks of UI/UX and schema decisions), **0% of what makes the product ours**
  — geofencing, clients, revisions, evidence photos, inventory are all net-new (2026-09-06).
- ✅ **Project seeded** — folder created, git initialised, seed brief + decisions + backlog written
  (2026-09-06).
