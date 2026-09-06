# R-2 · NAS Storage — UGREEN NASync DH2300 (UGOS Pro)

> **Status:** Research decision doc. Answers `docs/SEED_BRIEF.md` §5 R-2.
> **Authored:** 2026-09-06 · **Scope:** [HOW] / agent-owned · **HARD HOLD:** local dev only, no deploy.
> **Verification posture:** every hardware/OS claim below is tagged **[V]** (verified against a cited
> source that names the DH2300 or UGOS Pro explicitly) or **[U]** (unverified — could not be confirmed
> for *this model*; a fallback that does not depend on it is given). Nothing here was filled from memory.

---

## 0. Executive summary (read this if nothing else)

| Question | Answer | Confidence |
|---|---|---|
| Does the DH2300 run Docker? | **No.** UGOS Pro on the DH2300 is a *simplified* build with Docker and VMs removed. The DH4300 Plus (same class of SoC) has it; the DH2300 does not. | **[V]** |
| Can we run MinIO **on** the NAS? | **No** — no Docker, no App Center container runtime, ARM64 + 4 GB fixed RAM. Unofficial root-level Docker installs exist but void the supported-config assumption. | **[V]** |
| Is there a native S3 endpoint? | **No S3 *server*.** UGOS Pro speaks S3 only as a **client** (Cloud Drives / sync *to* Amazon S3). It does not expose an S3-compatible endpoint of its own. | **[V]** for client; **[U]** that no hidden server exists — treated as absent. |
| So how do we write to it? | **The NAS is a mounted POSIX path, not an object store.** MinIO stays on the Linux Docker host and uses the NAS mount as its data directory. | Design decision |
| Net effect on the code | **Single code path preserved.** The app only ever speaks S3 (`@aws-sdk/client-s3`). NAS-vs-local is a *deployment* concern, not an application concern. | Design decision |

---

## 1. The hardware and what it bounds

### 1.1 DH2300 specifications (from UGREEN's own spec table)

