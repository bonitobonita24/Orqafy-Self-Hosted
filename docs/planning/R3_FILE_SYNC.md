# R-3 · File-Sync Engine Decision

> **Status:** RESEARCH COMPLETE — recommendation pending owner acceptance (`[HOW]`, agent-owned per
> `docs/SEED_BRIEF.md` §5). **Researched:** 2026-09-06.
> **Standing constraint (SEED_BRIEF §4.4):** ADOPT an existing FOSS engine. Never hand-write a sync engine.
> **Scope:** the Drive-like module (f) — per-user desktop agent, two-way sync, project-scoped visibility,
> revision history, files attachable to project / todo / invoice / expense records.

---

## 0. Requirements restated as testable criteria

| # | Requirement | Hard / Soft |
|---|---|---|
| **RQ-1** | Per-user desktop agent, two-way sync, Windows + macOS, non-technical installer | HARD |
| **RQ-2** | **Server-authoritative** access control: a user sees ONLY the projects they are assigned to | HARD |
| **RQ-3** | Shares provisionable **programmatically** from our tRPC backend (create folder, grant/revoke per user/group) | HARD |
| **RQ-4** | File **revision history** with configurable retention, listable + restorable **via API** | HARD |
| **RQ-5** | Stable per-file identifier our Prisma schema can foreign-key for attachments | HARD |
| **RQ-6** | Runs in the desktop-as-server Compose bundle beside Postgres / Valkey / MinIO | HARD |
| **RQ-7** | Licence compatible with an **AGPL-3.0 product that wraps (does not fork) it** | HARD |
| **RQ-8** | Storage lands on local disk **or** the NAS (R-2), degrading to local when NAS absent | HARD |
| **RQ-9** | Mobile: Expo app must not need the sync engine's own client | SOFT |
| **RQ-10** | Brandable / bundleable client | SOFT |

---

## 1. Licence matrix

Verified from each project's own `LICENSE`/`COPYING` and the GitHub API licence field, 2026-09-06.

