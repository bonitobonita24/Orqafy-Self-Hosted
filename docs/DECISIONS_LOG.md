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
