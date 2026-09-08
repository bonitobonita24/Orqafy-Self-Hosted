# Decisions Log — Orqafy-Self-Hosted

Append-only record of every owner-confirmed `[WHAT]` decision. Newest at the bottom of each session
block. A decision lands here **and** in `docs/PRODUCT.md` before any code depends on it.
Open decisions live in `PENDING_DECISIONS.md`; they move here once answered.

---

## 2026-09-06 — Founding session

### D-1 · Stack and Kaneo's role
**Decision:** Build on the AIEF locked stack — Next.js · tRPC · Prisma · Auth.js v5 · Postgres ·
Valkey · BullMQ · MinIO→S3 · shadcn/ui. Kaneo (`usekaneo/kaneo`, MIT) is a **UI/UX and domain
reference only**; its Hono + Drizzle backend is not adopted.
**Why:** the fleet stack is where our leverage, conventions and reusable packages already are.
Adopting a second backend architecture for one app would fork our maintenance surface for no gain.

### D-2 · Licence and visibility
**Decision:** **AGPL-3.0, public repo.**
**Why:** AGPL's network clause is what protects commercial Orqafy — anyone reselling this as a SaaS
must publish their modifications, which removes the incentive to do so. Public is the point: this is
the free, open sibling.
**Consequence (hard):** the repo can never contain the AIEF framework files (`.ai_prompt/`, `AI/`)
or the paid AdminCN slice (`starter/admincn/`). Built *with* the framework, shipped *without* it.

### D-3 · Server install form
**Decision:** **Docker Compose first.** A native desktop installer (Tauri/Electron) is a later
track, not v1.
**Why:** Compose is the shortest path to a working desktop-as-server install and matches how every
other app in the fleet ships. Packaging a one-click installer is its own project.

### D-4 · v1 scope
**Decision:** **Phased.** v1 = project management + Drive-like file sync + geofenced notifications +
the mobile app. v2 = standalone invoicing, POs→inventory, company expenses, inventory chain-of-custody.
**Why:** the geofenced-task differentiator and the PM core are what make the product worth running.
The finance modules are large, well-understood, and can follow.

---

## 2026-09-06 — Resume session

### D-5 · Multi-tenancy shape
**Decision:** **Single-company install.** One organisation per install; **clients and projects are
first-class records** underneath it. No tenant model.
**Why:** the deployment target is one construction firm running its own server — a tenant dimension
would tax every query, every RBAC check and every schema table to serve a case that does not exist
in the self-hosted product. Tenancy can be layered on later if a hosted edition ever appears; the
reverse (removing tenancy once it is threaded through) is far more expensive.
**Consequences:**
- Schema carries **no `tenant_id`**. The root scope is the single organisation.
- RBAC is **role-per-user within the one org**, scoped down to projects — not the fleet's 3-tier
  tenant RBAC standard. That standard governs tenant-based Powerbyte apps; this is deliberately not
  one, and `~/.claude/library/tenant-rbac-standard.md` does **not** apply here.
- The fleet **universal login credentials** (tenant_manager / tenant_superadmin / tenant_admin) do
  **not** apply. This is a public AGPL product installed by third parties — seeding Powerbyte
  credentials into it would be a credential leak. First-run setup creates the owner's own admin
  account interactively.
- Diverges from commercial Orqafy's schema. Accepted: the two products are siblings, not forks.

### D-6 · Mobile distribution
**Decision:** **Sideload / self-build only.** No Play Store or App Store listing under Powerbyte.
**Why:** geofencing is the product's differentiator, and background-location justification is exactly
what store review scrutinises hardest — a generic self-hosted client pointing at a user-supplied
server is a known rejection risk. Self-build keeps the capability unconstrained and costs nothing.
**Consequences:**
- Expo config targets **local/EAS self-build**, not store submission. No store signing identities to
  manage under Powerbyte.
