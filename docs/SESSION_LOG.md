# Session Log — Orqafy-Self-Hosted

Human-readable accomplishment report, one section per working session, **newest on top**.

**Legend:** ✅ done & verified · 🔨 partial / in progress · ⏳ not yet / next · 💬 decision / note · ⛔ blocked

## 2026-09-09 — Document upload & management

**In your words:** (autonomous loop) keep building the remaining web scope — next up was document upload/management.

✅ **Done**
- Built **document upload and management** on the Files page — the last of the core web forms.
  - **Upload** a file with its filing details (name, category, project/client, and a "sensitive/finance-restricted"
    flag). Files stream through the app to storage (MinIO), so it works the same whether storage is MinIO, S3, or a
    local folder.
  - **Download**, **edit the details**, and **delete** each document from its row. Sensitive documents show a
    "Restricted" badge and only finance-permitted users can download them.
  - Every upload automatically queues the document for the future OCR/auto-filing step (the queue is wired; the
    actual OCR/matching is a later piece).
- Verified it for real in the running app (not just a build): uploaded a PDF → confirmed the file physically
  landed in storage and the record saved → downloaded it back → edited its details → deleted it (file and record
  both removed). All clean.

💬 **Notes**
- While testing I caught and fixed a subtle bug that would have **silently unset a document's project** when you
  edited its details — the project dropdown wasn't pre-selecting the saved value. Fixed and re-verified. Recorded
  as a reusable lesson so it can't recur elsewhere.
- Committed locally on `feat/web-document-management` (`206c66d`). Nothing pushed (HARD HOLD).
- A harmless build warning remains (an optional storage-queue driver we don't use) — logged as a tidy-up.
- The start-of-session RBAC-retrofit suggestion was declined again — it doesn't apply here (single-company, D-5).

⏳ **Next**
- Remaining web polish: the map picker for task locations, live drag-drop on the kanban board, realtime updates,
  and self-hosted fonts. Then the document OCR/auto-filing processors, then the mobile + desktop apps as their
  own waves.

## 2026-09-09 — Permission-builder editor UI (D-17)

**In your words:** (autonomous loop) keep building the remaining web scope — next up was the permission-builder editor.

✅ **Done**
- Built the **permission-builder editor UI** — the piece that was still missing after Users/roles landed.
  - A **Permission groups** page (`/settings/roles`): make your own custom permission groups, edit which
    permissions each group grants, and delete custom ones. The 5 built-in roles can have their permissions
    tuned but their names are locked and they can't be deleted.
  - A **per-user Permissions** panel on each user row: override any of the 10 permissions on top of what their
    role/groups already give — leave it inherited, force-grant, or force-revoke.
- Verified it for real in the running app (not just a build): created a group, edited a built-in role,
  set a per-user override and confirmed it stuck after a page reload, then cleaned up. All green.

💬 **Notes**
- The backend for this already existed — this was front-end only. One new small building block (a checkbox)
  was added to the shared UI kit; no other library added.
- Committed locally on `feat/web-permission-builder` (`701d6b4`). Nothing pushed (HARD HOLD).
- The start-of-session RBAC-retrofit suggestion was declined again — it doesn't apply here (single-company
  install, D-5).

⏳ **Next**
- Document upload/management (wire the file storage + a document details form), then the map picker, live
  kanban drag-drop, realtime, and self-hosted fonts. Then the mobile + desktop apps as their own waves.

## 2026-09-09 — Resume + checkpoint (no code change)

**In your words:** save session first, make a complete handoff.

✅ **Done**
- Reconstructed where we left off and verified it against the live repo (clean tree, branch
  `feat/web-mgmt-forms`, 0 open decisions).
- Corrected stale "current tip" pointers in the handoff + memory, and wrote the complete handoff.

💬 **Notes** — The SessionStart prompt keeps offering a multi-tenant RBAC retrofit; it does **not** apply
here (D-5: this is a single-company install, no tenant model). Declined again. HARD HOLD held — nothing pushed.

