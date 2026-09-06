# Task Queue — Orqafy-Self-Hosted

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.

## 🔴 / 🟡 Open

- 🔴 **Run the Planning Assistant interview** — load `Powerbyte-AIEF/specdrivenprompt/Planning_Assistant.md`
  in a session opened in this folder; seed it with `docs/SEED_BRIEF.md` so settled items aren't re-asked.
  Done: `docs/PRODUCT.md` exists with all 12 sections, owner-approved. `<source: owner 2026-09-06>`
- 🔴 **R-1 remote-access overlay survey** — Headscale · NetBird · Netmaker · Nebula · Pangolin, evaluated
  on self-hostable control plane, licence, NAT traversal, mobile clients, non-technical setup, Traefik +
  real-domain fit. Done: `docs/planning/R1_REMOTE_ACCESS.md` with a recommendation. `<source: owner 2026-09-06>`
- 🔴 **R-2 NAS storage access (UGREEN NASync DH2300)** — which protocols the model actually exposes
  (SMB/NFS/WebDAV, Docker on UGOS Pro?), and how assets are written to it behind our storage abstraction
  with a local-disk fallback. Done: `docs/planning/R2_NAS_STORAGE.md`. `<source: owner 2026-09-06>`
- 🔴 **R-3 file-sync engine** — Syncthing vs alternatives; how a per-user desktop agent maps to
  project-scoped shortcuts + revisioning. Done: `docs/planning/R3_FILE_SYNC.md`. `<source: owner 2026-09-06>`
- 🔴 **R-4 Kaneo teardown** — schema + UI structure read for domain ideas and interaction patterns worth
  carrying (MIT; attribution required if code is lifted). Done: `docs/planning/R4_KANEO_TEARDOWN.md`.
  `<source: owner 2026-09-06>`
- 🔴 **Verify Expo background-geofencing capability via context7** before Phase 3 — confirm current
  `expo-location`/`expo-task-manager` background geofence support + iOS permission requirements.
  Done: findings recorded in the PRODUCT.md mobile section. `<source: agent-found 2026-09-06>`
- 🔴 **Public-repo asset guard** — `.gitignore` + a pre-push check asserting no framework files
  (`.ai_prompt/`, `AI/`) and no AdminCN slice (`starter/admincn/`) can be committed. Done: a test commit
  containing those paths is refused. `<source: agent-found 2026-09-06>`
- 🔴 **DESIGN.md + MOCKUP.jsx** — after PRODUCT.md; Kaneo as visual reference, shadcn/ui, fleet default
  typeface IBM Plex Sans + JetBrains Mono. Done: mockup rendered and owner-approved. `<source: owner 2026-09-06>`

## ✅ Done recently

- ✅ **Project seeded** — folder created, git initialised, seed brief + decisions + backlog written
  (2026-09-06).