- **Android** is the primary mobile surface — APK built and distributed by the firm running the
  install. This is where site staff are.
- **iOS is the weak spot and must be stated honestly in the README:** without a store listing, iOS
  users need TestFlight or their own Apple developer account. There is no free, unlimited sideload
  path on iOS. Document it as a known limitation rather than implying parity.
- Revisit only if a hosted edition appears, which would change the review calculus.

---

## 2026-09-06 — Client platforms and remote-access hosting

### D-7 · Client platforms — desktop and mobile apps are in scope
**Decision:** Ship **installable client apps for Windows and macOS** (FennecNotes-style) **and mobile
apps for both Android and iOS**, alongside the web UI.
**Critically: the desktop app is a CLIENT ONLY.** The server is still installed via Docker Compose —
**D-3 stands and is not superseded.** The desktop app connects to a server; it does not bundle or
become one.
**Why:** site staff and office staff both need a first-class native surface. Geofencing already forced
a native mobile app (D-6); the desktop client makes file sync and project work feel like a real
application rather than a browser tab.
**Consequences:**
- Four client targets to build and keep in step: web, Windows, macOS, Android, iOS.
- Packaging, code signing and auto-update become real workstreams per desktop platform.
- Bundling a database or object store into the desktop app is explicitly **out of scope** — that was
  the "server as installer" option, and it was rejected.

### D-8 · One language, many frameworks
**Decision:** **TypeScript across the whole product.** Frameworks may differ per platform — Next.js
for web, an Expo/React Native app for mobile, a TypeScript desktop shell for Windows/macOS — but the
language is one.
**Why:** matches the Spec-Driven policy and keeps every developer able to work on every surface.
Shared types, shared validation, and shared domain logic across web, desktop and mobile.
**Consequences:**
- **Dependencies that force another language into OUR codebase are disfavoured.** Wrapping a
  third-party service through its API is fine (it is a black box); having to write PHP, Go or Python
  to extend it is not. This is what put R-3's Nextcloud pick back under review — deep modification of
  Nextcloud means PHP.
- Desktop shell choice must weigh this: an Electron-family shell stays TypeScript end to end, whereas
  Tauri brings a Rust toolchain for anything beyond the webview. Not yet decided — a `[HOW]` to settle
  when the desktop client is specified.

### D-9 · Remote access runs on a DEDICATED VPS, never the production box
**Decision:** Pangolin runs on its **own small VPS** (~2 vCPU / 2 GB, ~$4–6/mo). **Do not install it
on `Powerbyte-Hostinger`**, which already fronts production apps with its own Traefik.
**Why (evidence: `docs/planning/R1a_PANGOLIN_SIZING.md`):** Pangolin publishes host 80/443 and UDP
51820 and runs its own Traefik inside Gerbil's network namespace under a config provider it owns. The
only vendor-shaped way to share a host couples **every unrelated app's uptime to the WireGuard
process**. At $4–6/mo for a dedicated box, that blast radius is not worth taking.
**Consequences:**
- The existing 8 GB production VPS is **not** the target and stays untouched by this project.
- Two distinct questions must not be conflated: how *we* host our own install (a dedicated VPS), and
  what *third-party self-hosters* are told to do (their own VPS — ours can never serve them).
- **Mandatory in our bundle:** Newt ≥ 1.16.0 with `USE_NATIVE_MAIN_INTERFACE=true` and host
  networking. Without it, throughput has historically been ~1–6 MB/s single-stream, which would be
  crippling for a photo-and-file product. Must be throughput-tested before any customer install.
- **Never ship or reference the `ee-*` image** — the FCL licence forbids redistributing it. CE only.
- Known CE gap: **all audit/access logging is Enterprise-only.** If we need an access audit trail, it
  is ours to build at the application layer.

---

## 2026-09-06 — Sync engine, desktop shell, document AI

