# Session Log — Orqafy-Self-Hosted

Human-readable accomplishment report, one section per working session, **newest on top**.

**Legend:** ✅ done & verified · 🔨 partial / in progress · ⏳ not yet / next · 💬 decision / note · ⛔ blocked

## 2026-10-10 — Release: v0.1.1 security audit fixes merged + pushed

**In your words:** "keep the repo dev-only, scope out M-4b, merge and push v0.1.1."

✅ **Decision locked (D-33)** — M-4b (production compose) closed as will-not-do-in-repo; the repo stays dev-only and the prod/staging/demo stacks remain Komodo-managed server-side. M-4a's localhost binding already removed the exposure risk.
✅ **All 10 fix branches merged to `main`** (H-1..H-5, M-1..M-5), each as a `--no-ff` merge so the verified commits are preserved. Resolved one real conflict (OCR service in the compose file — kept H-4's stronger "no host port at all") and one integration break the combined test run caught: M-5's media tests were mocking the old auth module, but H-2 had rewired those routes — fixed the test mocks (your app code was already correct).
✅ **Full suite green on the merged result** before anything was pushed — typecheck 10/10, lint 10/10, tests across all workspaces (web 185, mobile 157, + the rest), and the web production build.
✅ **Released v0.1.1** — version bumped, changelog generated, annotated tag, pushed `main` + tag. This reaches your CI/staging only; production and demo stay manual by rule.
💬 **One follow-up now unblocked** (H-4 is on main): the small OCR constant-time-compare polish. The vite/vitest major upgrade stays a post-v1 task.

## 2026-10-10 — Full Auto: M-1…M-5 security fixes (9/9 un-gated done; release gated on one decision)

**In your words:** (Full Auto, you asleep) — finish the v0.1.1 security-audit wave, M-1 onward.

✅ **M-1 · First-run setup hijack + race** — first-run `/setup` now requires a one-time `SETUP_TOKEN` (constant-time check, disabled if the server didn't set one), and the "only one owner" rule is enforced inside the DB transaction behind a Postgres advisory lock, so two people hitting setup at once can't both become owner. 5 tests incl. a concurrency test. Branch `fix/audit-m1-setup-token` `3729b95`.
✅ **M-2 · Rate limiter IP spoofing** — the login limiter was reading the *client-controlled* leftmost `X-Forwarded-For` entry, so an attacker could look like a new IP every request and never trip the limit. Now reads the entry our trusted proxy actually added (configurable hop count). Test proves rotating fake IPs share one bucket. Branch `fix/audit-m2-xff-trust` `b47ee31`.
✅ **M-3 · Missing security headers** — added CSP (frame-ancestors none, etc.), HSTS, nosniff, Referrer-Policy, X-Frame-Options. CSP tuned to what the app really uses (OpenStreetMap tiles, self-hosted fonts, same-origin realtime) so nothing breaks; the production build passed as the no-breakage check. Branch `fix/audit-m3-security-headers` `087dac8`.
✅ **M-4a · Services exposed on all interfaces** — every dev container port (Postgres, Valkey, MinIO, app, …) now binds to `127.0.0.1` only, so they're not reachable from the LAN. Verified with `docker compose config` (no containers started — other sessions may be running). Branch `fix/audit-m4-compose-bind` `2e6593c`.
✅ **M-5 · Media Content-Type trust (stored-XSS)** — downloads now carry nosniff + a sandbox CSP and serve risky types (HTML/SVG) as a plain download instead of inline; uploads switched from a leaky denylist to an allowlist that blocks HTML/SVG even if relabeled. 16 tests. Branch `fix/audit-m5-media-content-type` `1f02f74`.
⛔ **M-4b · "ship a production compose" — deferred to you (a decision, not a bug).** This repo is deliberately dev-only (D-3 / `start.sh` refuses any non-dev env), and staging/prod live on EC2-Komodo / Hostinger. A correct prod compose depends on that topology (image source, secrets, resource limits) and shouldn't be guessed into a public repo. Recorded in PENDING_DECISIONS. **My recommendation: keep the repo dev-only for v0.1.1** — the port-binding fix already removes the exposure risk. This is the one thing holding the v0.1.1 merge+push.
💬 **Held the release.** All 9 un-gated fixes are done, verified, on isolated branches, local only. I did **not** merge or push v0.1.1 — I won't scope out a deliverable you planned (M-4b) on my own, so the release waits for your call on it.
⏳ **Next:** your decision on M-4b → then merge the fix branches in order + auto-version + push v0.1.1 (staging ceiling; prod/demo stay manual).

## 2026-10-10 — Full Auto: H-5 stale base layers (5/10)

**In your words:** continue the v0.1.1 security-audit wave (Full Auto, you asleep) — next fix is H-5.

✅ **H-5 · Stale container base layers** — refreshed all three dev images. **OCR image now fully clean** (2→0 fixable CRITICAL/HIGH): `apt-get upgrade`, upgraded pip/setuptools/wheel, then dropped `pip` itself (it vendored stale copies); H-4's non-root user kept. **App + worker** (68→34 fixable): `apk upgrade` (patched libssl/libcrypto), deleted the bundled `npm` tree (it carried a CRITICAL `tar` CVE and never runs), bumped the pnpm pin, added safe same-major dependency overrides. The flagged `nodemailer` CVE turned out not to apply (it isn't actually installed).
✅ **Verified** — branch `fix/audit-h5-stale-base-layers` `e026d82` (stacked on the H-4 branch so the shared OCR file doesn't collide at merge). Ran the full gate after the dependency change: clean install, typecheck, lint, 352 tests, and the production web build — all green; app/worker/ocr all boot.
💬 **Carve-out logged** — the 34 CRIT/HIGH still on app/worker are all the vite/vitest build-and-test toolchain (not base layers). They need a major-version upgrade with its own test pass, so I split them into a new backlog task; they do **not** block finishing the v0.1.1 wave.
⚠️ **Flagged** — other Orqafy sessions appeared active on this repo at session start (possible concurrency); git state verified clean before/after, carried into the handoff.
⏳ **Next** — M-1 (first-run setup token + transaction), then M-2…M-5, then merge + push v0.1.1.

## 2026-10-10 — Full Auto: anomaly resolved + H-4 OCR hardening (4/10)

**In your words:** you confirmed the loop relaunch was intentional ("continue the wave"), then asked me to run Full Auto Mode every reboot while you sleep.

✅ **Loop anomaly resolved** — the "loop was stopped 2026-09-27 but ran today" flag was surfaced to you at session start; you confirmed continue. Cleared from memory/STATE so no future iteration re-asks.
✅ **Full Auto Mode engaged + persisted** — banner written into the handoff + cold-start memory so it re-engages on every reboot: no approval questions, one fix at a time (serial), `[WHAT]`s deferred to PENDING_DECISIONS.md, HARD HOLD stays (prod/demo manual).
✅ **H-4 · OCR sidecar hardened** — bumped pillow/python-multipart/fastapi(+starlette≥1.3.1, resolved 1.7.0), non-root `appuser`, dropped host port 9003, added `X-OCR-Secret` shared-secret auth (fail-closed), decompression-bomb guard; wired the secret through the worker's OCR client. Branch `fix/audit-h4-ocr-hardening` `47da244`. PM-verified: jobs 17/17, Trivy fs 0 on the 3 deps, unauth `/ocr`→401, OCR e2e extracted "INVOICE 12345", host `:9003` refused.
💬 Logged a LOW backlog item: swap the OCR secret check to `hmac.compare_digest` (constant-time) — low practical risk, un-gated polish.
⏳ **Next:** H-5 (stale base layers), then M-1…M-5 — serial, each verified; then merge + auto-version + push v0.1.1 (staging ceiling).

## 2026-10-10 — Loop resume: start the v0.1.1 security-audit fix wave (3/10)

**In your words:** (loop auto-resume, empty handoff) — pick up the highest-priority un-gated work and keep the wave moving.

✅ **H-1 · SPI document gate bypass** — SPI docs (payroll/HR) now gated behind `view_finances` on update/delete/decideReview/reviewTray; a `project_manager` can no longer read, flip, or delete them. 13 regression tests. Branch `fix/audit-h1-spi-gate-bypass` `e60d753`. PM-verified (tsc/eslint/vitest green).
✅ **H-2 · Deactivated user kept a live web session** — cookie/session path + both `/api/media` routes + SSE now re-check `isActive`; a deactivated user's cookie → 401 everywhere; session lifetime bounded to 8h. Branch `fix/audit-h2-deactivated-session` `a567c50`. PM-verified.
✅ **H-3 · Web login had no brute-force limit** — web credentials login now uses the same rate-limit store as mobile login. Branch `fix/audit-h3-web-login-ratelimit` `b378137`. PM-verified.
💬 All three are LOCAL branches only — **nothing merged or pushed** (HARD HOLD). The push to v0.1.1 happens only when the whole wave (H-4/H-5/M-1…M-5) is done, per D-32.
💬 Caught (and worked around cleanly) a dispatch footgun: H-2 and H-3 ran as parallel workers in one git working tree and collided on branch state — no damage this time, but future fixes go serial or in isolated worktrees. Logged to the global lessons ledger.
⚠ **Flag for you:** this loop (slot 24) is running despite the 2026-09-27 "save + stop". If that wasn't intended, say "stop". Otherwise I'm continuing the wave on D-32's standing authorization.
⏳ **Next:** H-4 (OCR sidecar vulnerable deps + add auth), H-5 (rebuild stale container base layers), then M-1…M-5.

## 2026-09-27 — Resume: resolve branding [WHAT] + build Orqafy wordmark placeholder

**In your words:** resumed the session; on the one open decision (Orqafy logo vs Powerbyte company logo), you chose Orqafy's own product brand with a text wordmark placeholder for now.

💬 **D-29** — Orqafy carries its OWN product brand (sidebar/login/favicon); Powerbyte mark stays in the "Developed by Powerbyte IT Solutions" footer only. Scopes the 2026-09-21 official-logo broadcast to the footer for this public AGPL product. Asset = **text wordmark placeholder**. Back-ported to DECISIONS_LOG + PENDING_DECISIONS; committed on `main` (`34debcc`).
✅ **Orqafy wordmark + favicon + Powerbyte footer** — built + verified (Opus worker) on `feat/orqafy-wordmark-branding` (`e31b64e`): reusable `<OrqafyWordmark>` ("O" monogram + IBM Plex Sans wordmark, theme-token only) in the sidebar + login; App-Router `icon.svg` favicon; new sidebar footer with version tag + Powerbyte credit link. typecheck / lint / build all green (PM re-verified typecheck). HARD HOLD — local only, on branch.
💬 RBAC SessionStart offer dismissed — known false positive (D-5 single-org, not tenant-based).
✅ Merged branding + `restart: "no"` + app version 0.1.0 + PRODUCT.md back-ports D-28/D-29 (`main` `2957d9b`); all gates green; dev stack rebuilt, now on http://localhost:56483, restart=no.
✅ Public repo https://github.com/bonitobonita24/Orqafy-Self-Hosted — release **v0.1.0** (`9ba2472`), CI green.
✅ Tier 1+2 security audit: 0 CRITICAL, 5 HIGH, 5 MEDIUM, 10 LOW. Report at `test-artifacts/audit-2026-09-27/REPORT.md` (gitignored).
💬 **D-30** desktop deferred / reuse web / cookie auth · **D-31** publish as-is · **D-32** fix H+M, then push v0.1.1.
💬 The model setup changed 2026-09-27: architect Opus 4.8, worker Sonnet 5.
⏳ Next: the audit fix wave H-1→M-5, then v0.1.1.
⛔ Owner stopped the loop 2026-09-27 (save + stop).

## 2026-09-27 — Adopt fleet DEV-compose `restart: "no"` policy

**In your words:** apply the fleet broadcast (2026-09-23) so Docker Desktop stops auto-launching the whole dev fleet.

✅ Done — changed every `restart: unless-stopped` → `restart: "no"` across the 3 DEV compose files (9 services: 3 app, 2 db, 4 infra). Verified zero `unless-stopped`/`always` remain under `deploy/compose/dev/`. DEV-ONLY — no staging/prod/demo compose touched. Committed locally on `chore/dev-restart-no`.
💬 **HARD HOLD** — local commit only; not pushed, no docker run.

## 2026-09-27 — Merge verified V1 wave → main (owner-actioned)

**In your words:** action one of the owner-gated items — you chose to merge the finished build into main.

✅ Done — **clean fast-forward** of `docs/tauri-wave-plan` (tip `811d60d`) into `main`. The whole project history — Phase 0 → scaffold → web core → mobile wave → OCR → every Full-Auto fix — now lives on `main` for the first time (previously just the init commit). Tree clean, checked out on `main`.
💬 Chose FF over squash (would have destroyed 100+ commits) and over `--no-ff` (the line was already linear, so no merge commit was needed).
💬 **HARD HOLD** — `main` has no upstream and nothing is pushed. Any push of `main` remains your explicit call.

## 2026-09-26 (late) — Full-Auto wave: RBAC drift, photo download, outbox hygiene, Files UX, ESLint 9, offline retry, Tauri plan

**In your words:** keep going in Full Auto through the ORQ lineup (grant drift → photo download → outbox hygiene → Files CONFLICT → ESLint 9 → Tauri scout).

✅ ORQ-27 — one canonical role-grant source (`@orqafy/shared/roles`) for the DB seed + web first-run; parity test. `d7e1e95`
✅ ORQ-32 — scoped photo byte-download route (uniform-404 anti-oracle, nosniff, assignee/oversight) + task-view thumbnails. `ec76903`
✅ ORQ-28 — mobile outbox hygiene (prune synced, re-drain, revive/retry, discard+file cleanup, orphan sweep, pending-photo badge + failed banner) + post-crash idempotent recovery (`photos.existsByClientId`). `d375fdf`,`a66a055`
✅ ORQ-33 — friendly CONFLICT handling + retry in the Files upload form. `07d53f5`
✅ ORQ-34 — ESLint 8→9 flat-config migration across all 10 workspaces; Rule-13 guard re-proven. `136d146`
✅ ORQ-35 — offline non-photo mutations now stay pending for retry (was failing on first drain). `ad8849c`
✅ Tauri desktop wave plan (R7a) — chunked build plan for the deferred desktop track. `cf35d88`
💬 All verified static+unit; gates re-run by PM. Live browser/device + live-curl deferred (no web server running, no device). HARD HOLD — nothing pushed; merge chain → main is the owner's call.
⏳ Next — no un-gated build work remains. Owner-gated: merge the chain to main, back-port D-28 into PRODUCT.md, greenlight the desktop track (R7a open [WHAT]s). Blocked (hardware/stack/tunnel): geofence-over-tunnel, sync resource-cost, Pangolin throughput, on-device chunk-5 + photo capture. Post-v1: R2 storage add-on, Valkey rate-limit store.

## 2026-09-26 — Field staff can now photograph a job site from the app (ORQ-23)

**In your words:** you answered the one open question (who may upload site photos) with option (a), then asked me to build photo capture end to end, with every task run by an Opus subagent.

✅ Done — **recorded your answer as D-28.** Field staff get a narrow "upload site photo for my task" permission, not general file management.
✅ Done — **built the server side.** A new `upload_photo` permission, a photo upload endpoint (`POST /api/photos`) that accepts either the phone's login token or the web session, and a `photos.create` step that attaches the photo to its task. Each photo carries a unique client id, so a retry never creates duplicates.
✅ Done — **had it attacked, then fixed what broke.** An independent review found four problems: someone who knew a photo's id could overwrite it (the most serious one), GPS locations were visible to users who shouldn't see them, an oversized upload could exhaust server memory, and two simultaneous uploads could collide. All four are fixed (merged at `c494f98`).
✅ Done — **built the phone side.** Camera screen, an "Add photo" button on My Tasks, a safe local copy so the OS can't delete the photo before it uploads, a GPS tag when available, and offline upload that retries when signal returns. On the way I fixed a real bug: before, any failed send was treated as final. Now temporary failures retry up to 25 times.
✅ Done — **closed the last hole in the overwrite fix.** Photo ids were sometimes generated from a weak random source that an attacker could predict. They now come from the phone's secure random generator, and the app refuses to create an id if that isn't available (`5b02b29`).
💬 Verification — type-checks, linting, and automated tests all pass (web 80, storage 23, mobile 125), and the web build and mobile config both succeed. **Honest limits:** I tested the server live *before* the security fixes but couldn't re-run those tests afterwards, and no real phone has touched any of this.
⛔ Blocked — **Docker Desktop on this machine can't publish ports right now** (`/forwards/expose … 500`). Restarting Docker Desktop should unblock the live re-test.
✅ Done — **live-verified the photo upload after the security fixes (ORQ-29).** I ran all 14 checks against the real server: phone login and web login, blocked overwrites, wrong-task and wrong-user uploads, missing or oversized length, GIFs, bad ids, the upload rate limit, who can see GPS, and a Files/dashboard regression. All pass. Evidence is in `test-artifacts/photo-upload-2026-09-26/post-hardening.md`.
🔴 Found — **photos between 10 MB and 15 MB are rejected.** The web app's middleware cuts request bodies off at 10 MB, so a legitimate 12 MB photo got an error and would be dropped by the phone. It's logged as a bug and not fixed yet.
✅ Done — **fixed the 10 MB upload cut-off (ORQ-31).** Next.js middleware keeps only the first 10 MB of any request it inspects. The photo and document upload routes now skip the middleware (they already check who you are themselves). Live: a 12 MB photo uploads, 17 MB is still refused, and a 20 MB document uploads. Sign-in is still required on all three routes (`47cf2ca`).
✅ Done — **closed the sensitive-document loophole (ORQ-26).** Each stored file can now belong to only one document, enforced by the database. Live: trying to re-file a payroll document as non-sensitive is refused, and a project manager without finance access still can't download it (`4a4f04c`, branch `fix/documents-spi-recommit`). Evidence: `test-artifacts/photo-upload-2026-09-26/orq31-orq26.md`.
💬 Mode — **you switched on Full Auto.** I'll work through the list below without stopping to ask; any product question goes to PENDING_DECISIONS.md and I keep going on the rest. There are no open questions right now.
⏳ Next, in order — (1) make the seed and first-run setup grant the same default permissions (ORQ-27), (2) a secure photo download route with thumbnails on the web task view (ORQ-32), (3) phone outbox cleanup and a pending-photo badge (ORQ-28), (4) a friendly error when the Files form hits a duplicate upload (ORQ-33), (5) ESLint upgrade (ORQ-34), (6) plan the Tauri desktop app.
💬 For you — (1) D-28 still needs to be copied into PRODUCT.md's Roles & Permissions section, which only you edit. (2) Merging `feat/mobile-photo-capture` into main is your call. Nothing is pushed.

## 2026-09-10 (chunk 5) — The mobile app's actual screens are built

**In your words:** you noticed the next tasks weren't on the Squirlnote board — add them there first, then do them.

✅ Done — **put the missing work on your board first.** Added three tasks to Squirlnote (the branch consolidation, chunk 5 core screens, and the loose security finding) plus a fourth for the photo-upload gap I found — all tagged, none moved into your Done lane.
✅ Done — **closed the loose security thread that was blocking the screens.** The chunk-4 review had a 4th finding nobody wrote down. I re-reviewed the code and found it: the app could send your password and login token over plain (unencrypted) network if pointed at a non-secure address. Judgement: acceptable for v1 (the internet-facing path already forces encryption via the tunnel, which isn't live yet), and I added three small safeguards — a warning when the address isn't secure, a stricter phone-keychain setting for the stored token, and a note in the docs.
✅ Done — **built the mobile app's core screens.** The app now has: a real login screen (before this there was none), a "My Tasks" list where a worker sees their assigned jobs and marks them done, a Notifications center, and an "Apply for Leave" screen — plus the offline plumbing so those actions still work with no signal and sync when it returns. I also wired the geofencing to only watch job sites *you're* assigned to during *your* shift — never every site.
🔨 Partial — **photo capture is deferred, on purpose.** The camera screen needs a server endpoint that doesn't exist yet, plus a permission decision about whether field staff can upload photos. Logged as its own task (ORQ-23) rather than guessing.
💬 Note — this was built by a team of sub-agents I directed (a scout to map the server contracts, then five builders), and I verified the combined result myself: type-checks, linting, and 64 automated tests all pass. **No real device was involved** (there's none here) — that testing waits on hardware. Everything is committed locally; nothing is pushed.
⏳ Next — photo upload (ORQ-23), on-device testing when hardware exists, then the Tauri desktop app (a separate wave).

## 2026-09-10 (later) — Branch consolidation: rate-limit folded into the mobile tip

**In your words:** (resumed from an empty handoff) — pick up where we left off; the standing next-step was "consolidate branches, then chunk 5."

✅ Done — **the two in-flight mobile branches are now one line again.** The login rate-limit work was sitting on its own side branch; I merged it back onto the main mobile branch so everything — offline data, auth, the geofence engine, the sign-out safety fix, and now the login protection — lives on a single tip (`2e10551`). The task queue's own edit history overlapped, but git reconciled it automatically with both sides' notes preserved.
✅ Verified — **re-checked the combined result, not just each half.** Ran the web type-checker (clean), the test suite (13/13 passing), and the linter (clean) against the *merged* tree, so nothing broke in the join.
💬 Note — the old side branch still exists locally (deleting it is blocked by the safety hook, and it's harmless once merged). Nothing pushed — HARD HOLD holds.
⏳ Next — **mobile chunk 5: the actual screens** (My Tasks, photo capture, apply-leave, notifications, and the login UI), plus wiring the empty offline "what-to-send" registry. One safety rule carries in: the app must only watch job sites assigned to *you*, during *your* shift. Also flagged: one geofence security-review point was never written down — re-check it before chunk 5.

## 2026-09-10 — Login brute-force protection + the geofence engine (mobile chunk 4)

**In your words:** resume the build → do the login rate-limit first → then start chunk 4.

✅ Done — **the mobile login door now resists guessing attacks.** Before this, someone could hammer the phone-login endpoint with unlimited password guesses. Now it counts attempts two ways: per internet address (every try) and per email address (only *failed* tries, cleared the moment you log in successfully). Cross either line and it replies "too many attempts" and tells the caller how long to wait — and it does this *before* touching the database, so an attacker can't even make us do work. Two deliberate touches: checking your account never counts against you (so nobody can lock you out just by probing your email), and if the counter itself ever breaks, it lets you in rather than locking everyone out.
✅ Done — **the geofence engine is built** — the piece that makes this product different. The app now tells the phone's operating system which job sites to watch, and the OS wakes the app when you arrive or leave. Because phones only report "arrived"/"left" and never "still here", I built the 3-minute "you actually arrived" delay on top: arriving quietly arms a 3-minute timer, leaving cancels it, and only if you're still there does it alert you. That means driving past a site won't ping you. It also only watches the 20 nearest sites (Apple's hard limit) and re-picks as you move.
✅ Done — **fixed a privacy bug I found in review:** logging out was leaving the job-site monitoring switched on. A signed-out phone would have kept announcing "you've arrived on site" for the previous user's sites, and an already-armed 3-minute alert could still fire after logout. Signing out now fully shuts the monitoring down — and so does an expired login, which had the same hole.

🔨 Partial — the mobile app itself: 4 of 5 build stages done (foundation, offline storage, login, geofencing). Stage 5 is the actual screens.

⏳ Next — **stage 5: the screens** (My Tasks, photo capture, apply for leave, notifications, and the login screen). Then a housekeeping merge to fold two side-branches back together.

💬 Notes / honest limits:
- **None of the geofencing has been tested on a real phone** — there's no device or simulator on this machine. Everything is proven by automated tests and type-checking (46 tests passing), which catches wiring and logic mistakes but *cannot* prove the OS actually wakes the app on a real site visit. That real-world test is still waiting on physical iPhone + Android devices, and it stays on the blocked list.
- The rate-limit counter currently lives in the app's memory, so it resets if the server restarts. That's fine while this runs as a single self-hosted process (it matches how the live-updates feature already works), and I logged the sturdier version as a later task if you ever run multiple copies.
- A background security review flagged 4 items on the geofence work. I fixed the one real bug (the logout leak), and explained why two others were correct as built. **The 4th item's details were never actually shown to me**, so I could not review it — if you can pull up that full report, I'll go through it.
- Everything is committed **locally only**. Nothing pushed, nothing deployed.

## 2026-09-10 — Mobile app: login / authentication (both ends)

**In your words:** continue the mobile wave (chunk 3 — auth).

✅ Done — **phones can now securely log in.** The web server got a new mobile-login door that hands back a signed token; the phone stores that token in the device's secure keychain and sends it on every request. Because phones can't use browser cookies (how the website logs in), this is the piece that makes the mobile app possible. The website's own login is completely untouched.
✅ Done — I built this carefully because it's security-sensitive: the token proves *who you are* but carries no powers of its own (your permissions are always looked up fresh from the database), it's cryptographically locked to one algorithm so it can't be forged, a deactivated user is rejected on every request, and wrong passwords return the same generic error so the endpoint can't be used to discover which emails exist.
✅ Done — **verified it for real, live**: I ran the app, logged in through the new mobile endpoint, got a token, used it to make an authorized request (came back with the user and their 10 permissions), and confirmed that no token or a fake token is refused. (No real password was ever shown on screen.) Plus 38 automated tests and a clean production build.
💬 Note — one security to-do I logged: the mobile-login endpoint needs rate-limiting (lockout after repeated bad attempts) before it's exposed beyond your own machine. Not urgent for local dev; required before real deployment.
⏳ Next — chunk 4: the geofencing itself — wiring the phone's background location to the arrival-alert engine we already built. This is the app's whole reason for being.

## 2026-09-09 — Mobile app: offline-first data layer

**In your words:** continue the mobile wave (chunk 2).

✅ Done — the mobile app can now **work with no signal and sync when it reconnects** — the core of "offline-first" for field staff. Built and tested: a durable **outbound queue** (every change you make offline — mark a task done, apply for leave, capture a photo — is saved locally with a unique id so the server never double-applies it and nothing is lost), and the **reconcile logic** that safely merges server updates back in (newest change wins; if the server changed something you'd also edited offline, it's flagged as a soft conflict rather than silently overwriting your work; deletes don't "come back from the dead"). All of this is **covered by 29 automated tests, all passing**.
✅ Done — the local-database layer (SQLite on the phone) is written and type-checks; it can't be *run* here without a device, but the logic that matters is the tested part above.
💬 Note — one honest simplification: the design doc asked for conflict resolution "per field", but our data only timestamps whole records, so I did it per-record and documented that. Revisit only if we later add per-field timestamps.
⏳ Next — chunk 3: mobile login. This needs a small **server-side** addition (the web app only supports browser-cookie login today; phones need a token), plus a tweak to the shared API client. Both were flagged earlier; I'll build them next.

## 2026-09-09 — Started the Expo mobile app (scaffold)

**In your words:** start the Expo mobile wave.

✅ Done — the **mobile app now exists as a real, buildable project** (`apps/mobile`). It's an Expo (SDK 54) app set up exactly the way the rest of the codebase expects — it reuses the shared geofence logic, API client, and design colors we already built, and can *only* talk to the backend through the API (never the database directly). The permissions needed for background geofencing (the whole reason for a native app) are wired in: iOS "Always" location + background mode, Android background location + the Android-14 foreground-service permission. It has a bottom tab bar (My Tasks / Calendar / Notifications) with themed placeholder screens as the shell.
✅ Done — verified it holds together: type-checks clean, lints clean, the Expo config resolves with all the permission plugins parsing, and no forbidden imports. (Note: there's **no phone/simulator here**, so "verified" means it compiles and configures correctly — actually feeling a geofence fire needs a real device, which is the separately-tracked hardware task.)
💬 Note — I wrote a durable plan for the whole mobile build at `docs/tasks/mobile-wave-plan.md`, broken into 5 chunks so it can span sessions. This was chunk 1.
💬 Note — two things I'll need to build on the *server* side when we get to mobile login (chunk 3): the web app currently only supports browser-cookie login, so mobile will need a token-based path; and the shared API client needs a small extension. Both flagged, neither blocks the next chunk.
⏳ Next — chunk 2: the offline-first data layer (local database cache + a durable queue so field staff can work with no signal and sync when they reconnect).

## 2026-09-09 — Production build unblocked (green)

**In your words:** resume the web-first build.

✅ Done — the **production build now completes cleanly**. The HIGH blocker I logged last session (Next.js choking on its default "404" page) **turned out to already be fixed** — it was a side-effect of the OCR TypeScript fix from that same session plus a stale build cache. I re-ran two clean production builds from scratch; both succeed, generate every page, and show zero of that error. No new code was needed for the 404 itself.
✅ Done — while there, I silenced the one remaining harmless build warning (a Valkey client BullMQ mentions but we never use) so the build output is clean. Verified the build still exits successfully and the parts that use the job queue still bundle.
💬 Note — one truly benign warning remains, from Auth.js's crypto library on the edge runtime; it has no runtime effect and any "fix" would be a hack into a third-party dependency, so I left it and marked it do-not-chase.
💬 Note — lesson carried forward: a blocker logged one session can be quietly fixed by unrelated work in the next — always re-reproduce before spending time on it.
⏳ Next — Expo mobile (Part 6) + Tauri desktop; each is big enough for its own session.

## 2026-09-09 — Document review-tray + OCR-text search UI

**In your words:** finish the remaining web scope — the review-tray screen (so a human can confirm/reassign the documents the auto-filer wasn't sure about) and a way to search documents by their extracted (OCR) text. The pipeline already produces the data; build the screens.

✅ Done — **Review tray** at `/review` (new sidebar entry): lists the documents awaiting review with their suggested filing + a confidence %, and lets you **Confirm** the suggestion or **Reassign** to a chosen project/client/category in one click. ✅ Done — **document search** on the Files page: a search box that filters documents by the text found inside them (case-insensitive). Both **verified working on the live app** (I logged in, reassigned the one pending document — it re-filed correctly and the tray emptied; searched "RANDOM"→1 result, "invoice"→2, a nonsense term→"no matches"), confirmed in the database and the server logs, screenshots saved.
✅ Done (necessary fix) — the production build was silently broken by a pre-existing TypeScript error in the OCR code (a Blob typing issue that only shows up through the web app's compiler). Fixed it so the build compiles and type-checks again.
💬 Note — the production `next build` **still fails at one more, unrelated, pre-existing step**: Next.js chokes generating its default "404" page (`<Html>` error). This never showed before because everything so far was verified in dev mode, never a full production build. It does **not** affect the feature (dev/live-verified) but it blocks a production/Docker image build. Logged as a HIGH agent-found item in TASK_QUEUE for a dedicated fix.
⏳ Next — Expo mobile (Part 6) + Tauri desktop (own sessions); and the `<Html>` production-build blocker above.

## 2026-09-09 — Document OCR + doc-matching pipeline

**In your words:** wire up the OCR + doc-matching processors so an uploaded document's text is extracted (offline, RapidOCR/Tesseract per R-5/D-13) and matched into the DocumentReview "match tray".

✅ Done — the two `@orqafy/jobs` processors are now real (were stubs). Upload → OCR → text persisted → auto-file to project on a confident code hit, else a pending review-tray row. Built offline RapidOCR sidecar (Docker profile), deterministic exact-ID matcher (no LLM), `createProcessors(deps)` seam, 15 unit tests. **Verified end-to-end on the live stack from the committed containers** (real upload → worker OCR → `PRJ-017` auto-filed as confirmed/0.95/invoice; a no-code doc → pending review). Evidence in `test-artifacts/ocr-e2e-2026-09-09/`.
✅ Done (bonus) — fixed the broken dev Docker rebuild (added a repo `.dockerignore` + `CI=true`; also unblocks the web image) and the OCR image's `libGL` crash. Closed 2 known backlog items.
🔨 Partial — n/a.
⏳ Next — Expo mobile (Part 6) + Tauri desktop (own sessions). Also queued: the review-tray + full-text-search **UI** surfaces (the pipeline now populates the data; the screens may not exist yet).
💬 Notes — 8 commits on `feat/document-ocr-matching` (tip `af0d71d`), all LOCAL (HARD HOLD, nothing pushed). Cross-scope: the new root `.dockerignore` also fixes `Dockerfile.app`'s latent build bug. No LLM in v1 per D-13; RapidOCR is the default engine, Tesseract the documented fallback (swap the sidecar, no TS change).

## 2026-09-09 — Self-hosted brand fonts

**In your words:** (autonomous loop) keep building the remaining web scope — the app was showing the brand
typefaces through a system-font fallback; bundle the real fonts into the app itself so there's no call out
to Google Fonts (matters for an offline-first, self-hosted, AGPL public product).

✅ **Done**
- The two brand typefaces — **IBM Plex Sans** (all UI text) and **JetBrains Mono** (figures/codes) — are now
  **bundled inside the app** and served from the app's own address. The page makes **zero external font
  requests** now — it works fully offline and carries no Google Fonts dependency.
- Only the font weights the UI actually uses were bundled (regular, medium, semibold), keeping the download
  tiny (~136 KB total). Both fonts are open-licensed (OFL); their license text ships alongside them.
- Verified end-to-end in a real browser: fonts load from the app's own server, nothing reaches out to Google
  or a CDN, and the login screen renders in IBM Plex Sans as intended.

💬 **Notes**
- Committed locally on `feat/self-hosted-fonts` (`0560001`) — HARD HOLD, nothing pushed.
- The SessionStart "3-tier RBAC retrofit" suggestion is a known false positive (Orqafy is single-org, D-5) —
  ignored, as stood down earlier.

⏳ **Next**
- Document OCR / matching processors (the `@orqafy/jobs` stubs — uploads already enqueue the OCR job).

## 2026-09-09 — Realtime board updates (live across clients)

**In your words:** (autonomous loop) keep building the remaining web scope — next was making the project
board update live across clients (realtime, D-22) so a change one person makes shows up for everyone
without a manual refresh.

✅ **Done**
- The project board now updates **live**. When someone adds or moves a task, everyone else viewing that
  same project sees it change **on their screen with no refresh**.
- Verified for real with **two browser windows** open on the same board: created a task in window A and it
  appeared in window B on its own, instantly. Both windows held a live connection the whole time; no errors.

💬 **Notes**
- Chosen delivery mechanism is **Server-Sent Events (SSE)** over the app's existing API, not a separate
  WebSocket server — it needs no extra process and works cleanly for a single self-hosted install. (Full
  reasoning in DECISIONS_LOG D-22 impl.)
- One honest limit for later: this works within a single running app instance. If you ever run several app
  copies behind a load balancer, realtime would need a small shared-message layer (Valkey) added — noted as
  a post-v1 item, not needed now.
- 🔨 The drag-and-drop *gesture* itself was already done last step; this step added the live cross-client
  syncing on top. (During testing, the automated drag tool didn't reliably simulate the drag, so I verified
  the live-sync path with a task create instead — it exercises the exact same realtime channel.)
- Committed locally on `feat/web-realtime-sse` (nothing pushed — HARD HOLD).

⏳ **Next:** self-hosted woff2 fonts (bundle the brand fonts locally), then the Document OCR/matching
processors (still stubs).

## 2026-09-09 — Live kanban drag-drop on the project board

**In your words:** (autonomous loop) keep building the remaining web scope — next up was wiring real
drag-and-drop on the project board (it was a static placeholder).

✅ **Done**
- The project board is now **draggable**: you can pick up a task card and drag it into another column
  (To do / In progress / Blocked / Done) to change its status. The card jumps to the new column
  immediately (optimistic), and if the save ever failed it would snap back.
- Verified for real in the running app: dragged a card from To do into Blocked, the move saved to the
  database, and it stayed there after a full page reload. No errors.

💬 **Notes**
- Built on the `@dnd-kit` library (added to the shared UI package) reusing the existing board look — no
  restyle, just the drag behaviour and subtle drag/hover cues. Uses the existing `tasks.move` API.
- Committed locally on `feat/web-kanban-dnd` (`c43ed89`). Nothing pushed (HARD HOLD).
- Two **infra footguns found while verifying** (logged, not fixed — out of scope): the Docker dev image
  rebuild fails (`pnpm` refuses to purge node_modules with no TTY), and there is no `.dockerignore`, so
  the host `node_modules` is copied into the build context. Verification used the host hot-reload dev
  path instead (the supported path — `.env.dev` is already host-shaped).

## 2026-09-09 — Leaflet map picker for task geofence

**In your words:** (autonomous loop) keep building the remaining web scope — next up was the Leaflet map picker.

✅ **Done**
- Built an interactive **map picker** for setting a task's geofence location. On the task form you can now
  click or drag a pin on a real map to place the site anchor, and a circle shows the alert radius as you change
  it. The map uses OpenStreetMap tiles (swappable via an env setting), and the numeric lat/lng/radius fields
  stay in sync with the map.
- Verified it for real in the running app (not just a build): the map loaded with all tiles, a click set the
  coordinates, the radius drove the circle, and the created task's location saved correctly to the database.

💬 **Notes**
- The map library only runs in the browser (it crashes if loaded on the server), so it's loaded client-side
  only — this also avoids re-introducing an earlier first-run crash.
- Committed locally on `feat/web-map-picker` (`93008dc`). Nothing pushed (HARD HOLD).
- The start-of-session RBAC-retrofit suggestion was a **false positive** and was stood down again — it doesn't
  apply here (single-company install, D-5).

⏳ **Next**
- Remaining web polish: live drag-drop on the kanban board, realtime updates, and self-hosted fonts. Then the
  document OCR/auto-filing processors, then the mobile + desktop apps as their own waves.

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