| Engine | Server licence | Desktop client licence | Wrapping it from an AGPL-3.0 app |
|---|---|---|---|
| **Syncthing** | **MPL-2.0** ([LICENSE](https://raw.githubusercontent.com/syncthing/syncthing/main/LICENSE)) | same binary (MPL-2.0) | ✅ Cleanest. MPL is file-level copyleft; a separate process we talk to over REST creates no combined work. Redistributing the unmodified binary in our Compose bundle is fine. |
| **Nextcloud** | **AGPL-3.0** (`nextcloud/server` COPYING) | **GPL-2.0** (`nextcloud/desktop` COPYING) | ✅ Same licence family as us. We call it over HTTP as a separate service → no linking. Shipping a Compose file that pulls the official image is mere aggregation. Trademark (name/logo) is separate from licence — rebrand only with care. |
| **Seafile CE** | **AGPL-3.0 + OpenSSL linking exception** (`seafile-server/LICENSE.txt`) | `haiwen/seafile-client` GitHub licence field = **Apache-2.0**; third-party summaries call CE "GPLv2" — ⚠ **conflicting, unverified**, resolve before packaging | ✅ Server side fine (separate process). Client licence must be pinned before we bundle/brand it. |
| **ownCloud Infinite Scale (oCIS)** | **Apache-2.0** (`owncloud/ocis/LICENSE`) | `owncloud/client` **GPL-2.0** | ✅ Permissive; no obligation flowing back into our AGPL code. |
| **OpenCloud** (oCIS fork, added contender) | **Apache-2.0** (+ AGPL-3.0 parts, per project blog — ⚠ mixed, unverified per-component) | `opencloud-eu/desktop` (fork of ownCloud client, GPL family — unverified exact SPDX) | ✅ Permissive core. |
| **Pydio Cells** (added contender) | **AGPL-3.0** (`pydio/cells/LICENSE`) | `pydio/cells-sync` **GPL-3.0** | ✅ Compatible, but see health flag below. |
| **rclone** | **MIT** | n/a (CLI) | ✅ Anything goes. |
| **Peergos** | **AGPL-3.0** | n/a (FUSE mount / web) | ✅ Licence fine; architecture is not (see §3). |

**Licence conclusion:** licence is **not** the discriminator. Every candidate can be wrapped by an AGPL-3.0
product as long as we run it as a **separate process behind an HTTP API** and never fork/vendor its source
into our tree. The only live licence risk is the Seafile *client* ambiguity if we ever rebrand/redistribute it.

---

## 2. Project health (GitHub API, 2026-09-06)

| Repo | Stars | Last push | Archived | Read |
|---|---|---|---|---|
| syncthing/syncthing | 88,322 | 2026-08-25 | no | very healthy |
| nextcloud/server | 36,731 | 2026-09-06 | no | very healthy, daily commits |
| nextcloud/desktop | 3,859 | 2026-09-06 | no | actively developed |
| owncloud/ocis | 2,112 | 2026-09-06 | no | active, but ownCloud is now "a Kiteworks company" and ~15 core oCIS devs left in Jan 2025 to found OpenCloud ([open-edge.io](https://open-edge.io/blog/owncloud-to-opencloud-migration/), [korben.info](https://korben.info/en/opencloud-go-database-free-nextcloud-alternative.html)) — **strategic risk** |
| haiwen/seafile-server | 545 | 2026-09-03 | no | active, small team, single vendor |
| haiwen/seafile-client | 531 | 2026-08-28 | no | active |
| pydio/cells | 2,244 | 2026-09-04 | no | active |
| **pydio/cells-sync** | **44** | **2025-12-18** | no | ⚠ **~9 months stale, 44 stars — the desktop agent is effectively unmaintained.** Disqualifying for RQ-1. |
| rclone/rclone | 59,586 | 2026-09-05 | no | very healthy |
| Peergos/Peergos | 2,457 | 2026-09-05 | no | healthy but niche |

---

## 3. Architecture fit — central-server vs P2P

| Engine | Model | What that costs us |
|---|---|---|
| **Syncthing** | **Pure P2P mesh, device-identity only.** No accounts, no users, no server role. A "server" is just another device you happened to leave running. | **Fatal for RQ-2/RQ-3 as-is.** See §4 for the full list of what we would have to build. |
| **Nextcloud** | Central server, HTTP/WebDAV. Users, groups, ACLs, shares are first-class. Files sit on the server as **plain files on a normal filesystem path** (`data/<user>/files/...`). | Ideal shape. Plain-file storage means the NAS (R-2) is just a mount point, and our server can read/write the same tree out-of-band. |
| **Seafile CE** | Central server (`seaf-server` + Seahub/Django). Data stored as a **content-addressed block store**, not browsable files. | Strong ACL model; but files are **not** readable from disk — every read/write must go through the Seafile API. Rules out "just mount the NAS folder", complicates NAS/backup story. |
| **oCIS / OpenCloud** | Central server, Go, **database-free**, storage in "Spaces" on a POSIX/S3 backend. | Excellent shape and lowest footprint of the central options. |
| **Pydio Cells** | Central server (Go microservices), S3/POSIX datasources. | Good shape; killed by the dead sync client. |
| **rclone** | **No server, no daemon-of-record.** A transfer tool with a `bisync` mode. | No users, no shares, no versions, no state authority. Baseline only. |
| **Peergos** | P2P over IPFS, **end-to-end encrypted**, sharing is by cryptographic capability handed user-to-user. | The server *cannot* see or control content by design — the exact opposite of server-authoritative. Also no mainstream Windows/macOS sync agent (FUSE mount). **Rejected.** |

---

## 4. RQ-2/RQ-3 — per-user project-scoped access control (the deciding criterion)

| Engine | User model | Per-project scoping primitive | Provisioning API | Revocation semantics |
|---|---|---|---|---|
| **Syncthing** | **NONE.** The GUI has one admin password; peers are identified by **device ID** (a public key), not by person. Ignore patterns are per-device, cosmetic, and [do not stop traversal](https://forum.syncthing.net/t/syncthing-multi-user-access-control/13574). | Folder ↔ list of device IDs. One Syncthing folder per project, shared to the device IDs of the assigned users. | `POST /rest/config/folders` (single object) / `PUT /rest/config/folders` (array), `PATCH|DELETE /rest/config/folders/{id}`, API key in `X-API-Key` ([docs](https://docs.syncthing.net/rest/config.html)). So provisioning **is** scriptable. | ❌ Weak. Removing a device stops *future* sync; the files already on that laptop stay there and we cannot remote-wipe. No per-file permission, no read-only-per-user (only whole-folder "Send Only"/"Receive Only" on the peer's side, which the peer can change). "Untrusted (encrypted) devices" exists but is [flagged beta/testing-only](https://docs.syncthing.net/users/untrusted.html). |
| **Nextcloud** | Full users + groups + admin, LDAP/OIDC optional. | **Team folders** (formerly Group folders) app: an admin-defined folder mounted for everyone in a group — the natural "one folder per project" primitive. Plus ordinary user/group shares. | **OCS Share API** `POST /ocs/v2.php/apps/files_sharing/api/v1/shares` with `shareType` (0=user, 1=group), `shareWith`, `permissions` bitmask (1 read / 2 update / 4 create / 8 delete / 16 reshare) ([docs](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-share-api.html)); **Provisioning API** for users/groups; **Team folders API** at `/apps/groupfolders/folders` (create folder, grant group access) ([repo README](https://github.com/nextcloud/groupfolders/blob/master/README.md)) + `occ groupfolders:create` as the scripted fallback. All plain HTTP + `OCS-APIRequest: true`. | ✅ Server-side. Revoke the group membership or delete the share → the desktop client removes the folder on next sync. |
| **Seafile CE** | Full users + groups + admin, plus **libraries** as the ownership unit. | **Library per project** — the cleanest 1:1 mapping of any candidate. | Web API v2.1: create library, share library to user/group, admin user-management ([manual](https://manual.seafile.com/latest/develop/web_api_v2.1/), [API reference](https://seafile-api.readme.io/)). Exact request shapes **not verified in this pass** — treat as "documented, unvalidated". | ✅ Server-side, same as Nextcloud. |
| **oCIS / OpenCloud** | Full users + groups (IDP-backed). | **Project Spaces** — a first-class "one space per project" container, exactly our shape. | **LibreGraph API** (MS-Graph-shaped REST, OpenAPI 3): create drive/space, add members, roles ([owncloud.dev/apis/http/graph](https://owncloud.dev/apis/http/graph/)). Specific create-space/add-member payloads **unverified**. | ✅ Server-side. |
| **Pydio Cells** | Full users/groups/roles, workspaces per project. | Workspace + ACL. | REST + gRPC API. | ✅ but client is dead. |
| **rclone** | none | none | none | n/a |

### What Syncthing specifically forces us to BUILD (the honest bill)

If we adopt Syncthing as the primary agent, none of the following exists and all of it becomes our code:

1. **A device registry** — a table binding `User → one or more Syncthing device IDs`, plus an enrolment flow where a non-technical site engineer copies a 63-char device ID out of a tray app into our web UI (or we ship a custom enrolment helper that does it for them).
2. **A permission→folder reconciler** — a BullMQ worker that diffs our RBAC (`ProjectMember`) against Syncthing's config and issues `POST/PATCH/DELETE /rest/config/folders/{id}` to add/remove device IDs. This is the entire access-control system, hand-written, with our own retry/consistency semantics.
3. **Device approval + trust policy** — Syncthing will accept any device we introduce; there is no "this laptop belongs to this employee" check beyond what we build.
4. **An acceptance of un-revocable data** — a departing employee keeps every byte already synced. We can only stop future sync. For a construction firm's drawings and contracts this is a real governance gap that must be written into PRODUCT.md as an accepted limitation, not glossed over.
5. **A revision browser over `.stversions`** — see §5.
6. **Read-only enforcement** — impossible per-user from the server. Any member who can see a project folder can write to it.

That is a multi-week access-control subsystem to reimplement what Nextcloud/Seafile/oCIS ship. It also
contradicts nothing in the seed brief except the *prior* that Syncthing is the default — the prior does not
survive RQ-2.

---

## 5. RQ-4 — file revisioning

| Engine | Mechanism | Retention config | App-readable / restorable via API |
|---|---|---|---|
| **Syncthing** | Per-folder **file versioning** into a `.stversions` directory on each device. Strategies: Trash Can, Simple (`keep` N versions + `cleanoutDays`), **Staggered** (30s buckets for 1h → hourly for 1d → daily for 30d → weekly until `maxAge`; `maxAge=0` = forever), External ([docs](https://docs.syncthing.net/users/versioning.html)). | ✅ Rich, per folder, set through the same config REST endpoint. | ⚠ **No revision API.** Versions are timestamped files on disk (`file~20260906-141530.ext`). Our backend can list/restore them only by walking the server's `.stversions` directory itself and copying a file back — a filesystem hack we own, including parsing the timestamp convention and handling the staggered pruner racing us. |
| **Nextcloud** | Built-in Versions app; automatic on every write, with an age-based expiry pattern (keep more recent, thin out older) ([user manual](https://docs.nextcloud.com/server/latest/user_manual/en/files/version_control.html)). | ✅ `versions_retention_obligation` in `config.php` (unverified exact syntax in this pass). | ✅ **Real API.** Versions exposed over WebDAV at `/remote.php/dav/versions/<user>/…`; **restore = MOVE the version into the special `…/versions/<user>/restore` collection** ([docs](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/versions.html)). Straightforward from Node. |
| **Seafile CE** | **Library snapshots** (git-like commits) + per-file history. | ✅ Per-library retention, plus global `keep_days` in `seafile.conf` ([forum](https://forum.seafile.com/t/meaning-of-keep-days/894), [user manual](https://help.seafile.com/file_folder_managing/setting_library_history/)). | ✅ `GET /api2/repos/{repo-id}/file/revision/?p=/foo.c&commit_id=…` and history endpoints. Arguably the **best** versioning model of the lot (whole-library point-in-time snapshots, not just per-file). |
| **oCIS / OpenCloud** | Built-in versioning per space. | ✅ (details unverified) | ✅ via WebDAV/Graph (details unverified). |
| **Pydio Cells** | Built-in versioning policies. | ✅ | ✅ |
| **rclone bisync** | ❌ **None.** Conflicts are resolved by renaming to `.conflict1`/`.conflict2` files ([docs](https://rclone.org/bisync/)); there is no version store. `--backup-dir` is a poor man's substitute we would have to manage. | ❌ | ❌ |
| **Peergos** | Has history, but E2E-encrypted — our server cannot read it. | — | ❌ for our purposes |

---

## 6. RQ-1 / RQ-10 — desktop client quality (site staff run Windows)

| Engine | Windows | macOS | Install burden for a non-technical user | Brand/bundle |
|---|---|---|---|---|
| **Nextcloud desktop** | ✅ Mature MSI, tray app, **Virtual Files (files-on-demand)** since client 3.2 ([blog](https://nextcloud.com/blog/nextcloud-desktop-client-3-2-with-status-feature-and-virtual-files-available-now/)) | ✅ Native; VFS on macOS shipped as a **separate client build** ([wiki](https://github.com/nextcloud/desktop/wiki/Virtual-files-client-for-macOS)) | **Lowest.** Install → type server URL → browser login (OIDC/app-password) → done. This is the flow a site engineer can complete unaided. | GPL-2.0 source supports a branding layer; **trademark** requires renaming assets. Unverified how much work a rebuild is. |
| **Seafile / SeaDrive** | ✅ Mature; **SeaDrive** gives files-on-demand in Explorer | ✅ | Low — comparable to Nextcloud. | Apache-2.0 client repo would make branding easy **if** that licence is the operative one (see §1 flag). |
| **oCIS / OpenCloud desktop** | ✅ (ownCloud lineage, same codebase family) | ✅ | Low. | GPL-2.0 family. |
| **Syncthing** | ⚠ No official GUI app — a service + web UI on `localhost:8384`. Community wrappers (SyncTrayzor) fill the gap. | ⚠ Same; tray wrappers are third-party. | **Highest.** Device IDs, folder acceptance prompts, no login concept. A site engineer will need hand-holding, or we build+maintain our own installer/tray wrapper. | MPL-2.0 makes bundling easy — but we would be building the UX, not branding one. |
| **Pydio cells-sync** | Binary exists | Binary exists | Medium — but unmaintained since 2025-12. | GPL-3.0 |
| **rclone** | CLI only | CLI only | ❌ Not a user-facing agent at all. | MIT |

---

## 7. RQ-9 — does the Expo app need any of this?

**No. Recommendation: the mobile app must NOT embed a sync client.**

| Option | Verdict |
|---|---|
| Bundle Nextcloud/Seafile mobile SDK into our Expo app | ❌ Duplicate auth, duplicate identity, huge surface, no upside |
| Ship the vendor's own mobile app alongside ours | ❌ Two apps, two logins, breaks the product |
| **App-native upload against OUR server** (presigned S3/MinIO PUT via tRPC, with an offline outbox queue) | ✅ **Chosen.** Photo capture against a task is a *domain event* (photo → task → project), not a folder sync. It needs our auth, our task ID, our offline queue, and our geofence context — all of which we own already. |

Server-side, the uploaded photo is written into the project's shared folder (or stored in MinIO and merely
**referenced** from the project folder) so desktop users see it. That write is one API call from our backend —
not a sync agent on a phone. This also keeps iOS background-upload behaviour under our control, next to the
geofence work.

---

## 8. RQ-6 / RQ-8 — resource cost on a desktop-as-server box (alongside Postgres + Valkey + MinIO)

| Engine | Extra runtime | Extra datastore | Rough steady-state RAM | Storage shape (NAS fit) |
|---|---|---|---|---|
| **Syncthing** | 1 Go binary | none (own LevelDB index) | Low at small scale; **scales with total file count, not folder count** — community reports range from tens of MB to multi-GB on ~1.5M files; tuning via `maxConcurrentWrites`/buffer size ([tuning docs](https://docs.syncthing.net/users/tuning.html), [forum](https://forum.syncthing.net/t/solved-ram-usage-per-folder-and-per-connected-device/15690)). ⚠ Exact figures **unverified** for our scale. | ✅ Plain files. Perfect NAS fit. |
| **Nextcloud** | PHP-FPM + web server + cron | ✅ **Yes** — its own DB (can be a second database inside our existing Postgres) + Redis/Valkey (can reuse ours) | **Heaviest of the set** — plan ~1–2 GB for PHP-FPM + web tier under light load. ⚠ unverified exact figure. | ✅ Plain files under `data/` → mount the NAS there; local-disk fallback is trivial. |
| **Seafile CE** | `seaf-server` (C) + Seahub (Django/gunicorn) | ✅ MariaDB/MySQL in v12 (⚠ unverified whether SQLite is still permitted) — a **third** database engine on the box | Moderate; the C daemon is efficient. | ⚠ **Content-addressed block store.** Files are not browsable on the NAS; backups and any out-of-band access must go through Seafile. Biggest architectural cost. |
| **oCIS / OpenCloud** | 1 Go binary, **database-free** | none | **Lowest of the central-server options** | ✅ POSIX or S3 (could target our MinIO directly). |
| **rclone** | 1 binary, invoked | none | negligible | ✅ |
| **Peergos** | JVM + IPFS node | own store | High (JVM + IPFS) | ❌ encrypted blobs |

---

## 9. Scorecard

Weighting: RQ-2/3 (access control) and RQ-4 (revisions) are the hard gates; everything else is secondary.

| Engine | RQ-1 client | RQ-2/3 ACL | RQ-4 revisions API | RQ-6 footprint | RQ-7 licence | RQ-8 NAS | Health | **Verdict** |
|---|---|---|---|---|---|---|---|---|
| **Nextcloud** | ★★★ | ★★★ | ★★★ | ★ | ★★★ | ★★★ | ★★★ | ✅ **Primary** |
| **Seafile CE** | ★★★ | ★★★ | ★★★ | ★★ | ★★ (client licence flag) | ★ (block store) | ★★ | ✅ **Fallback** |
| **OpenCloud / oCIS** | ★★ | ★★★ | ★★ (unverified) | ★★★ | ★★★ | ★★★ | ★★ (fork churn) | 🕐 **Watch — revisit at v2** |
| **Syncthing** | ★ | ✗ **no user model** | ★ (filesystem only) | ★★★ | ★★★ | ★★★ | ★★★ | ⛔ Not as the primary; optional power-user add-on later |
| **Pydio Cells** | ✗ (agent stale) | ★★★ | ★★ | ★★ | ★★★ | ★★ | ✗ | ⛔ Rejected |
| **rclone bisync** | ✗ | ✗ | ✗ | ★★★ | ★★★ | ★★★ | ★★★ | ⛔ Rejected as the engine; keep as a **server-side NAS/backup mover** |
| **Peergos** | ✗ | ✗ (by design) | ✗ | ★ | ★★★ | ✗ | ★★ | ⛔ Rejected |
| **Baseline: web upload + WebDAV mount, no agent** | — | ★★★ | ★★★ | ★★★ | — | ★★★ | — | 🅿️ **Honest v1.0 fallback if the agent slips** — see §11 |

---

## 10. RECOMMENDATION

| | |
|---|---|
| **Primary** | **Nextcloud** (server AGPL-3.0, desktop client GPL-2.0) — run as a sidecar service in our Compose bundle, **wrapped never forked**, with **one Team folder per project** provisioned by our backend. |
| **Fallback** | **Seafile CE** — if Nextcloud's footprint proves too heavy on the target desktop-as-server hardware, or if per-library snapshots turn out to matter more than plain-file NAS storage. Migration cost is contained because both are reached through a thin `FileSyncProvider` port (see §11.1). |
| **Watch list** | **OpenCloud** (Apache-2.0, Go, database-free, Project Spaces). Architecturally the best fit and the lightest; too young and too mid-fork to bet v1 on. Re-evaluate before v2. |
| **Explicitly rejected** | Syncthing as primary, Pydio Cells, rclone-as-engine, Peergos. |

### Decisive reason (one sentence)

**Nextcloud is the only candidate that already has the thing we cannot cheaply build — a server-authoritative
user/group permission system with a documented provisioning API — while also having the best non-technical
Windows/macOS client and a real revision API, and storing files as plain files we can point at the NAS.**

Syncthing loses not on sync quality (it is excellent) but on **RQ-2**: it has no concept of a person. Adopting
it would mean hand-writing the access-control layer, which is exactly the "don't build the hard part yourself"
rule the seed brief set — the rule just bites in a different place than expected.

### What we STILL have to build ourselves (honest list — none of this is free)

| # | Our code | Why |
|---|---|---|
| B-1 | **Identity bridge** — provision/deprovision a Nextcloud user per Orqafy user, ideally via OIDC with our Auth.js v5 as the IdP so there is one password. | Two user stores otherwise. This is the biggest single integration risk; spike it in Phase 1. |
| B-2 | **Permission reconciler** (BullMQ worker) — on `ProjectMember` change, create/rename the project's Team folder and grant/revoke the group. Must be idempotent and self-healing (periodic drift check), because our DB is the source of truth and Nextcloud is a replica of that truth. | Nextcloud will not read our RBAC by itself. |
| B-3 | **Attachment model** — `FileAttachment { fileId, path, etag, projectId, todoId?, invoiceId?, expenseId? }` keyed on the Nextcloud **file ID**, plus a resolver that survives moves/renames. | RQ-5. The "shortcut" UX in the seed brief is entirely ours. |
| B-4 | **Revision UI** — list/preview/restore over the WebDAV versions endpoint (`MOVE` into `…/restore`). | The API exists; the product surface does not. |
| B-5 | **Change feed** — polling (or the Nextcloud activity/webhook mechanism, ⚠ suitability unverified) so the app knows a file appeared and can raise a notification. | Needed to make files feel part of the app, not a separate drive. |
| B-6 | **Onboarding** — a one-click "connect your PC" page that hands the user the right server URL + app password/login link, and documents the client install. Possibly a small branded installer later (ties to D-3's native-installer track). | Non-technical users. |
| B-7 | **Storage placement + backup** — pointing Nextcloud's `data/` at the NAS share (R-2) with local-disk fallback, and backing up `data/` + its DB. `rclone` is the right tool for the offsite copy. | RQ-8. Keeps rclone in the stack in the role it is actually good at. |
| B-8 | **Documented limitation** — files already synced to a laptop are not revocable by removing a share; departure/off-boarding is a policy control, not a technical one. This is true of every sync product and must be stated in PRODUCT.md rather than implied away. | Governance honesty. |

### Sequencing note

Nothing here blocks Phase 0. **B-1 (the identity bridge) is the one item that can invalidate the choice** — if
OIDC-from-Auth.js into Nextcloud proves ugly, the fallback is per-user app-passwords minted by our backend
(supported, less elegant). Spike B-1 before the Drive module is scheduled, and keep every call behind a
`FileSyncProvider` interface (`createProjectFolder`, `grantAccess`, `revokeAccess`, `listVersions`,
`restoreVersion`, `getFileMeta`) so the Seafile fallback stays a swap, not a rewrite.

---

## 11. Appendix — the low-effort baseline, kept honest

**"No agent — web upload + WebDAV mount only."** This is not a candidate engine; it is Nextcloud (or any of
the central options) *minus the desktop client*. Worth stating because it is a legitimate v1.0 de-scope:

| | |
|---|---|
| **What it gives** | Full project-scoped ACL, versions, attachments, browser upload/download, and an optional native OS "Map network drive" / Finder Connect-to-Server over WebDAV — **zero** client software to install or support. |
| **What it costs** | WebDAV mounts are slow with large CAD files, offline-hostile, and flaky on Windows Explorer's native client. No offline work on site with poor connectivity — a real problem for construction. |
| **Recommendation** | Ship it as the **day-one** behaviour (it comes free with Nextcloud) and treat the desktop agent as an opt-in upgrade in the same release train. It de-risks the schedule without changing the engine choice. |

### 11.1 Interface to keep the decision reversible

```
FileSyncProvider  (our port; Nextcloud adapter first, Seafile adapter as fallback)
  createProjectFolder(projectId, name)      -> folderRef
  grantAccess(folderRef, userOrGroup, perms)
  revokeAccess(folderRef, userOrGroup)
  listVersions(fileRef)                     -> Version[]
  restoreVersion(fileRef, versionRef)
  getFileMeta(fileRef)                      -> { id, path, etag, size, mtime }
  putFile(folderRef, path, stream)          // used by the Expo photo path
```

---

## 12. Explicitly unverified (do not treat as fact)

1. Seafile **desktop client** licence — GitHub says Apache-2.0, third-party sources say GPLv2 CE. Resolve before any bundling/branding.
2. Seafile v12 database requirement (MariaDB mandatory vs SQLite still allowed).
3. Nextcloud `versions_retention_obligation` exact syntax and the current default retention curve.
4. Exact request/response shapes for the Seafile v2.1 library-create / share-to-group endpoints and the oCIS LibreGraph create-space / add-member endpoints (documented, not validated here).
5. Concrete RAM/CPU figures for Nextcloud and Syncthing at *our* expected scale (project count, file count). Measure on the real target box before locking hardware guidance.
6. Whether Nextcloud's webhook/activity mechanism is adequate for B-5, or whether polling is required.
7. OpenCloud's exact per-component licence split (Apache-2.0 core + some AGPL-3.0 parts, per project communications).
8. How much work a Nextcloud desktop-client rebrand actually is (RQ-10).

---

*Sources are linked inline. Primary references: Syncthing docs (versioning, REST config, untrusted devices,
tuning, FAQ), Nextcloud developer manual (OCS Share API, WebDAV Versions, OCS overview), nextcloud/groupfolders
README, Seafile admin/user manuals + community forum, rclone bisync manual, owncloud.dev LibreGraph docs,
project LICENSE files and the GitHub API repository metadata (fetched 2026-09-06).*