⏳ **Next** — permission-builder editor UI (D-17: custom groups + per-user overrides; the API already
exists). Then: document upload/management, Leaflet map picker, kanban drag-drop, websocket transport,
self-hosted fonts. Expo mobile + Tauri desktop are later waves.

⛔ **Blocked / deferred** — 3 hardware/stack/tunnel verification tasks; POST-V1 cloud-storage add-on.

## 2026-09-08 — Web core v1 COMPLETE (full auto): app builds, runs, documented

**In your words:** kick off Phase 4 Part 1 and run in full auto mode.

✅ **Done & verified** (each: Opus worker → PM-verified typecheck/lint/build + AGPL boundary → committed local)
- **Web core v1 built + runtime-verified + documented.** `apps/web` (Next.js + tRPC + Auth.js v5, plain
  shadcn/Kibo) on 8 `@orqafy/*` packages + a dev Docker Compose bundle. Real browser flow passes end-to-end:
  first-run `/setup` → login → dashboard (KPIs) → **create + edit Client / Project / Task via form UIs** →
  persisted (Playwright + DB). Screenshots delivered.
- **Fixed 2 real bugs surfaced by verifying** (not static gates): the first-run `/api/trpc` middleware
  redirect (blocked setup), and the dashboard-500 — which turned out to be a PgBouncer prepared-statement
  issue (pooled URL missing `?pgbouncer=true`), one root cause fixed cleanly.
- **Public-repo deliverables:** AGPL-3.0 `LICENSE`, honest `README` + self-host quickstart, CI
  (lint/typecheck/test/build, **no** publish).

💬 **Decisions / notes** — HARD HOLD held throughout (nothing pushed/deployed); framework IP never entered the
public AGPL repo (boundary independently verified after every step). Two global lessons logged.

⏳ **Next** — remaining web scope (other entity forms · permission-builder UI · document upload/OCR · Leaflet
map picker · kanban drag-drop · websocket transport · self-hosted fonts), then Expo mobile + Tauri desktop as
later waves.

⛔ **Blocked / deferred** — 3 hardware/stack/tunnel tasks; POST-V1 cloud-storage add-on.

## 2026-09-08 — Phase 4 Part 7: dev Docker Compose bundle + live runtime verification

**In your words:** build the dev Compose bundle (Part 7), then actually run it and prove the web app works
end-to-end — first-run setup → login → dashboard → create a Client/Project/Task that persist — with real
screenshot evidence, not assertions.

✅ **Done & verified**
- **Dev Compose bundle built** (`deploy/compose/dev/`): postgres+pgbouncer, valkey, minio (+console+bucket
  init), mailhog, pgadmin (pre-wired `servers.json`), app, worker. `start.sh` orchestrator + `tools/dev-smoke.sh`.
  Rule-22 ports (base 56473), named volumes `orqafy_dev_*`, NO `docker-publish.yml` (D-3/D-27). `docker
  compose config` valid; added a real `@orqafy/jobs` worker entrypoint (`src/main.ts`) so the worker boots.
- **Live runtime verified**: brought up the infra tier, applied the Part-3 migration (`prisma migrate
  deploy` → 16 entity tables present), booted the web app. Playwright (headless, closed when done) drove the
  real D-5 flow: first-run created the operator's admin (Owner/Admin role + org + 5 system roles seeded),
  auto-login, dashboard loaded, then Client→Project→Task created and confirmed persisted via a Projects-list
  reload AND a DB join. Screenshots in `screenshots/` (01 setup · 02 dashboard · 03 projects-persisted).
  Stack torn down cleanly, volumes kept.

💬 **Decisions / notes**
- **Found + fixed a blocking Part-5 bug** ([HOW]): the edge middleware matched `/api/trpc` but did not
  allow it, so unauthenticated tRPC calls (incl. the public first-run `setup.*` procedures) were 307→`/login`
  — first-run could never reach the DB. Fix: treat `/api/trpc` as public at the edge; tRPC's per-procedure
  auth stays the real boundary. Committed `fix(web)`; lesson logged (`nextjs.middleware.matcher-gates-api-trpc`).