### D-10 · File sync — Nextcloud, driven by a hard read-only requirement
**Decision:** **Nextcloud**, because **per-user read-only file access is a hard product requirement.**
Some users must be able to view drawings, permits and contracts without being able to modify or
delete them, enforced server-side.
**Why:** this is the one capability Syncthing cannot provide. R-3b established that Syncthing's
folder authorisation IS a real server-side boundary (`lib/model/model.go:1982` — a modified client
cannot pull an unshared folder), correcting R-3's wrong claim that it had none. But sharing is
all-or-nothing per device: **there is no per-device read-only enforcement.** Given read-only is
required, Syncthing is out regardless of its other advantages.
**Costs accepted — recorded honestly, not glossed:**
- **No delta sync.** Nextcloud still has none. An edited 50 MB CAD file re-uploads in full. Over the
  relayed tunnel this is the expensive case, which makes the **Pangolin throughput tuning task
  (Newt ≥1.16.0 + `USE_NATIVE_MAIN_INTERFACE=true` + host networking) load-bearing, not optional.**
  On-site LAN use talks to the server directly and is unaffected.
- **~530 MB plus a second database** on the server, versus ~18 MB for the alternative.
- **PHP.** Acceptable only as a black-box sidecar wrapped through its API (D-8 permits this). If we
  ever find ourselves needing to *modify* Nextcloud, that is a signal to revisit this decision.
- **Superseded:** `docs/SEED_BRIEF.md` §4.4's Syncthing prior is formally retired.

### D-10a · OPEN CONSEQUENCE — the desktop sync client is now unresolved `[HOW→WHAT]`
R-3's original case for Nextcloud rested substantially on its **mature desktop client**. D-7 says we
ship our OWN Tauri client, so that asset is not automatically available. Three paths, none yet chosen:
- **(a) Bundle the official Nextcloud desktop client** alongside our app. GPL-2.0, compatible with our
  AGPL-3.0, least engineering — but the user installs and sees two applications.
- **(b) Implement WebDAV sync inside our Tauri client.** One app, full control, all TypeScript. Real
  work, and still delta-less because the limitation is Nextcloud's, not the client's.
- **(c) No desktop folder sync.** Our app is a project/file browser doing on-demand upload/download;
  users wanting a synced folder install the Nextcloud client themselves.
**Tracked in `PENDING_DECISIONS.md`. Must be settled before the desktop client is specified.**

### D-11 · Desktop shell — Tauri
**Decision:** **Tauri**, accepting roughly 50–300 lines of Rust confined to sidecar supervision.
**Why:** ~17 MB installer versus ~112 MB for Electron, and materially lower RAM per running client —
which matters for firms on poor rural connections and modest office hardware.
**Consequence:** a deliberate, contained exception to D-8. The Rust surface is boilerplate, written
once, and must be **documented as the sole non-TypeScript code in the product**. All UI and
application logic stay TypeScript. If the Rust surface ever grows beyond sidecar supervision, that is
a signal to revisit.

### D-12 · Document AI — feasible, and the licence-clean toolchain is now fixed
**Status:** feasibility settled (`docs/planning/R5_DOCUMENT_AI.md`); **phasing still an open `[WHAT]`.**
**Verdict:** **qualified yes** — free, self-hosted, CPU-only, licence-clean, and TypeScript-only in our
own code, **but only as a DB-matching-first pipeline.** An LLM-first design is not feasible on the
hardware these firms own.
**Key finding:** **L0 heuristics + L2 matching against our own records carry ~55–80% of the job with no
LLM at all.** Per-supplier template learning from a single human correction beats a small LLM on repeat
suppliers — and belongs in **v1, not v2**.
**Licence blockers found (these would have bitten us at ship time):**
- **Surya** — weights are OpenRAIL-M, free only under $5M revenue. **Not shippable** in our product.
- **Gemma** — pass-through use restrictions, and its HF repo is gated, so auto-download is impossible.
- **Llama** — Community License adds non-free terms for no benefit here.
- **Clean lane:** RapidOCR / Tesseract (Apache-2.0) + Ollama (MIT) + Qwen3-4B / Phi-4-mini
  (Apache-2.0 / MIT).
