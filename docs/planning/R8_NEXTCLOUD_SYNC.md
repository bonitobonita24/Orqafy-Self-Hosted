# R-8 · Continuous Nextcloud sync from a Tauri Rust sidecar

> **Status:** RESEARCH COMPLETE — recommendation pending owner acceptance. `[HOW]`, agent-owned.
> **Researched:** 2026-09-08. **Sources:** context7 (`/nextcloud/documentation`,
> `/nextcloud/desktop`, `/websites/nextcloud_server_developer_manual`), fetched 2026-09-08.
> **Resolves the D-14 OPEN CAVEAT:** "the headless client is understood to be one-shot rather than a
> continuous daemon." **Reads:** `docs/DECISIONS_LOG.md` (D-8, D-11, D-14, D-10a), `docs/planning/R3_FILE_SYNC.md`,
> `docs/planning/R3b_FILE_SYNC_REVISED.md`.
> **Scope note:** engine choice is NOT reopened — D-14 keeps Nextcloud. This settles only *how* our
> Tauri client drives continuous background sync against it.

---

## 0. The question

D-14 bundles Nextcloud's **headless CLI client (`nextcloudcmd`)** and supervises it from the Tauri
Rust sidecar (D-11), so the user sees one app and we write no sync engine. The caveat: `nextcloudcmd`
is believed to be **one-shot** (one pass, then exit), not a resident daemon. If true, continuous
background sync is something we must orchestrate. This pass (1) confirms the one-shot behaviour,
(2) compares three ways to get continuous sync from a Rust sidecar, (3) recommends one for v1.

---

## 1. Is `nextcloudcmd` one-shot? — CONFIRMED

**Yes. `nextcloudcmd` performs a single synchronization run and then exits; it does not watch the
filesystem and does not repeat on its own.** Verbatim from the Nextcloud user manual:

