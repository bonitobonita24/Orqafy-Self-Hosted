# Task Queue — Orqafy-Self-Hosted

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.

## 🔴 / 🟡 Open

- 🔴 **Run the Planning Assistant interview** — load `Powerbyte-AIEF/specdrivenprompt/Planning_Assistant.md`
  in a session opened in this folder; seed it with `docs/SEED_BRIEF.md` so settled items aren't re-asked.
  Done: `docs/PRODUCT.md` exists with all 12 sections, owner-approved. `<source: owner 2026-09-06>`
- 🔴 **Real-device geofence-over-tunnel test** (iOS + Android) before Phase 3 — R-1 found **no source**
  proving a VPN blocks geofence *triggering*; the open risk is notification *delivery* within the OS wake
  budget over an idle WireGuard tunnel. Decides whether the reverse-tunnel choice (Pangolin `newt`) is
  merely preferred or actually required. Done: measured trigger→delivery latency on both platforms,
  recorded in `docs/planning/R1_REMOTE_ACCESS.md`. `<source: agent-found 2026-09-06>`
- 🔴 **Nextcloud resource-cost sanity check** — R-3 picks Nextcloud over Syncthing, but it is far heavier
  and D-3 puts it on a desktop-as-server box already running Postgres + Valkey + MinIO (+ tunnel agent).
  Measure idle and sync-load RAM/CPU before the choice is locked. Done: figures recorded in
  `docs/planning/R3_FILE_SYNC.md`. `<source: agent-found 2026-09-06>`
- 🔴 **Verify Expo background-geofencing capability via context7** before Phase 3 — confirm current
  `expo-location`/`expo-task-manager` background geofence support + iOS permission requirements.
  Done: findings recorded in the PRODUCT.md mobile section. `<source: agent-found 2026-09-06>`
- 🔴 **Public-repo asset guard** — `.gitignore` + a pre-push check asserting no framework files
  (`.ai_prompt/`, `AI/`) and no AdminCN slice (`starter/admincn/`) can be committed. Done: a test commit
  containing those paths is refused. `<source: agent-found 2026-09-06>`
- 🔴 **DESIGN.md + MOCKUP.jsx** — after PRODUCT.md; Kaneo as visual reference, shadcn/ui, fleet default
  typeface IBM Plex Sans + JetBrains Mono. Done: mockup rendered and owner-approved. `<source: owner 2026-09-06>`

## ✅ Done recently

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
