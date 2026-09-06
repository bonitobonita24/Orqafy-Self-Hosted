# Session Log — Orqafy-Self-Hosted

Human-readable accomplishment report, one section per working session, **newest on top**.

**Legend:** ✅ done & verified · 🔨 partial / in progress · ⏳ not yet / next · 💬 decision / note · ⛔ blocked

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
