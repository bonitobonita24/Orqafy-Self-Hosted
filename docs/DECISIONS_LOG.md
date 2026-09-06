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