- **Agent-found UX gap (open, deferred):** `/` on a fresh install redirects to `/login` not `/setup` (see
  TASK_QUEUE) — the middleware runs before the root's first-run redirect. Logged, not fixed (out of scope).
- **No create UI yet in Part 5** — Client/Project/Task were created via authenticated tRPC calls (real
  server + Prisma), persistence proven by UI reload + DB. Build the create forms in a later UI pass.
- Branch `feat/phase4-part7`, local only, HARD HOLD — nothing pushed/deployed.

## 2026-09-08 — Phase 0 scaffolded + UI baseline + commercial model

**In your words:** clear the pending work; then you asked about adopting shadcn-admin-kit for the UI, told
me you hold a shadcn/studio licence, and set the commercial model — a paid cloud-storage add-on priced off
R2-or-S3, whichever's cheaper, with a nice margin over the VPS.

✅ **Done & verified**
- **Phase 0 scaffold COMPLETE + independently verified.** Non-destructive bootstrap: monorepo shaped
  (inputs.yml, package.json pnpm@10/Node22, schema, dev env/ports), framework seeded LOCAL-ONLY. AGPL
  boundary proven clean — no framework IP tracked, asset guard extended (19/19 fixtures blocked), all
  boundary paths ignored. Branch `chore/phase0-scaffold`, 6 commits, HARD HOLD unpushed.
- **R2 vs S3 pricing study** (context7/web, cited) → R2 wins ~2.5–13× (egress-heavy; R2 $0 egress).
  Analysis in `docs/planning/R9_CLOUD_STORAGE_PRICING.md`.

💬 **Decisions**
- **D-26** — Web UI = **plain shadcn/ui + Kibo** (Next.js-native). Evaluated marmelab/shadcn-admin-kit
  (MIT ✅ but a react-admin SPA → rejected on stack-fit, not licence) and AdminCN (you're licensed, but you
  chose the zero-paid-slice public-repo story).
- **D-27** — Commercial model: optional **cloud-storage add-on on Cloudflare R2**; tiers ratified
  $3/$6/$12/$19/$35/$60 (25GB→2TB), margins 49–93%; billing on the hosted control plane, not the OSS app;
  **post-v1**.

⏳ **Next**
- **Phase 4 Part 1** build (root config) → B2…B8 per the scaffold plan. Plan-first-dispatch each Part.

⛔ **Blocked / deferred** — 3 tasks need hardware/running-stack/live-tunnel; cloud-storage add-on is post-v1.

## 2026-09-08 — Mockup approved; pre-scaffold research cleared

**In your words:** you confirmed you hadn't actually seen the mockup, so I put it in front of you and
you approved it — then asked me to clear all pending Squirlnote tasks, analyzing/planning each first and
using the right skills for the job.

✅ **Done & verified**
- Put the dashboard mockup in front of you; **you approved it** → design gate cleared, Phase 0 unblocked.
- Reconciled a **stale Squirlnote board**: its 3 "Pending" tasks were all already done/resolved → moved to
  For Review; mirrored the *real* backlog (`docs/TASK_QUEUE.md`) onto the board (4 actionable, 3 blocked).
- Completed the **4 actionable pre-scaffold research tasks** (parallel Opus agents, context7-grounded):
  Expo geofencing verified (R6), offline-first mobile design (D-15), Tauri packaging (R7), Nextcloud
  continuous-sync resolved (R8, D-14). Integrated into PRODUCT.md + DESIGN.md §8–9; committed
  (`docs/research-integration` @ 87c93ab, HARD HOLD local).

💬 **Decisions / notes**
- **D-24** logged (mockup approved + research resolved). **D-14 resolved** (nextcloudcmd one-shot →
  supervise from Rust sidecar).
- Self-caught + reverted a mislabel: Squirlnote `add_label` by display-id `ORQ-N` hit the **commercial
  Orqafy** board (shared `ORQ` prefix); fixed via raw IDs + logged the global lesson.