> "The nextcloudcmd tool is a command-line client designed to synchronize files between a Nextcloud
> server and a local machine. Unlike the GUI-based client, it performs a single synchronization run
> to align directories and then exits. **It does not monitor for file system changes or perform
> recurring background synchronizations.**"
> — [user_manual/desktop/commandline.rst](https://docs.nextcloud.com/server/latest/user_manual/en/desktop/commandline.html) (via context7 `/nextcloud/documentation`, 2026-09-08)

**No daemon / interval / watch mode exists.** The documented option surface is limited to:
`--path <remote>`, `--user` / `--password` (or credentials in the URL), `-n` (netrc),
`--non-interactive` (reads `NC_USER` / `NC_PASSWORD` from the environment, never prompts),
`--exclude <file>`, `--httpproxy`, and `--silent`
([admin_manual/desktop/commandline.md](https://docs.nextcloud.com/server/latest/admin_manual/desktop/commandline.html),
context7 2026-09-08). **There is no `--daemon`, `--interval`, `--watch`, or `--loop` flag documented.**
The continuous engine — a filesystem `_folderWatcher` plus periodic full local discovery — lives in the
**GUI client**, not in `nextcloudcmd`: see the branch logic in
[`src/gui/folder.cpp` `slotStartSync()`](https://github.com/nextcloud/desktop/blob/master/src/gui/folder.cpp)
(`_folderWatcher && _folderWatcher->isReliable()` → read from DB; else full filesystem scan) — context7
`/nextcloud/desktop`, 2026-09-08. That watcher is GUI-tier code; `nextcloudcmd` links none of it.

**Conclusion:** the D-14 caveat is real. Continuous sync must be orchestrated by us. `nextcloudcmd`
is a correct, self-contained **single-pass sync primitive** we invoke — the hard sync logic (csync
diff/transfer/conflict, plus a restart-safe sync journal `.sync_*.db` it keeps in the local folder)
is inside it; the *scheduling* is ours.

---

## 2. Three approaches to continuous sync from the Rust sidecar

| | **(a) Supervise `nextcloudcmd`** (interval + fs-watch trigger) | **(b) Drive the full desktop client headless** | **(c) WebDAV sync in our own client** |
|---|---|---|---|
| **What runs** | Rust sidecar spawns `nextcloudcmd` per project folder on a debounced fs-watch event and on a periodic timer; serialized behind a per-folder lock | The Qt GUI client (`nextcloud`) run without a visible session, its account/folder config written by us | Our TypeScript/Rust code talks WebDAV to the Nextcloud server directly; we implement scan/diff/transfer/conflict |
| **Sync correctness owner** | **Nextcloud (csync)** — we own none of it | **Nextcloud (full engine + watcher)** — we own none of it | **Us** — the entire two-way engine |
| **D-14 / SEED_BRIEF §4.4 fit** | ✅ exactly D-14; no engine written | ✅ no engine written, but see viability | ⚠️ this is D-10a option (b); a real engine build |

### 2.1 Trade-off matrix

| Axis | **(a) Supervise `nextcloudcmd`** | **(b) Headless full client** | **(c) Own WebDAV engine** |
|---|---|---|---|
| **Latency — local→remote** | Low. fs-watch (debounced) fires a run within seconds of a local change. | Lowest. Resident watcher reacts continuously. | Lowest achievable (we control it). |
| **Latency — remote→local** | **Poll-bound.** `nextcloudcmd` has no push subscription; a server-side change is seen only on the next timed run (= poll interval). Mitigable — see §3.1. | Low. GUI client can subscribe to the server **notify_push** ("Client Push") app for near-instant remote-change signals. | Low if we subscribe to notify_push ourselves; otherwise poll. |
| **Reliability** | Good. Each run is stateless-process but state-durable via csync's journal → restart/crash-safe. **Must serialize** (one run per folder; a second spawn mid-run can corrupt the journal) and add failure back-off. | Fragile in a headless posture (see §2.2) — the risk is the *supervision*, not the sync. | Engine correctness is ours to guarantee on a firm's **only copy of its drawings** — the highest-stakes failure mode. R-3b priced this at **4–7 months + an open-ended correctness tail**. |
| **Revision-history fidelity** | **Full.** Versioning is a **server-side** Nextcloud Versions-app function on every write; the client only transfers. Identical to the GUI. List/restore via the WebDAV Versions API (our UI, same for all three). | **Full** (same server-side mechanism). | **Full** (same server-side mechanism — every PUT is versioned server-side regardless of client). |
| **Resource cost** | **Lowest.** A process spawned per interval, idle between runs; no resident RAM. | Highest of the three on the client — a resident Qt app (+ a virtual display / hidden session) per machine. | Light resident client. |
| **Code we must own** | Supervising loop, debounced fs-watch, per-folder lock/serialize, back-off, progress/exit-code parsing, per-project folder→invocation config. **Modest — days, not months.** | Config-file generation + process supervision for an app not built to be driven this way; brittle, upgrade-sensitive. | **The whole sync engine**: scan, hash index, diff/plan state machine, conflict semantics, rename/tombstone detection, Unicode/path-length normalisation, resumable transfer. §6.3 of R-3b. |
| **Verdict** | ✅ **Recommended for v1** | ⛔ Reject — not a supported posture | 🅿️ Documented fallback (D-10a b), only if (a) proves inadequate |

### 2.2 Why (b) is rejected

The full desktop client is a **Qt GUI / system-tray application** designed to run inside a logged-in
desktop session. **No supported headless / service mode is documented** — the continuous engine is
wired to GUI-tier code (`src/gui/folder.cpp`, `src/gui/folderwatcher*`; context7 `/nextcloud/desktop`).
Running it without a session means standing up a virtual display and a hidden window, and its
account/folder state lives in its own config plus the OS keychain, with **no clean external API** to
provision one folder per project from our sidecar — we would be writing and patching its private config
files and restarting it, a posture that breaks on every client upgrade. It also re-introduces the
second-account model D-14 exists to avoid. The one thing it buys over (a) — a resident remote-change
watcher — is obtainable in (a) far more cheaply (§3.1). **High fragility for a low marginal gain; not
v1-worthy.**

### 2.3 Why (c) is the fallback, not the pick

(c) is the only approach whose **correctness is ours to own**. R-3b §6.3 priced a trustworthy two-way
engine at **~4–7 months plus an open-ended tail**, on the component whose failure mode is *losing a
firm's only copy of its contract drawings*. It contradicts the spirit of "never hand-write a sync
engine." It stays the explicit fallback (D-10a option b) — reached only if (a)'s poll-latency or
per-folder supervision proves unworkable — precisely because the WebDAV substrate is capable: the
Nextcloud dev manual documents **PROPFIND** with `{DAV:}getetag`, `oc:fileid` and `{DAV:}getlastmodified`,
plus RFC-5323 **SEARCH** for "files modified after `<date>`" and "get a file by `oc:fileid`"
([developer_manual/client_apis/WebDAV/search.html](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/search.html),
context7 2026-09-08). That gives both change detection and the **stable per-file ID (RQ-5)** for free —
the effort is the sync *state machine*, not the protocol.

---

## 3. RECOMMENDATION — v1

> ### **Approach (a): supervise `nextcloudcmd` from the Tauri Rust sidecar — a debounced filesystem-watch trigger plus a periodic timer, serialized behind a per-project-folder lock.**

**Rationale, in order:**

1. **It is exactly what D-14 chose, made continuous — and it writes zero sync-engine code.** csync's
   diff/transfer/conflict logic and its restart-safe journal do the hard, high-stakes work; we own only
   *when* to run it. This is the "adopt, don't build the sync engine" rule honoured.
2. **Least owned code by a wide margin** — a supervising loop, a debounced watcher, a lock, and back-off:
   days of work, all inside the D-11 Rust sidecar surface (its stated purpose is exactly this kind of
   supervision). (c) is months; (b) is fragile config-poking.
3. **Restart-safe.** The one-shot nature is not a reliability problem: state lives in the local sync
   journal, so a crashed or killed run resumes cleanly on the next spawn.
4. **Revision history is unaffected** — it is a server-side function; (a), (b), (c) are identical here.
5. **Lowest client resource cost** — no resident sync process, which matters for the modest office
   hardware and rural boxes this product targets.

**Accepted cost:** **remote→local latency is poll-bound** (a change made on the server or another
device appears locally only on the next timed run). For a construction-drawings workflow a **30–60 s
interval** is an acceptable v1 default; local→remote is near-instant via the fs-watch trigger.

### 3.1 Recommended refinement (still no engine written)

Collapse the download-direction latency by having the sidecar **subscribe to the server's `notify_push`
("Client Push") websocket** and fire an immediate `nextcloudcmd` run on a remote-change signal, instead
of waiting for the timer. This gets near-GUI responsiveness while keeping csync as the sync primitive.
⚠️ Whether an independent subscriber (not the GUI client) can consume `notify_push` cleanly is
**unverified here** (§5) — so ship the plain timer + fs-watch first; treat notify_push as a fast-follow.

### 3.2 Engineering checklist for (a)

- **One invocation per project folder** (or one per parent with `--path` scoping), each with its own
  local dir + remote path; credentials via `--non-interactive` + `NC_USER`/`NC_PASSWORD` env (never in
  argv — argv is visible in the process table and shell history, per the manual's own warning), or a
  per-user app-password minted by our backend.
- **Per-folder mutex** — never let two `nextcloudcmd` runs touch the same folder/journal concurrently.
- **Debounce** the fs-watch (e.g. `awaitWriteFinish`-style) so still-copying large CAD files don't
  trigger mid-write runs; coalesce bursts into one run.
- **Exponential back-off** on non-zero exit; surface persistent failure to the UI.
- **Parse exit code + `--silent` output** for progress/error state feeding the app's change feed.
- Keep every call behind the R-3 §11.1 **`FileSyncProvider`** port so the fallback to (c) stays a swap.

**Fallback trigger:** if the poll interval proves too slow *and* notify_push cannot be wired, escalate
to **(c) / D-10a option (b)** — WebDAV sync in our own client — as a scoped, owner-gated build. Not
before; (c) is a months-long engine, not a tweak.

---

## 4. Citations

| Claim | Source (via context7, fetched 2026-09-08) |
|---|---|
| `nextcloudcmd` does one sync run then exits; does not monitor fs or recur | `/nextcloud/documentation` → [user_manual/desktop/commandline.rst](https://docs.nextcloud.com/server/latest/user_manual/en/desktop/commandline.html) |
| `nextcloudcmd` option surface (`--path`, `--user/--password`, `-n` netrc, `--non-interactive`+`NC_USER`/`NC_PASSWORD`, `--exclude`, `--httpproxy`); credentials-in-URL warning | `/nextcloud/documentation` → [admin_manual/desktop/commandline.md](https://docs.nextcloud.com/server/latest/admin_manual/desktop/commandline.html) |
| Continuous watcher lives in the GUI client (`_folderWatcher`, periodic full local discovery) not the CLI | `/nextcloud/desktop` → [src/gui/folder.cpp `slotStartSync()`](https://github.com/nextcloud/desktop/blob/master/src/gui/folder.cpp) |
| WebDAV change-detection + stable file ID substrate for (c): PROPFIND `getetag`/`oc:fileid`/`getlastmodified`; SEARCH "modified after date" / "by fileid" | `/websites/nextcloud_server_developer_manual` → [WebDAV/search.html](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/search.html), [WebDAV/index.html](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/index.html) |
| Revision list/restore API (MOVE into `…/restore`) — used by the version UI in all three approaches | R-3 §5 (Nextcloud WebDAV Versions dev manual); not re-fetched this pass |

---

## 5. Unverified / gaps (do not treat as fact)

1. **No exhaustive `nextcloudcmd(1)` man page was retrieved** — the "no daemon/interval/watch flag"
   conclusion rests on the option list in the admin/user manuals plus the explicit "single run then
   exits" statement. A hidden/undocumented looping flag is not expected but was not exhaustively ruled
   out against the built binary's `--help`. **Verify with `nextcloudcmd --help` on the actual bundled
   binary before locking.**
2. **`notify_push` ("Client Push") consumed by an independent subscriber** (our sidecar, not the GUI
   client) — feasibility, auth model, and reconnection behaviour are **unverified**. §3.1 is a
   fast-follow, not a v1 dependency.
3. **`nextcloudcmd` bundled-binary footprint** on Windows/macOS (Qt + OpenSSL deps) — R-3b's ~40–90 MB
   was an estimate; measure the real redistributable set for the Tauri installer.
4. **Journal-corruption behaviour under concurrent runs** — the per-folder mutex requirement is derived
   from how csync keeps state; not stress-tested here. Validate the locking under rapid fs-change bursts.
5. **Per-project scaling** — many project folders = many `nextcloudcmd` invocations; the cost of N
   parallel/serialized runs on the target box is unmeasured. Measure at realistic project/file counts.
6. **App-password vs OIDC** for the sidecar's credentials (R-3 B-1) is out of scope here and still open.
7. Everything R-3 §12 and R-3b §14 flagged that this pass did not revisit remains flagged.

---

*Primary sources fetched via context7 on 2026-09-08: `/nextcloud/documentation` (user + admin manual
`commandline`), `/nextcloud/desktop` (`src/gui/folder.cpp`, `sync-exclude.lst`),
`/websites/nextcloud_server_developer_manual` (WebDAV search + index). Items marked ⚠️ or listed in §5
are unverified.*
