# R-3b · File-Sync Engine — RE-RUN under the desktop-client / single-language constraints

> **Status:** RESEARCH COMPLETE — recommendation pending owner acceptance. `[HOW]` with one `[WHAT]` edge
> (§13). **Researched:** 2026-09-06.
> **Supersedes:** the *recommendation* in `docs/planning/R3_FILE_SYNC.md` **if accepted**. R-3 is left
> untouched and remains the record of the pre-constraint analysis; its licence matrix, project-health
> table and §11.1 `FileSyncProvider` port all still stand and are not re-derived here.
> **Reads:** `docs/SEED_BRIEF.md`, `docs/planning/R3_FILE_SYNC.md`, `docs/DECISIONS_LOG.md`,
> `docs/planning/R1a_PANGOLIN_SIZING.md`.

---

## 0. Why this re-run exists

R-3 was researched before three requirements existed. Each one attacks a different load-bearing part of
its reasoning.

| # | New constraint | What it invalidates in R-3 |
|---|---|---|
| **NC-1** | **Desktop client apps for Windows + macOS are in scope** — installable, FennecNotes-style, **our** app. Client only; the server stays Docker Compose (**D-3 stands**). | R-3 §6 scored engines on *the vendor's* desktop client. That column is now **worth nothing** unless the vendor's client can *be* our app — which none of them can. Nextcloud's single biggest advantage evaporates. |
| **NC-2** | **Mobile Android + iOS required**, sideload/self-build (**D-6**). | Nothing. R-3 §7 already concluded the Expo app must not embed a sync client. That conclusion survives intact and is re-affirmed in §9. |
| **NC-3** | **One programming language across the product — TypeScript.** Frameworks may differ per platform (Next.js / desktop shell / Expo); the language is one. | R-3's primary pick is a **PHP** application. Wrapping it over HTTP writes no PHP — but it puts a PHP runtime, a web tier, a second database and a cron loop into the product we ship and support. |
| **NC-4** | *(carried, not new)* **D-5 single-company install**; RBAC is role-per-user in one org, scoped to projects. | Softens R-3's RQ-2 weighting: there is no tenant dimension to enforce, only "members of project P". |

**The reframing in one line:** R-3's decisive sentence was *"Nextcloud already has the thing we cannot
cheaply build — a server-authoritative user/group permission system."* Under D-5 we are **building that
permission system anyway** — it is the PM module's `ProjectMember` table. The thing we genuinely cannot
cheaply build is **the sync engine**. R-3 optimised for the wrong scarce resource.

---

## 1. The three options, defined precisely