| Attribute | Value | Source |
|---|---|---|
| Model / SKU | NASync DH2300 / 95087 | [UGREEN product page](https://ai.ugreen.com/products/ugreen-nasync-dh2300-nas-storage) **[V]** |
| CPU | Rockchip, 8-core **ARM Cortex-A72 + A53 @ 2.2 GHz** (`arm64`/`aarch64`) — widely reported as **RK3576** | UGREEN spec table (A72+A53 8-core) **[V]**; RK3576 part number from reviews **[V-secondary]** |
| RAM | **4 GB LPDDR4X, soldered, non-expandable** | UGREEN spec table **[V]** |
| System disk | 32 GB eMMC | UGREEN spec table **[V]** |
| Bays | 2 × SATA (3.5"/2.5"), max 64 TB (2 × 32 TB) | UGREEN spec table **[V]** |
| RAID | **JBOD / Basic / RAID 0 / RAID 1 only** — no RAID 5, **no SHR** | UGREEN spec table **[V]** |
| Network | **1 × 1 GbE RJ45** (single port, no 2.5 GbE, no LAG partner port) | UGREEN spec table **[V]** |
| Expansion | **No PCIe**, no NVMe cache slot | UGREEN spec table **[V]** |
| Other I/O | 1× USB-C 5 Gb/s, 2× USB-A 5 Gb/s, HDMI 4K60 | UGREEN spec table **[V]** |
| Power | 13.7 W active / 3.3 W hibernation | UGREEN spec table **[V]** |

**What this bounds:**

| Bound | Consequence for us |
|---|---|
| `arm64` + 4 GB fixed RAM | Even *with* an unofficial Docker, a MinIO + our worker stack on the NAS would contend with UGOS Pro's own services in 4 GB. Rules out "NAS as app host". |
| 1 GbE, single port | **~110–118 MB/s ceiling, shared** between app traffic, sync traffic and photo uploads. This is the real throughput budget for the whole file subsystem — plan around it, don't assume gigabit-per-consumer. |
| RAID 1 max (2-bay) | Usable capacity = one disk. **Redundancy against disk failure only** — not against deletion, ransomware, fire or theft. |
| No PCIe / no NVMe cache | Small-file IOPS are HDD-bound. Directly relevant to §4's "many small files" case. |

### 1.2 Docker — the decisive fact, verified by model

| Model | CPU | Docker (App Center) | Source |
|---|---|---|---|
| **DH2300** | ARM | **No** | [Need to Know IT model matrix](https://needtoknowit.com.au/blog/ugreen-nas-docker-containers-guide/) **[V]** |
| DH4300 Plus | ARM | No *(per that matrix)* — but multiple reviews report Docker **present** on DH4300 Plus and absent on DH2300 | Conflicting **[U]** — irrelevant to us, we own a DH2300 |
| DXP2800 / DXP4800 Plus / DXP4800 Pro | Intel | **Yes**, full App Center | Same matrix **[V]** |

Reviewers consistently describe the DH2300's UGOS Pro as a deliberately **"simplified"** build with Docker
(and VMs) stripped, despite the SoC being capable — e.g. the
[TechPowerUp DH2300 review](https://www.techpowerup.com/review/ugreen-nasync-dh2300/3.html) and
[NASCompares' DH2300 review](https://nascompares.com/2025/10/15/ugreen-dh2300-nas-review/) (the latter
returned HTTP 403 to automated fetch; its conclusion is quoted here from search-result excerpts —
**[V-secondary]**, worth re-reading manually before the doc is treated as final).

**Unofficial Docker is possible and documented** — see
[`deblasis/ugreen-dh2300-docker-davinci-resolve`](https://github.com/deblasis/ugreen-dh2300-docker-davinci-resolve),
a working Docker + PostgreSQL setup on a DH2300 explicitly described as a *"workaround for missing App
Center Docker support"* **[V]**. Reviewers note it requires enough system modification that UGOS stability
and future firmware updates are at risk **[V-secondary]**.

> **Ruling:** we do **not** build on unofficial NAS-side Docker. A firmware update that reverts it silently
> breaks the product's file storage on a customer's box. It stays a personal-tinkering option, never a
> supported deployment topology.

---

## 2. Protocols the DH2300 actually exposes

UGREEN documents the file-services set at **Control Panel → File Services**, where each protocol must be
individually enabled and the account granted folder permission
([UGREEN file-sharing guide](https://ai.ugreen.com/blogs/knowledge/network-storage-nas-guide)) **[V]**.

| Protocol | On DH2300? | Evidence | Use for us |
|---|---|---|---|
| **SMB/CIFS** | **Yes** | UGREEN guide + DH2300 reviews **[V]** | Viable mount. Best-documented, worst semantics for a POSIX app. |
| **NFS** | **Yes** | UGREEN guide documents `Control Panel > File Services > NFS` + per-folder rule with client address and **Squash** setting **[V]**; DH2300 reviews list NFS **[V-secondary]** | **Preferred mount.** Real POSIX semantics, uid/gid control via squash. |
| **WebDAV** | **Yes (optional service)** | DH2300 reviews list SMB/CIFS + NFS + WebDAV **[V-secondary]**; UGREEN lists WebDAV among NAS file services **[V]** | Not for a hot path. Chatty, poor for many small files. Emergency remote fallback only. |
| **FTP / SFTP** | **Very likely yes** | UGREEN states its NAS line supports "SMB, NFS, WebDAV, FTP and SFTP" **[V for the line]**; **not individually confirmed on the DH2300's simplified UGOS build — [U]** | Not a storage backend. SFTP is a fine ad-hoc admin/backup transport. |
| **rsync** | **Likely yes** (as a backup target/source) | DH2300-context reviews list "SMB, AFP, NFS and Rsync … optional WebDAV and FTP" **[V-secondary]**; **not confirmed on UGREEN's own DH2300 page — [U]** | Excellent for the *backup* leg (§6), not for live reads/writes. |
| **AFP** | Likely yes | Same review excerpt **[V-secondary]** | Irrelevant (Apple legacy). |
| **iSCSI** | **Unknown — [U]** | Not found for the DH2300; typically a higher-tier feature | If it existed it would be the cleanest block-level option. **Do not design for it.** |
| **S3 (server)** | **No** | UGOS Pro's S3 support is Cloud-Drives **sync to Amazon S3**, i.e. client-side **[V]** | — |
| **Docker / MinIO on NAS** | **No** | §1.2 **[V]** | — |

**Plain statement of doc thinness:** UGREEN does not publish a per-model file-services matrix. The DH2300's
product page lists hardware only; the protocol list is assembled from UGREEN's line-wide knowledge-base
articles plus third-party DH2300 reviews. **SMB and NFS are safe to assume. rsync, FTP/SFTP and iSCSI are
not.** The design in §5 depends on **NFS or SMB only** — nothing in the primary path rests on an [U] row.

---

## 3. Is there an S3-compatible endpoint? (the question that matters most)

| Option | Available on DH2300? | Verdict |
|---|---|---|
| Native S3 object-storage **server** in UGOS Pro | **No** — UGOS Pro's S3 is outbound sync (Cloud Drives → Amazon S3) **[V]** | Not available |
| MinIO **container on the NAS** | **No** — no Docker on this model **[V]** | Not available |
| MinIO on the NAS via unofficial Docker | Technically demonstrated **[V]**, unsupported, ARM64, 4 GB shared RAM | **Rejected** — fragile against firmware updates |
| **MinIO on the Linux Docker host, `/data` backed by an NFS/SMB mount of the NAS** | **Yes** | ✅ **This is the answer** |

### Why the last row keeps the single code path

The AIEF locked stack already talks **MinIO → S3**. Putting MinIO on the *host* and pointing its data
directory at the NAS mount means:

- The application layer never learns the NAS exists. One adapter, one set of credentials, one URL scheme.
- Presigned upload/download URLs, multipart uploads and lifecycle rules all keep working — none of which
  a raw SMB/NFS path could give us.
- Swapping NAS → cloud S3 → local disk later is a Compose/env change, not a code change.

**Verified client mechanics** (context7, `/aws/aws-sdk-js-v3`) — an S3-compatible non-AWS endpoint is a
first-class configuration, not a hack:

```ts
// S3Client against a self-hosted S3-compatible endpoint (MinIO)
new S3Client({
  endpoint: process.env.S3_ENDPOINT,   // e.g. http://minio:9000
  forcePathStyle: true,                // required for MinIO / non-vhost-style endpoints
  region: process.env.S3_REGION,       // any value; MinIO ignores it but the SDK requires one
  credentials: { accessKeyId: ..., secretAccessKey: ... },
});
```

- Presigned URLs: `getSignedUrl(client, command, { expiresIn })` from `@aws-sdk/s3-request-presigner`
  (default 900 s). **[V — context7 `/aws/aws-sdk-js-v3`]**
- Large photo uploads: `Upload` from `@aws-sdk/lib-storage` (the v3 replacement for v2's `ManagedUpload`),
  which handles multipart and emits `httpUploadProgress`; the default fetch handler emits progress only per
  completed part (≥5 MB). **[V — context7 `/aws/aws-sdk-js-v3`]**

> **Caveat, stated plainly and left as a test item:** MinIO's own guidance has historically been that its
> backend should be a **local block device**, not a network filesystem, because it relies on POSIX
> semantics (rename atomicity, locking, `O_DIRECT`) that NFS/SMB weaken. I did **not** verify MinIO's
> current stance for this doc — **[U]**. This is the single biggest thing to prove on real hardware (§7).
> If it proves unreliable, the fallback in §5.3 requires **no application change** — only a different
> adapter binding.

---

## 4. Mechanics per protocol, from a Linux Docker host

Assumes the app host is our normal Linux + Docker Compose box on the same LAN as the NAS.
UGOS Pro exposes shared folders under absolute host paths of the form `/volume1/<share>` on the NAS side
**[V — [Need to Know IT](https://needtoknowit.com.au/blog/ugreen-nas-docker-containers-guide/) documents
`/volume1/appdata` as the real UGOS Pro path form]**.

| Concern | **NFS** (preferred) | **SMB/CIFS** | **WebDAV** |
|---|---|---|---|
| Mount approach | `systemd .mount` + `.automount` unit, or Compose `driver_opts` volume with `type: nfs` | `cifs-utils` via `/etc/fstab` or Compose `driver_opts` `type: cifs` | `davfs2` mount, or app-level HTTP client |
| Recommended for prod | ✅ Yes | ⚠️ Workable | ❌ No |
| Credentials | **None on the wire** (NFSv3 host-based export rules) — authorize by client IP in the folder's NFS rule **[V]** | `credentials=/etc/orqafy/nas.cifs` file, mode `0600`, owned by root; **never** inline in `fstab`/Compose | Basic auth over HTTPS |
| Permissions / uid mapping | Real uid/gid pass through; controlled by the folder's **Squash** setting in UGOS Pro **[V]**. Set the container's user to a fixed uid/gid and match it NAS-side. | **No real uid mapping** — the whole mount is forced to one identity via `uid=`,`gid=`,`file_mode=`,`dir_mode=`. Everything appears owned by that uid. | None; HTTP identity only |
| Suggested options | `nfsvers=4.1,hard,timeo=600,retrans=2,noatime,_netdev` — `hard` so writes block-and-retry instead of silently erroring | `vers=3.1.1,uid=1001,gid=1001,file_mode=0660,dir_mode=0770,noatime,_netdev,soft` | — |
| NAS offline at boot | `systemd.automount` + `_netdev`: the mount is attempted on first access, boot is not blocked | Same with `_netdev,x-systemd.automount`; a bare `fstab` entry **will** hang or fail boot | Fails on request |
| NAS goes offline **while running** | `hard` ⇒ I/O blocks indefinitely (safe for data, **hangs the request thread** — must be paired with app-level timeouts). `soft` ⇒ `EIO`, risking silent truncation | Stale handles surface as `EIO`/`ESTALE`; recovery often needs a remount. Docker's `local` volume driver **will not remount by itself** | Errors immediately |
| **Stale-mount trap** | If the mount is a plain bind and the NAS drops, the container keeps writing into the **empty underlying host directory** — data silently lands on the local disk and looks fine until someone looks | Same trap | N/A |
| Many small files (thumbnails, sync deltas) | Best of the three; still round-trip-bound. Expect **thousands of ops/s at best**, HDD-limited, worse over 1 GbE with no NVMe cache | Noticeably worse — SMB is chattier per file open | Terrible — one HTTP request per file |
| Large photo uploads | Streams near line rate: **~110 MB/s ceiling on 1 GbE**, shared with all other NAS traffic | Similar ceiling, slightly lower efficiency | Poor |

**The stale-mount trap deserves its own rule.** Whichever protocol we pick, the mountpoint must be
**guarded by a sentinel file** (e.g. `.orqafy-nas-ok`) that only exists on the NAS. If the sentinel is
absent, the storage layer must treat the NAS as **down** and refuse to write — never fall through to the
bare host directory. This is the difference between "degrades gracefully" and "quietly loses a month of
site photos".

---

## 5. Recommended storage abstraction

### 5.1 One interface

A single async port, S3-shaped because S3 is the richest of the candidates (everything else can emulate it,
not vice versa). Presigned URLs are non-negotiable: without them, every photo upload from the mobile app
proxies through the Next.js server and burns app memory and the 1 GbE budget twice.

```ts
export interface FileStore {
  put(key: string, body: Readable | Buffer, meta: PutMeta): Promise<StoredObject>;
  get(key: string): Promise<Readable>;
  head(key: string): Promise<ObjectMeta | null>;
  delete(key: string): Promise<void>;
  list(prefix: string, opts?: ListOpts): Promise<ObjectMeta[]>;
  presignPut(key: string, opts: PresignOpts): Promise<string>;
  presignGet(key: string, opts: PresignOpts): Promise<string>;
  health(): Promise<{ ok: boolean; backend: string; detail?: string }>;
}
```

`health()` is part of the interface, not an afterthought — §5.4 depends on it.

### 5.2 Adapters

| Adapter | Backend | When it is used | Notes |
|---|---|---|---|
| **`S3FileStore`** | Any S3-compatible endpoint: MinIO on the host (NAS-backed **or** local-disk-backed), or real AWS S3 / R2 | **Primary — always.** Both the NAS deployment and the no-NAS deployment resolve to this adapter. | `forcePathStyle: true` for MinIO **[V]**; multipart via `@aws-sdk/lib-storage` **[V]** |
| **`LocalFsFileStore`** | A plain directory on the host | Dev machines, CI, tests, and a "no Docker infra at all" ultra-light install | Presign is emulated by issuing a short-lived signed token against our own `/api/files/:token` route — the interface stays honest, the mechanism differs |
| **`MountedPathFileStore`** | A mounted NAS share used **directly** as a filesystem, no MinIO | **Contingency only** — if §3's MinIO-over-NFS caveat proves fatal on real hardware | Thin subclass of `LocalFsFileStore` + the sentinel check. Loses nothing the app uses, since presign is already emulated there |

Note that the NAS is **not its own adapter** in the primary design. That is the point: the NAS is a
*storage medium under MinIO*, so the code path is identical with or without it.

### 5.3 The fallback ladder

| Rung | Configuration | Reached when |
|---|---|---|
| 1 | `S3FileStore` → MinIO → NAS mount (`/mnt/nas/orqafy`) | NAS present and healthy — the intended production shape |
| 2 | `S3FileStore` → MinIO → local host disk | No NAS, or MinIO-on-NFS fails validation (§7) |
| 3 | `MountedPathFileStore` → NAS mount, no MinIO | Only if rung 1 is disproven *and* the owner wants files physically on the NAS |
| 4 | `LocalFsFileStore` → `./data/files` | Dev / CI / single-box minimal install |

Rungs 1 and 2 are the **same adapter and the same code**, differing only in the Compose volume binding for
MinIO's `/data`. That is the whole prize.

### 5.4 Configuration + runtime detection

Configuration is **explicit, never magical**:

```
STORAGE_DRIVER=s3|local|mounted     # explicit; no auto-guessing of the driver
S3_ENDPOINT=http://minio:9000
S3_BUCKET=orqafy
S3_REGION=us-east-1
S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
NAS_MOUNTPOINT=/mnt/nas/orqafy      # informational; used only by the health probe
NAS_SENTINEL=.orqafy-nas-ok
STORAGE_FALLBACK=deny|local         # what to do when the primary is unhealthy
```

Detection rules — the part that stops silent data loss:

1. **Boot probe.** On startup, `health()` runs: bucket reachable, write-read-delete of a tiny canary object.
   Failure is logged loudly and surfaced in an admin health endpoint.
2. **Sentinel check** (when `NAS_MOUNTPOINT` is set). The mountpoint must contain `NAS_SENTINEL`. If it
   does not, the NAS is considered **down even though the directory exists** — this catches the stale/
   unmounted case that a bare existence check misses.
3. **Never silently downgrade writes.** `STORAGE_FALLBACK=deny` (the default) means an unhealthy primary
   returns a clear 503 to the user and queues nothing. Silent local fallback splits the corpus across two
   media and no one notices until a restore.
4. **`STORAGE_FALLBACK=local` is opt-in**, and when it engages the app must (a) log a warning per write,
   (b) mark those objects in the DB with their actual backend, and (c) expose a "N files pending migration
   to NAS" admin banner. **The DB must record which backend each object lives on** — otherwise reconciling
   after an outage is guesswork.
5. **Periodic re-probe** (e.g. every 60 s via BullMQ) so recovery is automatic and observable.

---

## 6. Backup and data safety

| Capability | DH2300 | Consequence |
|---|---|---|
| RAID | **JBOD / Basic / RAID 0 / RAID 1 only** **[V]** | With 2 bays, **RAID 1 is the only redundant option**; usable capacity = 1 disk. RAID 0/JBOD have *negative* safety value. |
| SHR (Synology-style hybrid RAID) | **Not offered** **[V]** — UGREEN's table lists no SHR | Do not plan for mixed-size-disk elasticity. |
| Snapshots | **Yes, via the UGOS Pro Snapshot app — Btrfs volumes only** **[V]**. Scheduled plans with count/age retention. **Not available on ext4 volumes.** **[V-secondary]** | If the owner formats the pool ext4, snapshots are gone. **Format the pool Btrfs.** |
| Snapshot durability | Snapshots live **inside the storage space they protect** — lost with the pool, the box, theft or fire **[V-secondary]** | Snapshots are an *undo button*, not a backup. |
| Off-box backup | rsync **[U for DH2300]**, USB (5 Gb/s ports **[V]**), UGOS Cloud Drives → Amazon S3 **[V]** | At least one off-box copy is mandatory. USB target is the only fully-verified-for-this-model path. |

### What the application must **NOT** assume

| Must not assume | Why | What we do instead |
|---|---|---|
| RAID 1 = backup | Protects against **one disk dying**, nothing else. Deletion, ransomware and theft pass straight through. | 3-2-1: NAS (RAID 1) + off-box copy + one off-site. |
| A snapshot exists to undo a bad write | Snapshots are a NAS-admin schedule the app cannot see, and are Btrfs-only. | The app keeps **its own** revision history for file management (SEED_BRIEF §3f already requires it). Never delegate versioning to the NAS. |
| Deleting an object is recoverable | It is not, by default. | Soft-delete in the DB; a retention job hard-deletes later. Deletes go through the abstraction, never `rm` on the mount. |
| The mount is always there | §4's stale-mount trap. | Sentinel + `health()` + `deny` fallback. |
| Filesystem semantics are POSIX-strong | SMB/NFS weaken locking and rename atomicity. | Never use the mount for locks, queues or "write temp then rename" as a correctness primitive — that is what Postgres and Valkey are for. |
| Case sensitivity and filename charset are stable | SMB is case-insensitive; Btrfs/ext4 are case-sensitive. | Store a generated opaque key (UUID/hash) as the object key; the human filename is DB metadata only. **This also kills a whole class of path-traversal bugs.** |
| Capacity is unbounded | 64 TB hard cap; RAID 1 halves it; construction photo sets grow fast. | Quota per project + a capacity metric in the admin health panel. |

---

## 7. RECOMMENDATION

### Primary path

**MinIO on the Linux Docker host, with its `/data` volume bound to an NFSv4.1 mount of a Btrfs, RAID-1
DH2300 share. The application speaks only S3, via a single `S3FileStore` adapter.**

| Element | Choice |
|---|---|
| Protocol to the NAS | **NFS** (v4.1, `hard`, `_netdev`, `systemd.automount`) — real POSIX semantics and uid control; SMB only if NFS proves problematic on UGOS Pro |
| Object layer | **MinIO on the host**, not on the NAS (no Docker on the DH2300 — **[V]**) |
| App-facing contract | **S3 only** (`@aws-sdk/client-s3`, `forcePathStyle: true`, presigned PUT/GET, `lib-storage` multipart) |
| NAS pool format | **Btrfs**, **RAID 1** — Btrfs is a hard prerequisite for UGOS Pro snapshots **[V]** |
| Object keys | Opaque UUID/hash; human filename is DB metadata |

### Fallback (no NAS present — must work out of the box)

**Same adapter, same code.** `STORAGE_DRIVER=s3` → MinIO → a plain host-disk volume. The Compose bundle
ships this as the default so `docker compose up` works on a bare laptop with no NAS anywhere. NAS adoption
is then a one-line volume change plus a mount unit — never a code change or a migration of application
logic. `LocalFsFileStore` covers dev/CI and a minimal no-MinIO install; `MountedPathFileStore` sits in the
tree as the contingency described below.

Default `STORAGE_FALLBACK=deny`: **when the NAS is unhealthy, writes fail loudly.** Silent degradation to
local disk is opt-in and always visible in the admin UI.

### The decision that must be re-tested against real hardware

**Does MinIO run correctly and durably with its backend on an NFS mount of the DH2300?** This is the one
assumption the whole primary path rests on, and it is currently **[U]** — MinIO has historically preferred
local block devices for POSIX-semantics reasons, and I did not verify its current position. Test on the
real box before Phase 0 closes:

| # | Test | Pass criterion |
|---|---|---|
| 1 | MinIO cold start against the NFS-backed volume | Starts clean, no lock/rename errors in logs over 24 h |
| 2 | Concurrent multipart uploads of 20 × 30 MB photos | All complete, checksums match, no partial objects |
| 3 | 10,000 small objects written then listed | Completes in a workable time; record actual ops/s as the sync-engine budget |
| 4 | Yank the NAS mid-write (unplug LAN) | App returns 503 via `health()`/sentinel; **nothing** lands on the host disk; recovery is automatic on reconnect |
| 5 | Sustained large-file throughput | Establishes the real 1 GbE ceiling; feeds the R-3 sync-engine design |
| 6 | Confirm rsync / SFTP / FTP presence in Control Panel → File Services | Resolves the **[U]** rows in §2 and fixes the backup leg in §6 |
| 7 | Confirm the pool can be created as **Btrfs** and the Snapshot app is present | Confirms §6; if the DH2300's simplified UGOS lacks the Snapshot app, off-box backup becomes the *only* recovery path |

If test 1, 2 or 4 fails: switch the deployment to rung 3 (`MountedPathFileStore` writing to the NAS mount
directly, no MinIO). **The application layer does not change** — that is precisely why the abstraction is
shaped the way it is.

---

## Sources

- [UGREEN NASync DH2300 official product page (spec table: CPU, RAM, RAID, LAN, eMMC)](https://ai.ugreen.com/products/ugreen-nasync-dh2300-nas-storage)
- [Need to Know IT — Docker on UGREEN NAS: which models support it (model matrix; `/volume1` path form)](https://needtoknowit.com.au/blog/ugreen-nas-docker-containers-guide/)
- [UGREEN — NAS File Sharing: SMB, NFS & Shared Folders (Control Panel → File Services; NFS squash rules)](https://ai.ugreen.com/blogs/knowledge/network-storage-nas-guide)
- [UGREEN — How to Use Docker and Docker Compose on UGREEN NAS](https://ai.ugreen.com/blogs/knowledge/docker-docker-compose-ugreen-nas)
- [TechPowerUp — NASync DH2300 review, Initial Setup & UGOS Pro](https://www.techpowerup.com/review/ugreen-nasync-dh2300/3.html)
- [NASCompares — UGREEN DH2300 NAS review](https://nascompares.com/2025/10/15/ugreen-dh2300-nas-review/) *(HTTP 403 to automated fetch; cited from search excerpts — verify manually)*
- [deblasis/ugreen-dh2300-docker-davinci-resolve — unofficial Docker on DH2300](https://github.com/deblasis/ugreen-dh2300-docker-davinci-resolve)
- [Geeky Gadgets — UGREEN Snapshots feature (Btrfs-only, retention plans)](https://www.geeky-gadgets.com/ugreen-snapshot-overview/)
- context7 `/aws/aws-sdk-js-v3` — `S3Client` custom `endpoint` + `forcePathStyle`; `getSignedUrl` presigning; `@aws-sdk/lib-storage` `Upload` multipart + progress events

**Explicitly unverified:** rsync / FTP / SFTP / iSCSI availability on the DH2300's simplified UGOS Pro
build; the existence of any hidden S3 *server* endpoint; MinIO's current supported stance on
network-filesystem backends. None of these are load-bearing for the primary recommendation, and each has a
test in §7.