⛔ **Blocked (later phase, not Phase 0)**
- Real-device geofence-over-tunnel test, sync-engine resource cost, Pangolin throughput — need real
  hardware / a running stack / a live tunnel.

⏳ **Next**
- **Phase 0 scaffold** (owner chose research-first → then scaffold): AIEF stack, Compose-first, AGPL
  public repo. Plan to be presented + confirmed before executing.

## 2026-09-08 — Asset guard enforced + README stage fixed (loop iteration)

**In your words:** loop wake — the handoff was empty, so don't idle: re-derive state, work the
highest-priority un-gated task, and leave a proper handoff.

✅ **Done & verified** — Reconciled state vs live git (clean, 0 open `[WHAT]`). Built the **public-repo
asset guard** enforcement: `scripts/check-public-assets.sh` + `scripts/install-git-hooks.sh` (pre-commit
+ pre-push) refuse `.ai_prompt/`, `AI/`, `starter/admincn/`, `.claude/`, `CLAUDE.md`. Verified by a
force-added `.ai_prompt/` commit being **refused**. Corrected the README stage ("pre-spec" → "spec
approved · pre-scaffold"). Two commits, local only (HARD HOLD).

⏳ **Next** — Your **mockup confirm** is still the gate before Phase 0 scaffold. Remaining 🔴s in
`docs/TASK_QUEUE.md` are phase-deferred verification (devices / running stack / near-phase).

💬 **Notes** — `.gitignore` already listed the forbidden paths; that only blocks `git add .`, so this
added the active guard the task's done-criterion required. RBAC retrofit stays declined (D-5).

## 2026-09-08 — Resume + mockup delivered for confirm; save & stop loop

**In your words:** resume the session; you chose to confirm the mockup; then save the session and stop
the reboot loop.

✅ **Done & verified** — Resumed and reconciled state against live git (clean tree, 0 open `[WHAT]`).
Rendered Dashboard mockup (`mockup-dashboard.png`) delivered to you via file card. Handoff + memory
updated; loop stopped.

⏳ **Next** — Your explicit **mockup confirm** is the gate before Phase 0. Then: public-repo asset guard
→ Phase 0 scaffold. Verification tasks still queued in `docs/TASK_QUEUE.md`.

💬 **Notes** — Only the Dashboard is captured as a PNG; the other 8 screens live in `MOCKUP.jsx` (say
the word to render them). Declined the SessionStart RBAC-retrofit suggestion — **superseded by D-5**
(single-company install, no tenant model; fleet 3-tier RBAC doesn't apply here).

## 2026-09-06 — Resume session: two decisions locked, R-1…R-4 research delivered

**In your words:** resume the session — then, of the two decidable open questions and the research
backlog, you chose single-company tenancy, sideload-only mobile, and running R-1…R-4 in parallel.

✅ **Done & verified**
- **D-5 locked — single-company install.** No tenant model, no `tenant_id`. Two consequences recorded
  because they are places a fleet standard would otherwise apply by default and must not: the 3-tier
  tenant-RBAC standard does not govern this app, and the **universal login credentials must never be
  seeded here** — it is a public AGPL product installed by third parties, so first-run setup creates
  the operator's own admin account.
- **D-6 locked — sideload / self-build mobile only.** No store listing under Powerbyte, so the
  background-location justification stays unconstrained by store review. Android APK is the primary
  surface; **iOS needs TestFlight or the user's own Apple developer account** — recorded as a stated
  README limitation rather than glossed as parity.
- **`docs/DECISIONS_LOG.md` created** — referenced since founding but never actually written.
- **All four research docs delivered** to `docs/planning/`, each with cited sources and an explicit
  unverified section.
- Branch drift fixed: `master` → `main` (docs and memory both already assumed `main`).

🔨 **Research findings — three of the four changed something**
- **R-2 (NAS):** the DH2300 runs **no Docker and exposes no S3** — verified per-model, not inferred
  from the higher-tier DXP units. MinIO therefore runs on the Linux host over an NFS mount of a Btrfs
  RAID-1 share; the no-NAS fallback is the *identical* code path on local disk, so the storage choice
  never leaks into application code.
- **R-1 (remote access):** Pangolin CE reverse tunnel primary — it keeps any VPN **off the field
  phones**, so geofencing never depends on a sleeping tunnel. **Cloudflare Tunnel disqualified** by its
  late-2025 ToS restrictions on self-hosted large files and video — a live trap for a file-and-photo
  product. Netmaker ruled out (paid CGNAT relay; `pro/` licence claims ownership of your changes).
- **R-3 (file sync):** **overturns the seed brief's Syncthing prior.** Syncthing has no user model, so
  our server-authoritative per-user project scoping would be entirely hand-written — the "don't build a
  sync engine" rule violated through the back door. Nextcloud recommended, Seafile CE fallback.
- **R-4 (Kaneo):** honest verdict — shortens roughly **10%** of the build (~600–900 liftable lines plus
  ~2 weeks of UI/UX and schema decisions) and **0% of what makes the product ours**.

💬 **Decisions / notes**
- Open `[WHAT]`s went 3 → 1, then back to **3** — the research surfaced two new owner-level questions
  rather than settling them unilaterally: **accept Nextcloud over Syncthing** (it contradicts the
  founding brief, so it is your call, not a research doc's), and **is a small VPS an acceptable
  requirement** for remote access given the "runs on your own desktop" pitch.
- Two agent-found risks queued rather than assumed away: **geofence delivery over an idle tunnel** is
  unproven either way and needs a real-device test, and **Nextcloud's resource cost** on a box already
  running Postgres + Valkey + MinIO needs measuring before it is locked.

⏳ **Next**
- Resolve the open `[WHAT]`s, then the Planning Assistant interview → `docs/PRODUCT.md`.
- Un-gated and unblocked: the public-repo asset guard (pre-commit hook).

### 2026-09-06/07 — PRODUCT.md approved, DESIGN.md + mockup built, session saved

**In your words:** approve; then "save session, stop reboot loop."

✅ **Done & verified**
- **PRODUCT.md approved** and stamped.
- **DESIGN.md** written — token set (slate + blueprint-blue + geofence-amber), IBM Plex Sans / JetBrains
  Mono, component conventions, the one assertive geofence treatment, per-page Mobile First/Ready table.
- **MOCKUP.jsx** built (design worker) — 9 screens, realistic Calapan/Oriental Mindoro data; rendered
  in a headless browser with no runtime errors; a clickable preview was sent to you for review.

💬 **Notes**
- Design worker invented specific firm/staff/coordinate literals (docs specify style, not names) — fine
  for a mockup; real values come at build time.
- Mockup is ephemeral visual-verification; nothing is built off it.

⏳ **Next (loop stopped at your request):** your mockup confirmation → public-repo asset guard → Phase 0
scaffold. Full ordered TODO in `.sessions/slot-14/next-session`.

⛔ **Hold:** local only, no remote, pre-scaffold. Loop stopped 2026-09-07 (owner-rest, not completion).

### Later the same day — Planning Assistant interview → PRODUCT.md written

**In your words:** run the Planning Assistant interview. Along the way you added leave management
(staff apply for leave), a schedule/start-date for geofenced alerts, and asked the design be simple,
user-friendly and modern.

✅ **`docs/PRODUCT.md` written** — the full spec, seeded so you were only asked what was genuinely open.
All product decisions resolved; open `[WHAT]`s are now zero.

💬 **What the interview settled (D-17…D-23)**
- **Roles/RBAC** — architect + engineer share one PM role; predefined roles + **custom groups +
  per-user overrides** (finance visibility is a permission, not a role). A permission builder is a v1
  item.
- **Client portal** — v2, read-only + milestone sign-off.
- **Geofence** — 3-min dwell, re-alert every re-entry, grouped "N things here", assigned worker only,
  **plus a start-date schedule** so it only arms when relevant. On-device, offline, presence-only.
- **Data/DPA** — payroll docs kept as **SPI**; **retention + export/delete + access audit log in v1**;
  no worker tracking. Installing firm is the data controller; we ship the mechanisms.
- **Leave management** — **v1**, leave-only, `approve_leave` permission. (Narrowly reopens the brief's
  "HR out of scope".)
- **Realtime web / offline mobile · Leaflet maps · dashboard · mobile push** = foreground+on-device in
  v1, background push v1.x (no Google/Apple dependency).
- **Design** — simple, uncluttered, modern; Kaneo reference; shadcn/ui + Kibo UI; IBM Plex Sans +
  JetBrains Mono.

⏳ **Next:** your approval of `docs/PRODUCT.md`, then Phase 2.8 mockup + `docs/DESIGN.md`. Nothing
scaffolds until you approve.

### Later the same day — v1 scope resolved (four decisions)

**In your words:** "yes, do your suggestion" — settle the decidable open questions before the interview.

✅ **Four decisions locked, open [WHAT]s down to one**
- **D-13** document AI → **thin slice in v1** (~3–4 wks, no LLM), full version later.
- **D-14** desktop sync → **headless Nextcloud client sidecar'd behind our Tauri UI** — one app, no
  sync engine of our own. Carries a caveat (below).
- **D-15** remote access → **an add-on, not the v1 bar.** v1 is LAN-first; mobile is offline-first.
- **D-16** local AI → **local-only default**, bring-your-own-key opt-in, off by default and warned.

💬 **The insight that unlocked D-15**
- Geofencing does **not** need remote access. The phone caches its tasks, evaluates the geofence
  locally, and fires the notification with zero server contact; uploads and updates queue offline and
  flush on WiFi. So the differentiator works on a LAN-only install — which let remote access become
  genuinely optional rather than secretly mandatory, keeping the "free, runs on your own desktop" pitch.
- The cost, accepted deliberately: **offline-first mobile is now a v1 commitment**, not a retrofit.

⚠️ **One caveat queued honestly, not assumed away (D-14)**
- Nextcloud's headless client is understood to be **one-shot, not a daemon**, so continuous background
  sync may need a scheduler or filesystem watch driven from the Tauri sidecar. Queued as a feasibility
  check; if it proves impractical, the fallback is WebDAV sync in our own client — without reopening the
  Nextcloud-vs-Syncthing decision.

⏳ **Next:** the last open [WHAT] — feature boundary vs commercial Orqafy — is genuine interview
material. Ready to run the Planning Assistant interview → docs/PRODUCT.md.

### Later the same day — sync engine settled, document AI proven feasible

**In your words:** could we add a free AI that OCRs, understands and auto-organises a whole PC's worth
of files dragged into the app — Client > Project > invoices, expenses/POs, receipts, payrolls?

✅ **Three more decisions locked**
- **D-10 Nextcloud for file sync** — decided by your hard **per-user read-only** requirement.
- **D-11 Tauri** for the desktop shell — ~17 MB vs ~112 MB, at the cost of ~50–300 lines of Rust for
  sidecar supervision, documented as the only non-TypeScript code in the product.
- **D-12 document AI is feasible** — free, self-hosted, CPU-only, licence-clean.

💬 **A wrong finding corrected**
- R-3 rejected Syncthing because it "has no user model". **That was factually wrong**, and R-3b proved
  it with a code citation — Syncthing's folder check runs server-side in a config only our backend
  writes, so a modified client cannot pull an unshared folder. Syncthing still lost, but on the *real*
  reason: it has no **per-device read-only**, which you require. Worth recording that the first answer
  was wrong for the wrong reason.

⚠️ **A consequence of choosing Nextcloud, opened not buried (D-10a)**
- R-3's case for Nextcloud leaned on its mature desktop client — but D-7 says we ship our own Tauri
  app, so that asset isn't automatically ours. Three paths now open: bundle the official Nextcloud
  client (GPL-2.0, least work, two apps), implement WebDAV sync in our client (one app, real work), or
  drop desktop folder sync entirely. **Blocks specifying the desktop client.**
- Also accepted knowingly: **Nextcloud has no delta sync**, so an edited 50 MB CAD file re-uploads in
  full. That makes the Pangolin throughput tuning **load-bearing rather than optional**. On-site LAN
  use talks to the server directly and is unaffected.

🔨 **Document AI — the answer is a qualified yes**
- **The reframe that makes it work:** your app already holds the ground truth (client names, project
  codes, PO and invoice numbers, suppliers, dates), so this is mostly **matching, not guessing**.
  L0 heuristics + L2 matching against your own records carry **~55–80% of the job with no LLM at all.**
- **Per-supplier template learning** — after one human correction, repeat documents from the same
  supplier file themselves. Beats a small LLM, and belongs in v1.
- **Licence traps found before we built on them:** Surya's weights are OpenRAIL-M (free only under $5M
  revenue — not shippable), Gemma is gated and carries pass-through use restrictions, Llama adds
  non-free terms for no benefit. Clean lane: RapidOCR/Tesseract + Ollama + Qwen3-4B/Phi-4-mini.
- **Cost:** thin slice **3–4 weeks**, full v1 **3–3.5 months**. Phasing is yours to decide.
- **Non-negotiable design point:** one silent payroll misfile destroys trust permanently, so nothing
  financial auto-files without a confidence gate and a review tray.

⏳ **Next:** phasing call on the document AI, the D-10a desktop-sync path, then the Planning Assistant
interview.

### Later the same day — client platforms, and the VPS question answered

**In your words:** Nextcloud is fine as long as we can modify it how we want; Windows/Mac need an
installable app like FennecNotes and Android/iOS both need apps; one programming language per the
Spec-Driven policy, though frameworks can differ per platform. And: can Pangolin run on the existing
Powerbyte-Hostinger VPS, is it free for unlimited users, and would a few users make it struggle?

✅ **Three more decisions locked**
- **D-7 client platforms** — Windows + macOS installable clients, Android + iOS apps, alongside web.
  You confirmed the desktop app is a **client only**, so **D-3 (server via Compose) stands**. Bundling
  a database into a desktop installer stays out of scope.
- **D-8 one language** — TypeScript everywhere, frameworks free to differ per platform. The teeth in
  this: dependencies that force another language into *our* codebase are disfavoured.
- **D-9 dedicated VPS** — Pangolin gets its own ~$4–6/mo box. **Not** the production VPS.

💬 **Answers to your two questions**
- **Free for unlimited users? Yes.** Self-hosted CE is AGPL-3.0 with no cap on users, sites, resources
  or orgs. The "5 users" figure quoted all over the internet is Pangolin **Cloud** Basic — a different
  product. Real CE gap is that audit/access logging is Enterprise-only.
- **Would a few users make the VPS struggle? Not on CPU or RAM** — about 700 MB and under 10% of
  2 vCPU; the vendor's own recommendation is 2 vCPU/2 GB, so your 8 GB box would be mostly wasted on
  it. **The real constraint is throughput**, and it is worse than expected — see the risk below.
- **Can it share the existing VPS? No — and this one matters.** Pangolin publishes host 80/443 and
  UDP 51820 and runs its own Traefik inside Gerbil's network namespace. Your production Traefik is
  already on those ports. The only vendor-shaped sharing path couples **every unrelated production
  app's uptime to the WireGuard process**. Not worth the blast radius at $4–6/mo for a separate box.

🔨 **Re-opened deliberately**
- **R-3's Nextcloud pick is back under review.** It was researched before D-7 and D-8 existed, and
  both undercut it: Nextcloud means a PHP runtime, web server, database and cron to bundle, and deep
  modification means writing PHP. R-3b is comparing Nextcloud vs Syncthing vs syncing against our own
  API. Your "as long as we can modify it" is the point — under the original plan we would *not* have
  been modifying it, only wrapping its API.

⛔ **New blocking risk found**
- **Pangolin throughput.** Newt/Gerbil has maintainer-acknowledged sequential packet processing —
  historically **~1–6 MB/s single-stream**, which would be crippling for a photo-and-file product.
  It reaches ~180 Mbit/s only with Newt ≥1.16.0, `USE_NATIVE_MAIN_INTERFACE=true` and host networking.
  Those are now mandatory in our bundle, and a real throughput test is queued as blocking before any
  customer install.
- Also noted: **all remote file traffic relays through the VPS** (no peer-to-peer path), projected at
  roughly 300–600 GB/month against a typical 1–2 TB quota. And **never ship the `ee-*` image** — its
  licence forbids redistribution.

⛔ **Hold:** local only, no remote, no deploy. Nothing scaffolded until PRODUCT.md is approved.

## 2026-09-06 — Project founded (spec seeded from the AIEF seat)

**In your words:** you wanted a new project in `1_COMPANY_DEV/` called **Orqafy-Self-Hosted** — the
free, open-source, self-hosted version of Orqafy, aimed at construction engineers and architects, with
some features removed and a different approach. Desktop-as-server with local + NAS storage, LAN clients,
remote access over a FOSS Tailscale-alternative on the server's own domain, a mandatory mobile app, seven
modules (projects, invoicing, POs→inventory, expenses, inventory chain-of-custody, Drive-like file sync,
and geofenced notifications), starting from Kaneo's UI/UX — spec'd our Spec-Driven way before any scaffold.

✅ **Done & verified**
- Verified Kaneo live: `usekaneo/kaneo` is **MIT**, TypeScript, **Hono + React**, self-hosted, actively
  maintained (755 forks, pushed 2026-09-05) — safe to reference and to lift code from with attribution.
- Ran the analyze-confirm gate on the founding brief; **4 decisions confirmed** by you:
  **D-1** AIEF locked stack with Kaneo as UI/UX + domain reference only · **D-2** AGPL-3.0, public repo ·
  **D-3** Docker Compose first, native desktop installer later · **D-4** phased v1 (PM + files + geofence
  + mobile), v2 (invoicing / POs / inventory / expenses).
- Created the project: folder, `git init`, and the planning artifacts — `docs/SEED_BRIEF.md` (founding
  authority), `PENDING_DECISIONS.md`, `docs/TASK_QUEUE.md` (8 open), `docs/STATE.md`, `README.md`, and a
  `.gitignore` carrying the public-repo asset guard.
- Wrote the project's own seat memory so this repo cold-starts on its own.

💬 **Notes / constraints established**
- **Geofencing forces a native app.** Background geofence wake-ups are native-only — iOS gives PWAs no
  background location, Android is unreliable. Expo carries the differentiator; the PWA is a complementary
  surface, not the geofence path.
- **AGPL-public collides with two private assets.** This repo can never contain the AIEF framework files
  (`.ai_prompt/`, `AI/`) or the paid **AdminCN** slice (no redistribution). Built with the framework,
  shipped without it — enforced in `.gitignore`, with a pre-push assertion still to be wired.
- **Kaneo covers only ~15–20% of the scope.** Invoicing, POs, inventory ledger, expenses, file sync,
  geofencing, NAS storage, desktop packaging and mobile are all net-new.
- **Full Drive-style sync is its own product** — adopt an existing engine (Syncthing is the prior) rather
  than writing one.

⏳ **Next**
- Planning Assistant interview → `docs/PRODUCT.md`, then DESIGN.md + MOCKUP.jsx.
- Research R-1 remote-access overlay (Headscale/NetBird/Netmaker/Nebula/Pangolin) · R-2 UGREEN NASync
  DH2300 storage access · R-3 file-sync engine · R-4 Kaneo teardown.
- 3 open `[WHAT]`s for the interview: feature boundary vs commercial Orqafy · multi-tenancy shape ·
  mobile distribution.

⛔ **Hold:** local only, no remote, no deploy. Nothing scaffolded until PRODUCT.md is approved.