**Cost:** thin slice ≈ **3–4 weeks** (drop folder → OCR → full-text search → exact-ID auto-file →
review tray, no LLM). Full v1 ≈ **3–3.5 months**.
**Top risks:** the accuracy ceiling is informational, not technical — it is bounded by what the
documents actually contain; **one silent payroll misfile destroys trust permanently**, which is why
the confidence-gated review tray is non-negotiable; and RAM/CPU cost on a small firm's box.

---

## 2026-09-06 — v1 scope resolution (four decisions)

### D-13 · Document AI — thin slice in v1, full version later
**Decision:** the **thin slice ships in v1** (~3–4 weeks): drop folder → OCR → full-text search →
exact-ID auto-file → review tray. **No LLM.** The LLM layer and per-supplier template learning follow
once the v2 finance modules give richer targets to file into.
**Why:** delivers the drag-and-drop experience and searchable OCR'd documents immediately, at low risk,
while the highest-value auto-filing (invoices/POs/expenses) naturally waits for the modules that own
those records. Refines D-4 without moving its other v1 commitments.
**Consequence:** v1 depends only on the licence-clean OCR lane (RapidOCR/Tesseract); Ollama + the local
model are a v1.x/v2 addition, so v1's footprint stays small.

### D-14 · Desktop sync — headless Nextcloud client sidecar'd behind our UI
**Decision:** bundle **Nextcloud's headless/command-line sync client** and supervise it from the Tauri
shell (this is precisely what D-11's Rust sidecar-supervision surface exists for). The user sees **one
app**; we write no sync engine. Resolves D-10a.
**Why:** single-app experience without building or maintaining sync ourselves. GPL-2.0 headless client
is compatible with our AGPL-3.0.
**OPEN CAVEAT — must be verified before this is load-bearing:** the headless client is understood to be
**one-shot rather than a continuous daemon**, so continuous sync may require us to drive it on a
schedule or a filesystem watch. Queued as a feasibility check in `docs/TASK_QUEUE.md`. **If continuous
background sync proves impractical this way, the fallback is D-10a option (b)** — WebDAV sync in our
own client. Not a reopening of Nextcloud vs Syncthing; only *how* our client talks to Nextcloud.

### D-15 · Remote access — an add-on, not the v1 bar; mobile is offline-first
**Decision:** v1 targets a **LAN install with no VPS required.** Remote access (Pangolin on a dedicated
VPS per D-9) is a **documented, optional add-on.** The **mobile app is offline-first.**
**Why:** preserves the "free, runs on your own desktop" promise for the common case. Crucially,
**geofencing does not need remote access** — the phone caches its task list, evaluates the geofence
locally, and fires the notification with no server contact; photo uploads and task updates queue
offline and flush on WiFi. So the differentiator works LAN-only.
**Consequences:**
- **Offline-first is now a v1 design commitment, from the start** — cached tasks, local geofence
  evaluation, an outbound queue with conflict handling on reconnect. Retrofitting this later is
  expensive, which is exactly why it is committed now rather than deferred.
- Remote access, when a firm opts in, still carries the D-9 dedicated-VPS rule and the mandatory
  Pangolin throughput tuning.
- The no-VPS remote fallback (Traefik + Let's Encrypt + port-forward, where a routable IP exists)
  stays documented for the technically-capable.

### D-16 · Local-AI hosting — local-only default, bring-your-own-key opt-in
**Decision:** the document AI ships **local-only by default** — CPU models, free, private, no account,
no keys in our repo. A firm may supply **their own API key** in settings to raise accuracy; it is
**off by default** and gated behind a clear warning that documents then leave their server.
**Why:** the only model consistent with a public AGPL product and the self-hosted privacy promise. We
can never ship our own keys, and financial documents must not leave a firm's server without an
explicit, informed opt-in.
**Consequence:** BYO-key is a settings toggle, not a setup-time prompt — we do not nudge users toward
sending payroll and invoices off-site.

---

## 2026-09-06 — Planning Assistant interview (PRODUCT.md written)

### D-17 · Roles & RBAC shape
Architect and Engineer collapse into one **Project Manager** role (shared permissions). RBAC is
**predefined roles + custom permission-groups + per-user overrides** — finance visibility and the like
are permissions, not role-hardwired. A **permission builder is a v1 build item.** Single-org (no tenant
dimension, per D-5).

### D-18 · Client portal — v2, read-only + milestone sign-off
External clients get accounts in **v2**: read-only view of their own project (progress, milestones,
milestone photos, their invoices) plus **milestone sign-off/reject** (the one write action, notifies
the PM). Cannot see internal tasks, costs, other clients, or unshared files.

### D-19 · Geofence behaviour
**~3-minute dwell** inside the radius triggers; **re-alerts on every re-entry** (no quiet-hours in v1);
multiple tasks in one radius fire **one grouped** "N things to do here"; fires **only for the assigned
worker**. Tasks carry a **schedule**: required **active-from** date (arms the geofence) + optional
**active-until**. Evaluated **on-device, offline**. **Presence-only — no location history.**

### D-20 · Data sensitivity & DPA posture
**Payroll documents kept** as an AI filing category, treated as **SPI** (encrypted at rest,
finance-permission-gated, excluded from broad search); the app computes no payroll. **DPA mechanisms in
v1:** retention config, export/delete data-subject actions, access audit log (built at the app layer —
the sync/tunnel tools' own audit logging is enterprise-only). **Worker location is presence-only.**
Installing firm is the data controller; product provides the mechanisms. `gov_lgu_flag: false`; WCAG
2.2 AA a build target regardless.

### D-21 · Leave management — v1, scoped
**Leave management only** (apply / approve / balances / leave calendar) enters **v1**. Approver is
anyone granted the **`approve_leave`** permission (custom-group model). Attendance, timekeeping and
payroll processing stay **out of scope**. Reopens SEED_BRIEF §6's "Payroll/HR out of scope" narrowly —
leave only. Sick-leave reason optional, no required health detail (SPI care).

### D-22 · Realtime, maps, dashboard, mobile push
- **Realtime:** web is real-time (websocket board + notifications); mobile is offline-first,
  sync-on-reconnect.
- **Maps:** **Leaflet + OpenStreetMap** (no API keys, self-hostable) for task location+radius and site
  views. Kanban/Gantt/dropzone from **Kibo UI**; dashboard charts from **shadcn Chart (Recharts)**.
- **Home dashboard:** active projects %, my tasks due/overdue, recent site photos, unsorted-docs count,
  pending leave approvals, v2 finance strip.
- **Mobile push:** v1 = **foreground/websocket + on-device geofence/reminders** (no FCM/APNs
  dependency — stays self-hosted). Background push (UnifiedPush Android / APNs iOS) is **v1.x**.

### D-23 · Design identity
**Simple, uncluttered, user-friendly, common modern interface** (owner's explicit steer). Kaneo as
visual reference; shadcn/ui + Kibo UI; IBM Plex Sans + JetBrains Mono; neutral base + one accent.
Field pages Mobile First, admin/ops pages Mobile Ready.

### D-24 · Mockup approved + Phase-0-prep research resolved (2026-09-08)
- Owner **approved** the Phase 2.8 dashboard mockup (`docs/MOCKUP.jsx` / `mockup-dashboard.png`) — the
  design gate is cleared and **Phase 0 scaffold is unblocked**.
- Four pre-scaffold research tasks resolved, context7-grounded (cited + unverified flags): **R6** Expo
  background-geofencing verified (native-build-only, iOS 20-region cap, Enter/Exit-only → app-side dwell);
  **D-15** offline-first mobile design specced (cache + local geofence eval + outbound queue + reconnect
  conflict handling); **R7** Tauri packaging + minisign self-hosted auto-update + Rust sidecar surface;
  **D-14 RESOLVED** — `nextcloudcmd` is one-shot, so the Rust sidecar drives continuous sync (debounced
  fs-watch + timer), WebDAV-in-client as fallback.
- Three tasks remain **BLOCKED** on real hardware / a running stack / a live tunnel (geofence-over-tunnel
  latency, sync-engine resource cost, Pangolin throughput) — they gate a later phase, not Phase 0.

### D-25 · Phase 0 scaffold parameters (owner, 2026-09-08)
Resolves the four `[WHAT]`s from `docs/planning/PHASE0_SCAFFOLD_PLAN.md` §8, unblocking Phase 0 execution.
- **W-1 Breadth → WEB FIRST.** Scaffold `apps/web` to a running vertical slice first; `apps/mobile` (Expo)
  and `apps/desktop` (Tauri) shells come in later build waves.
- **W-4 UI baseline → INHERIT AdminCN LOCALLY, SHIP DERIVED shadcn output.** Framework default: AdminCN
  app-shell as local reference only; the public AGPL repo commits ONLY our own data-decoupled shadcn/ui
  code — no AdminCN paid-slice files in history.
- **W-2 Dev admin → SEED A DEV-ONLY ADMIN** (generated, in gitignored `CREDENTIALS.md`). Real installs
  still use interactive first-run, NO Powerbyte universal creds (D-5 preserved).
- **W-3 Framework tooling files → LOCAL-ONLY / HIDDEN.** `docs/tasks/phase4-part*.md`, `.clinerules`,
  `.mcp.json`, etc. are gitignored ("built with the framework, shipped without it").
- **Also (HOW, not owner-gated):** extend the asset guard BEFORE any framework seeding (plan task P0.1,
  covers `.github/skills/`, framework `scripts/*`, `.clinerules`, `.mcp.json`, `.vscode/`); override the
  Part-3 DB seed to the app's own role model + interactive first-run (plan R-4 / build-task B3).
- **`docker.publish: false`** (owner-confirmed) — ships as a Compose bundle; no registry image, no CI
  publish, no staging/prod.

### D-26 · Web UI baseline — plain shadcn/ui + Kibo (owner, 2026-09-08; supersedes D-25/W-4)
Web UI is built on **plain shadcn/ui + Kibo UI, Next.js-native** — NOT the AdminCN (shadcn/studio Pro)
starter, and NOT `marmelab/shadcn-admin-kit`.
- **shadcn-admin-kit evaluated + rejected on STACK FIT (not licence):** it is MIT ✅ but a react-admin
  (`ra-core`) client-side SPA using `dataProvider`/`authProvider` — it diverges from our locked Next.js +
  tRPC + Auth.js stack (D-1), is CRUD-admin-centric, needs custom tRPC/Auth adapters, and does nothing for
  the Expo mobile app. May harvest individual MIT components as inspiration only.
- **AdminCN (shadcn/studio Pro):** the owner HOLDS a paid shadcn/studio licence (valid for OSS + commercial
  apps), so *use* is not the issue. The owner nonetheless chose plain shadcn/ui + Kibo for the cleanest
  public-repo story (zero paid-slice dependency, fully MIT even locally). Standing safeguard regardless:
  a paid template's SOURCE is never committed to this public AGPL repo — only our own derived shadcn/ui code.
- Consistent with DESIGN.md D-23 (shadcn/ui + Kibo UI; Kaneo as visual reference). Governs the Phase-4
  web-UI build (plan §7 B4/B5). The Phase-0 local AdminCN seed is now an unused local reference (harmless,
  gitignored).