| | **A · Nextcloud** | **B · Syncthing** | **C · Our own API** |
|---|---|---|---|
| **Server** | `nextcloud` container (PHP-FPM + web + own DB + cron) beside our stack; Team folder per project | `syncthing` container; **one Syncthing folder per project**; config driven from our backend over its REST API | Our tRPC API + MinIO/S3 only. No new service. |
| **Desktop** | Our TS app must **either** ship the Qt client alongside (second app, second login) **or** drive `nextcloudcmd` **or** write a WebDAV sync engine | Our TS app (Tauri/Electron) **embeds the Syncthing binary as a sidecar** and drives it over `localhost` REST; our UI, our login, one installer | Our TS app contains a sync engine **we write** |
| **Authority** | Nextcloud users/groups, replicated from our RBAC | **Our DB** → server-side Syncthing folder↔device-ID sharing | Our DB directly |
| **Storage shape** | Plain files under `data/` | Plain files on disk / NAS | S3 objects in MinIO |
| **Brief compliance** | ✅ adopt-don't-build (SEED_BRIEF §4.4) | ✅ adopt-don't-build (§4.4's *original prior*) | ❌ **directly contradicts §4.4** — "Full bidirectional file sync is its own product… never hand-write a sync engine." C needs a decision that supersedes §4.4. |

**A's sub-variants matter and are scored separately below**, because NC-1 forces the choice:

- **A1 — ship the Nextcloud Qt client too.** Two installers, two logins, C++/Qt UX we do not control. Fails the FennecNotes-style single-app requirement outright.
- **A2 — sidecar `nextcloudcmd`.** Documented behaviour: *"nextcloudcmd performs a single sync run and then exits… it does not repeat synchronizations on its own. It also does not monitor for file system changes"* ([Nextcloud user manual](https://docs.nextcloud.com/server/stable/user_manual/en/desktop/commandline.html), [nextcloudcmd(1)](https://manpages.debian.org/trixie/nextcloud-desktop-cmd/nextcloudcmd.1.en.html)). So we rebuild watching, scheduling, back-off and progress reporting ourselves, and lose Virtual Files.
- **A3 — write our own WebDAV sync engine against the Nextcloud server.** This is **option C's engineering cost plus a PHP server**. Strictly dominated; not scored further.

---

## 2. Criterion 1 — bundling into a Windows/macOS installer

Nothing in Nextcloud's *server* burden lands in the installer — D-3 keeps the server in Compose. The
installer question is only: **what must ship inside the desktop app**.

| | **A1** (Qt client alongside) | **A2** (`nextcloudcmd` sidecar) | **B** (Syncthing sidecar) | **C** (all ours) |
|---|---|---|---|---|
| Sidecar binary | — (separate installer) | `nextcloudcmd` + Qt/OpenSSL deps ≈ **40–90 MB** *(unverified — measure the actual redistributable set)* | **Syncthing v2.1.3**: win-amd64 **11.5 MB**, macOS-universal **22.6 MB** (GitHub release assets, fetched 2026-09-06) | none |
| Shell — **Tauri v2** | n/a | ~5 + sidecar | **~5 MB** → **~17 MB (Win) / ~28 MB (macOS)** | **~5 MB** |
| Shell — **Electron** | n/a | ~100 + sidecar | ~100 MB → **~112 / ~123 MB** | **~100 MB** |
| Installers the user runs | **2** | 1 | **1** | **1** |
| Logins the user types | **2** (ours + Nextcloud) | 1 (we mint an app-password behind the scenes) | **1** (ours) | **1** (ours) |
| Non-technical install flow | install ours → install Nextcloud → find server URL → log in again → pick folders | install → log in → we shell out per sync run | **install → log in → project folders appear** | **install → log in → project folders appear** |
| Verdict | ❌ fails NC-1 | 🟡 possible, ugly | ✅ **best** | ✅ best |

Shell sizes: Tauri "hello world" ~3.2–5 MB vs Electron ~85–150 MB — Tauri uses the OS WebView, Electron
ships Chromium ([Tauri vs Electron 2025/26 comparisons](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/),
[levminer](https://www.levminer.com/blog/tauri-vs-electron)); Tauri's [sidecar/`externalBin`](https://v2.tauri.app/develop/sidecar/)
mechanism is the documented, first-class way to embed a foreign binary per target triple.

**Server-side install complexity, for completeness (Compose, not the installer):**

| Option | Extra containers | Extra datastore | Extra image pull |
|---|---|---|---|
| **A** | nextcloud (web+PHP-FPM) + cron | **yes** — its own DB schema + a Redis/Valkey | `nextcloud:stable` **≈ 530 MB compressed** (Docker Hub API, 2026-09-02) |
| **B** | syncthing | **no** (own SQLite index) | `syncthing/syncthing:latest` **≈ 18 MB compressed** (2026-08-05) |
| **C** | none | no | 0 |

For a desktop-as-server box already running Postgres (~155 MB) + MinIO (~59 MB) + Valkey + our app, A adds
more image weight than the rest of the stack combined.

---

## 3. Criterion 2 — language discipline (NC-3)

The rule is about **code we author and must maintain**. A shipped third-party binary is a dependency, in
the same class as Postgres — nobody claims Postgres makes us a C shop. Judged on both axes:

| | Non-TS code **we write** | Non-TS **toolchain in our build** | Non-TS runtime **we ship and must support** |
|---|---|---|---|
| **A** | none | none | **PHP-FPM + a web server + a second DB + cron**, on every install, forever. Any server-side extension (a Nextcloud app, a custom versioning hook, an auth backend tweak) is **PHP** — and B-1/B-5 in R-3 are exactly the places that pressure appears. |
| **B** | none | none (fetch the release binary in CI) | **one static Go binary**, no runtime, no config language, driven purely over HTTP+JSON |
| **C** | none | none | none |
| **Tauri shell** *(applies to B and C equally)* | **~50–300 lines of Rust glue** + a Rust toolchain in CI | **yes — Rust** | Rust-compiled binary |
| **Electron shell** *(applies to B and C equally)* | **none — Node/TS end to end** | none | Node |

**Honest reading:** on "code we write", **B and C are tied and A is also technically clean** — the
difference is that A makes PHP a permanent operational surface of an AGPL product third parties will
self-host and file bugs against. The sharper NC-3 tension is not A-vs-B at all: it is **Tauri vs Electron**.
Tauri is the only thing in the running that puts a *second language we author* in the tree.

> **Sub-decision, folded in:** take the ~15 MB Tauri win *or* strict single-language purity with a ~110 MB
> Electron installer. Recommended: **Tauri**, treating the Rust glue as configuration-scale (spawn sidecar,
> tray, auto-start, single-instance) — but this is a genuine, owner-visible trade, listed in §13.

---

## 4. Criterion 3 — per-user, project-scoped access control, enforced server-side

### 4.1 The skeptical question, answered

The brief's challenge: *a client-side constraint is not a security boundary if the protocol lets a modified
client request other folders.* This was checked against the protocol spec **and the reference
implementation's source**, not from memory.

**Verdict: Syncthing's folder access model CAN be made server-authoritative for "which folders a device may
read or write". The check runs on the SERVING side, not the requesting side.**

Evidence:

| Layer | Finding | Source |
|---|---|---|
| Authentication | *"the certificate fingerprint of each device is compared to a preset list of acceptable devices at connection establishment"* — TLS 1.3, SHA-256 fingerprint = Device ID | [Security Principles](https://docs.syncthing.net/users/security.html), [BEP v1 Transport & Authentication](https://docs.syncthing.net/specs/bep-v1.html) |
| Announcement | Cluster Config's `folders` field = *"the list of folders that will be synchronized over the current connection"*; each folder carries `devices`, *"a list of devices participating in sharing this folder"* | [BEP v1 — Cluster Config](https://docs.syncthing.net/specs/bep-v1.html) |
| Docs-level request check | *"Incoming requests for file data are verified to the extent that the requested file name must exist in the local index and the global model."* (weaker than an ACL statement — see caveat) | [Security Principles](https://docs.syncthing.net/users/security.html) |
| **Implementation-level request check** | `lib/model/model.go`, `func (m *model) Request(...)`, **line 1982** of `main` (fetched 2026-09-06): `if !folderCfg.SharedWith(deviceID) { slog.Warn("Request for file in unshared folder", …); return nil, protocol.ErrGeneric }` — plus an unknown-folder reject at 1975, paused-folder reject at 1986, internal-name and ignore-pattern rejects, and symlink-traversal checks | [syncthing/syncthing `lib/model/model.go`](https://github.com/syncthing/syncthing/blob/main/lib/model/model.go) |

So a **modified, hostile client cannot pull a folder that our server-side instance has not shared with its
device ID**. The enforcement point is a config file we own, on a machine we own, reachable only via an API
key the end user never sees. That is a real boundary, not a client-side courtesy. **R-3's stated objection
does not survive contact with the source.**

### 4.2 …but be precise about what that boundary is NOT

| Property | A · Nextcloud | B · Syncthing | C · Ours |
|---|---|---|---|
| "User sees only their assigned projects" | ✅ user/group ACL | ✅ **folder × device-ID, enforced by the serving instance** | ✅ our `ProjectMember` check on every request |
| **Principal is a person** | ✅ | ⚠️ **a device keypair.** `User → Device[]` is *our* table; if a user copies their Syncthing key to a second machine, that machine is the same principal. Equivalent in kind to token/password sharing, but we do not get to reason about "a user" at the protocol layer. | ✅ |
| **Per-user read-only** | ✅ permissions bitmask on the share | ❌ **Cannot.** Folder type (Send Only / Receive Only) is a per-folder setting on each *side*; there is no per-peer permission. Any member who can see a project folder can write to it. | ✅ trivially |
| Per-file / sub-folder permissions | ✅ | ❌ folder is the atom (fine — one folder per project matches the model) | ✅ |
| Revocation of *future* sync | ✅ | ✅ remove device from folder → server refuses requests immediately | ✅ |
| Revocation of *already-synced bytes* | ❌ | ❌ | ❌ |
| Rogue peer-to-peer leak *between members* | n/a | ⚠️ a user could reconfigure their **own local** instance to share a folder they already hold with an outsider — but they already have the bytes on disk, so this is the USB-stick threat, not a new hole | n/a |
| Auto-mount new projects without user action | ✅ | ✅ `autoAcceptFolders` on the server device + `defaultFolderPath` in our client's config ([config reference](https://docs.syncthing.net/users/config)) | ✅ |
| Enrolment friction | login | **zero** — R-3 feared a 63-char device-ID copy-paste; because **we ship the client**, it reads its own device ID from the local REST API and POSTs it to our tRPC on login. NC-1 deletes this objection. | zero |

**Net:** the *hard* requirement (a user sees only their projects, decided by our server) is met by all three.
The *soft* one (per-user read-only) is met only by A and C. That gap is real and must be an owner decision,
not an agent one (§13).

---

## 5. Criterion 4 — file revisioning

| | **A · Nextcloud** | **B · Syncthing** | **C · Ours (MinIO/S3)** |
|---|---|---|---|
| Mechanism | Versions app, automatic on write | Per-folder versioning to `.stversions/` — Trash Can · Simple · **Staggered** (30s→hourly→daily→weekly, `maxAge=0` = forever) · External ([docs](https://docs.syncthing.net/users/versioning.html)) | **S3/MinIO bucket versioning** — every PUT is a new `versionId` |
| Retention policy | `versions_retention_obligation` in `config.php` | ✅ rich, per folder, set through the same REST config call | ✅ object lifecycle rules |
| **API to list/restore** | ✅ real API: WebDAV `/remote.php/dav/versions/<user>/…`, restore = `MOVE` into `…/restore` ([docs](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/versions.html)) | ⚠️ **no API.** Versions are timestamped files (`file~20260906-141530.ext`) — **but they sit on OUR server's disk**, so listing = `readdir` + filename parse and restore = copy-back, in our own Node process. Not an integration; a directory walk. Must handle the staggered pruner racing us. | ✅ `ListObjectVersions` / `GetObject?versionId` — first-class, typed, in the AWS SDK we already use |
| Version *UI* | ours to build | ours to build | ours to build |
| **Verdict** | ★★★ | ★★ (mechanism excellent, access is filesystem-level) | ★★★ |

R-3 called B's approach "a filesystem hack we own". Under NC-1 that reads differently: the `.stversions`
tree is on the server we control, in the same container namespace as our app — the same place R-3 was happy
to let us mount the NAS. It is ~150 lines of Node, not a subsystem.

---

## 6. Criterion 5 — what we build ourselves, honestly

### 6.1 Common to all three (unchanged from R-3, restated)

Attachment model keyed to a stable file identity · project↔folder lifecycle · change feed so files feel
part of the app · revision UI · onboarding page · NAS placement + backup (R-2) · the documented
"already-synced bytes are not revocable" limitation.

### 6.2 Per-option delta

| | **A** | **B** | **C** |
|---|---|---|---|
| Identity bridge (2nd user store / OIDC or app-passwords) | ✅ **required — R-3's B-1, its own stated biggest integration risk** | ❌ none (device registry instead) | ❌ none |
| Permission reconciler (BullMQ, idempotent, drift-healing) | ✅ required | ✅ required — *same shape, same cost*, calling `POST/PATCH/DELETE /rest/config/folders/{id}` with `X-API-Key` ([REST API](https://docs.syncthing.net/dev/rest.html)) | ❌ none — our own authz *is* the check |
| Device registry + enrolment | ❌ | ✅ small: `Device { id, userId, label, lastSeen }` + auto-enrol on login | ❌ |
| Desktop **sync engine** | **A1** ❌ / **A2** rebuild watch+schedule / **A3** = C's cost | ❌ **none — this is the whole point** | ✅ **all of it** |
| Stable per-file ID | Nextcloud file ID | path + our own ID sidecar file / DB mapping (moves need care) | ours by construction |
| Version browser | over a real API | over the filesystem | over S3 versions |

### 6.3 Option C priced properly — the sync engine, one engineer

| Sub-system | TS building blocks that genuinely help | Estimate | Shortcut? |
|---|---|---|---|
| Watch + rescan on 3 OSes | **chokidar** — native FSEvents (macOS) / inotify (Linux) / `fs.watch` on Windows with path normalisation + file-lock handling; `awaitWriteFinish` for still-copying files; `atomic` for editor write-delete-add ([context7 `/paulmillr/chokidar`](https://github.com/paulmillr/chokidar)) | 2–3 wk | **Partly.** chokidar is real leverage. The tail is not: `EMFILE`/`ENOSPC`, `fs.inotify.max_user_watches`, network drives, and the polling fallback are all documented chokidar troubleshooting topics — i.e. known, recurring, ours to own. |
| Local state DB + hash index | better-sqlite3, node:crypto / BLAKE3 | 2 wk | Yes |
| **Sync state machine** (scan→diff→plan→transfer→apply→verify; restart-safe, interrupt-safe) | — | **4–6 wk** | ❌ **No shortcut.** No npm package gives you a correct two-way sync engine. |
| **Conflict detection + resolution semantics** | — | **2–3 wk** | ❌ **No shortcut.** This is where sync products lose customers' data. |
| **Delta sync** (content-defined chunking + server block store + block reuse) | JS FastCDC/Rabin implementations exist but are **immature/unaudited** ⚠️ | **3–4 wk** | ❌ **No shortcut** in TS. |
| Resumable large-file upload (site photos, rural links) | **tus** protocol + **`@tus/server`** (TS rewrite; disk/**S3**/Azure/GCS stores; runs inside Next.js) + **`tus-js-client`** (browser, Node, **React Native**) ([tus-node-server](https://github.com/tus/tus-node-server), [v2.0.0 announcement](https://tus.io/blog/2025/03/25/tus-node-server-v200)); or S3 **multipart** — parts uploadable independently and in any order, *"if transmission of any part fails, you can retransmit that part"*, *"pause and resume… there is no expiry"*, `ListParts` to resume ([AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)) | **1–2 wk** | ✅ **Yes — genuinely solved.** The strongest part of C's case. |
| Rename/move detection, tombstones, **macOS NFD vs Windows NFC** filename normalisation, Windows 260-char paths + reserved names, permissions/mtime fidelity | — | **2–3 wk + a permanent tail** | ❌ **No shortcut.** |
| Selective sync, throttling, back-off, offline queue, LAN-direct | — | 2 wk (LAN-direct: much more) | ❌ |
| **Total to "trustworthy with a firm's only copy of its contract drawings"** | | **≈ 4–7 months**, plus an open-ended correctness tail | |

Syncthing is ~11 years of exactly this work, with a spec, a test suite and an install base.
**Do not undersell it: option C is not "a few weeks of glue".**

---

## 7. Criterion 6 — mobile fit (Expo, Android + iOS)

R-3 §7's conclusion holds and is not reopened: **the mobile app embeds no sync client.** Photo capture
against a task is a domain event (photo → task → project), needing our auth, our task ID, our offline
queue and our geofence context.

| | Upload path | Hops | Extra identity on the phone | Fit |
|---|---|---|---|---|
| **A** | Expo → our tRPC → **Nextcloud WebDAV** → disk | 2 server-side | none (server-side app-password) | 🟡 extra hop and a second credential to manage server-side |
| **B** | Expo → our tRPC → **write into the project's folder on disk** → Syncthing fans out to desktops | 1 | none | ✅ **simplest** — the write is `fs.writeFile` into a directory |
| **C** | Expo → **presigned S3/tus PUT** → MinIO | 1, and it bypasses our Node process entirely | none | ✅ **simplest** for large media; `tus-js-client` supports React Native |
| Browse/download on mobile | our API, all three | | | tie |

**B and C are equally simple for mobile; A is the only one that adds a hop.** Note the storage-shape
consequence: B/A put project files on a **POSIX tree** (ideal for the NAS in R-2, browsable, `rclone`-able);
C puts them in **MinIO objects** (ideal for presigned mobile uploads, worse for "just mount the NAS share").
B can still use MinIO for everything that is not a synced project file.

---

## 8. Criterion 7 — bandwidth over the relayed reverse tunnel *(weighted heavily)*

`R1a_PANGOLIN_SIZING.md` establishes the shape of the constraint: **all remote traffic relays through the
VPS**, the NIC sees every byte twice, the projection is **300–600 GB/month against a typical 1–2 TB
allowance**, and the real ceiling is **per-connection throughput** — *"~180 Mbit/s single-stream, ~500
Mbit/s with 8 parallel streams"* with `USE_NATIVE_MAIN_INTERFACE=true` on Newt 1.16.0.

| Lever | **A · Nextcloud** | **B · Syncthing** | **C · Ours** |
|---|---|---|---|
| **Delta transfer** (changed parts only) | ❌ **Not implemented.** Long-standing, still-unfulfilled request; the client chunks large files (10 MB chunks) purely to survive upload limits, not to save bytes ([chunking docs](https://docs.nextcloud.com/server/28/developer_manual/client_apis/WebDAV/chunking.html), [community thread](https://help.nextcloud.com/t/desktop-client-delta-updates-to-files/7790)). **A 400 MB revised drawing set re-uploads in full, every save.** | ✅ **Block-level.** 128 KiB–16 MiB blocks by file size; `Request` carries a block hash and the peer *"MAY reuse a block from a different file and offset having the same size and hash"* ([BEP v1](https://docs.syncthing.net/specs/bep-v1.html)) — unchanged blocks never cross the wire, and identical blocks are deduped across files. ⚠️ v2.0 **removed rolling-hash detection of shifted data**, so a byte *inserted* at the front still re-transfers ([v2.0.0 release notes](https://github.com/syncthing/syncthing/releases/tag/v2.0.0)). | 🔨 ours to build (§6.3, 3–4 wk, no shortcut) |
| **Compression on the wire** | ⚠️ HTTP-level only; already-compressed formats gain nothing | ✅ per-device `compression="metadata\|always\|never"` ([config](https://docs.syncthing.net/users/config)) | 🔨 ours |
| **Bandwidth caps** (protect the tunnel and the office link) | ⚠️ per-account/quota, not per-link | ✅ **`maxSendKbps` / `maxRecvKbps` per device**, plus `allowedNetwork` | 🔨 ours |
| **Exploits the multi-stream headroom** (the 180 → 500 Mbit/s difference) | ❌ HTTP, effectively single-stream per file | ✅ **v2 uses multiple connections by default between v2 devices** ([v2.0.0 notes](https://github.com/syncthing/syncthing/releases/tag/v2.0.0)) — directly targets R1a's measured single-stream ceiling | 🔨 ours (S3 multipart parallelism gets some of this — *"upload parts in parallel to improve throughput"*) |
| **LAN-direct, tunnel bypassed** | ❌ always to the server origin | ✅ **local discovery is on by default** — IPv4 broadcast / IPv6 multicast every 30 s ([security docs](https://docs.syncthing.net/users/security.html)). The server box **is on the site/office LAN** (desktop-as-server), so on-premises staff sync at LAN speed with **zero bytes crossing the VPS**. | ❌ (would be a build) |
| Optional off-tunnel remote path | ❌ | ⚠️ global discovery + community relays exist and default **on** — see the privacy caveat below | ❌ |
| **Verdict** | ⛔ **worst** — no delta is disqualifying for a CAD/drawings product on a metered relay | ✅ **best by a wide margin, out of the box** | 🟡 could match B, after ~2 extra months of the hardest work |

> **Privacy caveat on B, and the mitigation.** Global discovery announces device IDs to servers hosted by
> the upstream maintainer, and the operator *"can deduce which devices are connected to each other"*;
> relayed traffic is TLS but transits third-party hosts ([security docs](https://docs.syncthing.net/users/security.html)).
> For a construction firm's contracts and drawings, **ship with global discovery and relaying OFF and the
> server address pinned** — the LAN-direct win is unaffected, and remote sync then rides the Pangolin tunnel
> like everything else, still with block-delta, compression, caps and multi-stream. Self-hosting
> `stdiscosrv`/`strelaysrv` is a documented later option if off-tunnel remote sync is ever wanted.

---

## 9. Scorecard

Weights reflect the new constraint set: criterion 1 (NC-1) and criterion 7 (R1a) dominate; criterion 3's
*hard* half is now met by everyone.

| Criterion | Weight | **A1** Qt-alongside | **A2** `nextcloudcmd` | **B** Syncthing sidecar | **C** ours |
|---|---|---|---|---|---|
| 1 · Single branded installer, non-technical | ×3 | ✗ | ★★ | ★★★ | ★★★ |
| 2 · Language discipline (shipped runtimes) | ×2 | ★ | ★ | ★★★ | ★★★ |
| 3a · Project-scoped ACL, **server-enforced** (hard) | ×3 | ★★★ | ★★★ | ★★★ | ★★★ |
| 3b · Per-user read-only / person-principal (soft) | ×1 | ★★★ | ★★★ | ★ | ★★★ |
| 4 · Revisioning | ×2 | ★★★ | ★★★ | ★★ | ★★★ |
| 5 · Least net-new engineering | ×3 | ★★ | ★ | ★★★ | ✗ (4–7 mo + tail) |
| 6 · Mobile simplicity | ×1 | ★★ | ★★ | ★★★ | ★★★ |
| 7 · Bandwidth over the relayed tunnel | ×3 | ✗ (no delta) | ✗ (no delta) | ★★★ | ★★ (after build) |
| 8 · Server footprint on a desktop-as-server | ×2 | ★ | ★ | ★★★ | ★★★ |
| 9 · SEED_BRIEF §4.4 compliance | gate | ✅ | ✅ | ✅ | ❌ needs a superseding decision |
| **Weighted** | | **~40%** | **~45%** | **~88%** | **~62%** |

---

## 10. RECOMMENDATION

> ### **Option B — Syncthing, embedded as a sidecar inside our own TypeScript desktop client, with our server as the sole authority over which device gets which project folder.**
>
> R-3's Nextcloud pick **does not survive the new constraints** — not because Nextcloud got worse, but
> because NC-1 removed the asset it was chosen for.

**Decisive reasons, in order:**

1. **NC-1 destroys A's advantage and restores B's.** R-3 chose Nextcloud largely for its mature desktop client. We are now writing the client. What remains of A is a PHP server whose sync agent we cannot use as our app — so we would rebuild the client half **and** carry the PHP half. B is the only option where a single ~17 MB (Tauri) installer gives a site engineer one login and one app, with an 11-year-old sync engine inside it.
2. **R-3's disqualifying objection is factually wrong under the new setup.** Syncthing's folder access check runs on the **serving** side (`model.go:1982`, `!folderCfg.SharedWith(deviceID) → reject`), against a config only our backend can write. A modified client cannot request an unshared folder. The "no user model" problem shrinks to "the principal is a device, and enrolment needs a client" — and **we now ship the client**, so enrolment is automatic and invisible.
3. **The scarce resource was misidentified.** Under D-5 we build project-scoped RBAC anyway; getting it from Nextcloud is duplication plus an identity bridge (R-3's own stated top risk). What we cannot build is a correct sync engine — §6.3 prices that at 4–7 months with an open-ended correctness tail on the one component whose failure mode is *losing a firm's only copy of its drawings*.
4. **Criterion 7 is not close.** Nextcloud has **no delta sync**; every save of a revised drawing set re-uploads the whole file across a metered, throughput-limited relay. Syncthing ships block-level delta, wire compression, per-device bandwidth caps, multiple parallel connections by default (aimed straight at R1a's single-stream ceiling), and LAN-direct transfer that removes on-site traffic from the VPS entirely.
5. **Footprint.** ~18 MB image and no extra datastore, versus ~530 MB plus a second DB plus cron, on a box already running Postgres + MinIO + Valkey + our app.

**What it costs us to build:** device registry + auto-enrolment (small) · the permission reconciler as a
BullMQ worker against `/rest/config/folders` (**the same worker option A needs — not extra**) · a version
browser over the server's `.stversions` tree (~150 lines, plus care around the staggered pruner) · the
attachment/file-identity model and change feed (common to all options) · the desktop shell itself
(required by NC-1 regardless of engine) · **zero sync-engine code**.

**Shape it as a hybrid, deliberately:** Syncthing carries *desktop bulk folder sync*; our tRPC API + tus/S3
multipart carries *mobile capture and browser upload*; both land in the same on-disk project folder.
Keep every call behind R-3 §11.1's `FileSyncProvider` port so the decision stays reversible.

---

## 11. Fallback ladder

| If B is rejected because… | Then |
|---|---|
| per-user **read-only** must be technically enforced | **A**, accepting two apps or `nextcloudcmd` — and re-scope the desktop app to a *thin* companion, not the sync client |
| device-as-principal is unacceptable | no option delivers person-level revocation of held bytes; **A** is closest — reopen as a `[WHAT]` |
| the owner wants zero third-party runtimes at any cost | **C**, with SEED_BRIEF §4.4 formally superseded and 4–7 months booked |
| schedule pressure before any client ships | R-3 §11's baseline — **browser upload + WebDAV/SMB mount, no agent** — still valid as a day-one de-scope under any engine |

---

## 12. What would reverse this call

1. **Per-user read-only or per-file permissions become a hard requirement** → B cannot do it; go A.
2. **Syncthing licence or governance change** away from MPL-2.0, or v2's SQLite cross-compilation trouble dropping our target platforms (the v2.0 notes already cite *"complexities related to cross compilation with SQLite"* as the reason some prebuilt binaries were discontinued) → **verify Windows/macOS builds stay first-class before locking**.
3. **Measured server RAM/index cost** at realistic scale (N projects × M devices, ~10⁵–10⁶ files) proves unworkable on the target box → measure on real hardware; v2's SQLite backend changes R-3's LevelDB-era memory figures and they must be **re-measured, not carried over**.
4. **A Syncthing folder-per-project proves to have an operational ceiling** (folder count, rescan cost, config-file churn) → measure before locking.
5. **Nextcloud ships real delta sync** → re-open criterion 7 (it has been requested since at least 2017 and remains unimplemented; treat as unlikely).
6. **Measured throughput shows Syncthing's multi-connection default saturating the Pangolin VPS** → *not* a reversal: cap it with `maxSendKbps`/`maxRecvKbps`.

---

## 13. Decisions this raises for the owner

| Ref | Type | Question |
|---|---|---|
| **Q-1** | `[WHAT]` | **Accept that per-user read-only cannot be enforced** for synced project folders — any project member who can see a folder can write to it — and document it in PRODUCT.md alongside R-3's B-8 "already-synced bytes are not revocable". If unacceptable, B is out. |
| **Q-2** | `[HOW]`, owner-visible | **Tauri (~17 MB, ~50–300 lines of Rust) vs Electron (~112 MB, 100% TypeScript).** Recommended: Tauri. This is the only real NC-3 tension in the whole analysis. |
| **Q-3** | `[HOW]` | Ship with **global discovery + relaying OFF**, server address pinned (recommended for confidentiality). |
| **Q-4** | `[WHAT]` | If option C is ever preferred, **SEED_BRIEF §4.4 must be formally superseded** — it currently forbids hand-writing a sync engine. |

---

## 14. Explicitly unverified (do not treat as fact)

1. **`nextcloudcmd`'s full redistributable footprint** (Qt + OpenSSL + deps) on Windows/macOS — the 40–90 MB figure is an estimate, not a measurement.
2. **Tauri/Electron installer sizes for *our* app** — quoted figures are hello-world/community benchmarks; measure our real bundle.
3. **Syncthing RAM and index size at our scale** — R-3's figures predate the v2 LevelDB→SQLite migration and are stale. Must be measured on the target box.
4. Whether Syncthing v2's **prebuilt Windows/macOS binaries** remain first-class for every architecture we ship (the v2.0 notes discontinued some platforms over SQLite cross-compilation).
5. Whether the **staggered versioning pruner** can race a concurrent restore-read from our backend, and what locking (if any) is needed.
6. **`autoAcceptFolders` + `defaultFolderPath`** behaviour end-to-end for silently mounting a newly assigned project — mechanism is documented in the config reference; the flow is not validated here.
7. **Nextcloud image size** is the Docker Hub *compressed* figure (~530 MB); on-disk is larger.
8. Maturity/audit status of **JS content-defined-chunking libraries** (relevant only if C is chosen).
9. Whether Pangolin can proxy Syncthing's **TCP/QUIC :22000** as a raw resource cleanly, or whether remote sync should ride an HTTP-tunnelled path — **test against the real Pangolin install** (touches R-1/R-1a).
10. Everything R-3 §12 flagged that this pass did not revisit remains flagged.

---

## 15. Effect on existing documents (no files changed by this pass)

| Document | Effect if this recommendation is accepted |
|---|---|
| `docs/planning/R3_FILE_SYNC.md` | **Not modified.** Mark as superseded-by-R3b in its status line at acceptance time; §1 licence matrix, §2 health table, §7 mobile conclusion and §11.1 port remain live. |
| `docs/SEED_BRIEF.md` §4.4 | **Vindicated** — the original Syncthing prior stands. No change needed. |
| `docs/DECISIONS_LOG.md` | New entry (D-7?) recording the engine choice + Q-1's accepted limitation. |
| `PENDING_DECISIONS.md` | Add Q-1 and Q-2. |
| R-2 (NAS) | Unaffected and slightly simplified — project files stay a plain POSIX tree. |
| R-1a (Pangolin) | Add "measure Syncthing over the tunnel, with `maxSendKbps` caps" to its pre-install throughput test. |

---

*Primary sources fetched 2026-09-06: Syncthing docs (Security Principles, BEP v1, REST API, Configuration,
Versioning, FAQ), `syncthing/syncthing` `lib/model/model.go` on `main`, GitHub release assets for v2.1.3 and
the v2.0.0 release notes, Nextcloud developer + user manuals (chunking, WebDAV versions, `nextcloudcmd`),
the Nextcloud community delta-sync thread, Docker Hub tag API for image sizes, Tauri v2 sidecar docs,
AWS S3 multipart-upload guide, tus-node-server docs, and context7 `/paulmillr/chokidar`. Figures marked
⚠️ or listed in §14 are unverified.*
