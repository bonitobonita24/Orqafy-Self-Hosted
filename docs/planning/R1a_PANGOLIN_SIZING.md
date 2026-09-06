# R-1a · Pangolin CE — licensing, VPS sizing, and co-tenancy

> **Status:** RESEARCH COMPLETE. Follow-up to `R1_REMOTE_ACCESS.md` (which recommends Pangolin CE).
> **Researched:** 2026-09-06. All facts pulled live on that date from `pangolin.net`, `docs.pangolin.net`,
> the `fosrl/*` GitHub repos, and the Fossorial Commercial License text. Where a fact could not be
> verified from a primary source it is labelled **unverified**.
> **Scope:** the three owner questions — (1) licensing / user limits, (2) VPS resource + bandwidth
> footprint, (3) co-tenancy risk on a VPS already running production apps.

---

## 0. One thing to fix before reading further

**Pangolin has two completely separate products with two completely separate limit tables, and they
are easy to confuse.** The `pangolin.net/pricing` page shows both behind a tab switch:

| | **Pangolin Cloud** (the tab that loads by default) | **Self-Hosted** (what we would run) |
|---|---|---|
| Free tier name | **Basic** | **Community** |
| Free tier user cap | **"Up to 5 users"** | **no cap** (see §1.2) |
| Free tier site cap | 5 | no cap |
| Who runs the control plane | Fossorial | us / the firm |

The widely-quoted **"5 users"** figure is the **Cloud Basic** limit. It does **not** apply to the
self-hosted Community Edition. Source: [pangolin.net/pricing](https://pangolin.net/pricing) — Cloud tab
(`Basic … Up to 5 users`) vs. Self-Hosted tab (`Community … Free … AGPLv3 · community support`).

---

## 1. Licensing and limits

### 1.1 What CE is licensed under — current as of 2026-09-06

The repo's root `LICENSE` is a **split-licence header followed by the full AGPL-3.0 text**
([fosrl/pangolin/LICENSE](https://github.com/fosrl/pangolin/blob/main/LICENSE)):

> Copyright (c) 2025 Fossorial, Inc. Portions of this software are licensed as follows:
> * All files that include a header specifying they are licensed under the "Fossorial Commercial
>   License" are governed by the Fossorial Commercial License terms…
> * All files that include a header specifying they are licensed under the GNU Affero General Public
>   License, Version 3 ("AGPL-3"), are governed by the AGPL-3 terms…
> * **All files without a license header are, by default, licensed under the GNU Affero General Public
>   License, Version 3 (AGPL-3).**

GitHub reports the repo licence as `NOASSERTION` because of that split. The pricing page's Self-Hosted
feature matrix states the licence per tier explicitly: **Community = `AGPLv3`**, Starter/Scale/Enterprise
= `Fossorial Commercial License`.

The commercially-licensed source is physically segregated under `server/private/**` and
`src/app/[orgId]/settings/(private)/**`; the CE build uses `tsconfig.oss.json` and the EE build
`tsconfig.enterprise.json` (verified from the repo file tree).

**The satellite components we would actually deploy are plain permissive/copyleft, no split:**

| Component | Repo | Licence (verified via GitHub API, 2026-09-06) | Role |
|---|---|---|---|
| Pangolin (control plane) | `fosrl/pangolin` | `NOASSERTION` — AGPL-3.0 + FCL split as above | dashboard, API, policy |
| Newt (site connector) | [`fosrl/newt`](https://github.com/fosrl/newt) | **AGPL-3.0** | the container that runs next to Orqafy |
| Gerbil (tunnel manager/relay) | [`fosrl/gerbil`](https://github.com/fosrl/gerbil) | **AGPL-3.0** | WireGuard peers, relay, owns :80/:443 |
| Olm (client net stack) | [`fosrl/olm`](https://github.com/fosrl/olm) | **AGPL-3.0** | not used by us |
| Badger (Traefik forward-auth) | [`fosrl/badger`](https://github.com/fosrl/badger) | **MIT** | auth middleware |

### 1.2 Does CE cap users, sites, resources, orgs, or connections?

**No. There is no numeric cap in Community Edition.** This is verified two independent ways.

**(a) The vendor's own feature matrix.** From the Self-Hosted tab of
[pangolin.net/pricing](https://pangolin.net/pricing), section "Limits" (values are literal, `-` means
*no limit stated for that tier*):

| Limit | **Community** | Starter ($449/yr) | Scale ($1249/yr) | Enterprise |
|---|---|---|---|---|
| Sites | **-** | 25 | 100 | Custom |
| Users | **-** | 25 | 50 | Custom |

Note the shape: the **paid** self-hosted tiers are the ones that carry caps (a licence key encodes a
quantity). Community, having no key, has nothing to enforce.

**(b) The source code.** Limit enforcement is gated on the SaaS build only —
[`server/middlewares/verifyLimits.ts`](https://github.com/fosrl/pangolin/blob/main/server/middlewares/verifyLimits.ts):

```ts
export async function verifyLimits(req, res, next) {
    if (build != "saas") {
        return next();          // <- CE and EE self-host: no limit check at all
    }
    ...
}
```

and the OSS licence stub
[`server/license/license.ts`](https://github.com/fosrl/pangolin/blob/main/server/license/license.ts)
always returns `isHostLicensed: false, isLicenseValid: false` with **no `maxUsers` / `maxSites` values
populated**, and `isUnlocked()` hard-returns `false`. The effect is: *EE features are locked, nothing is
counted*. No org cap, no resource cap, no concurrent-connection cap appears anywhere in the CE path.

**Conclusion: unlimited users, sites, resources, orgs and connections on self-hosted CE.** The only
ceiling is hardware and the throughput bottleneck in §2.4.

### 1.3 What is paywalled — and would a construction firm hit it?

Enterprise Edition is a **different Docker image** (`fosrl/pangolin:ee-latest` instead of
`fosrl/pangolin:latest`) plus a licence key activated at `/admin/license`
([Enterprise Edition docs](https://docs.pangolin.net/self-host/enterprise-edition)). Switching editions
is "a container swap" and the two share a database schema, so this is reversible.

Full Self-Hosted matrix, transcribed from [pangolin.net/pricing](https://pangolin.net/pricing):

| Area | **In Community (free)** | **EE-only (licence key required)** |
|---|---|---|
| Identity | 2FA · **server-level IdPs** · **OAuth2/OIDC IdPs** · IdP user auto-provisioning | Multiple roles per user (RBAC) · tenant-isolated IdPs · **Azure IdP** · **Google IdP** · role-based SSH mgmt |
| Security | Geoblocking | 2FA enforcement policy · session-duration policy · password-expiration policy · device posture · credential rotation · device approvals |
| Logging & audit | — *(nothing)* | **HTTP request logs · authentication logs · network logs · admin action logs · CSV export · SIEM streaming** |
| Platform | API keys · multi-site routing · Blueprints (declarative config) · labels & tagging · browser SSH/RDP/VNC · private resources | Wildcard resources · standalone health checks · maintenance page · site provisioning keys · **alert rules & notifications** · automatic site updates · shared resource policies |
| Branding | — | Custom branding (colours, logo) |
| HA | — | Multi-node clustering + geo distribution (**Enterprise tier only**, not Starter/Scale) |
| Support | Community only | Email / ticket / SLA by tier |

**⚠ Correction to `R1_REMOTE_ACCESS.md`:** that doc lists SSO/OIDC as a likely paywall risk. It is not —
**generic OAuth2/OIDC IdPs and server-level IdPs are in CE.** Only the *branded* Azure/Google connectors
and *tenant-isolated* (per-org) IdPs are EE.

**What a self-hosted construction firm would actually hit, in priority order:**

1. **Audit and access logging — the real one.** *Every* log surface (who logged in, who opened which
   resource, admin actions) is EE. A firm that wants "who downloaded the structural drawings on
   Tuesday" gets nothing from CE's edge. **Mitigation: Orqafy logs this itself** at the application
   layer, where it belongs — Pangolin's edge log is a nice-to-have, not the system of record. This is
   the single most important design consequence of choosing CE.
2. **Multiple roles per user (RBAC).** CE gives one role per user at the Pangolin edge. Again largely
   moot: Orqafy carries its own RBAC; Pangolin's job is "is this person allowed through the door at
   all", not per-module permissions.
3. **Alert rules & notifications / standalone health checks.** "Tell me when the office desktop's
   tunnel drops" is EE. Mitigation: external uptime monitoring (Uptime Kuma already runs on
   Powerbyte-Hostinger).
4. **Custom branding.** The Pangolin login page cannot be white-labelled on CE. Only visible if we put
   Pangolin's own auth in front of Orqafy — if Orqafy handles its own login and Pangolin is a pure
   proxy, the firm never sees a Pangolin-branded screen.
5. **Wildcard resources.** Each hostname must be added individually on CE. With one app on one domain,
   irrelevant.

**Cost if we ever wanted EE.** EE is **free (still needs a key)** for "personal use and organizations
with **less than \$100,000 USD** gross annual revenue"; "Organizations with **\$100,000+ USD** gross
annual revenue require a **paid commercial license**"
([EE docs](https://docs.pangolin.net/self-host/enterprise-edition)). A real construction firm is over
that line, so EE for them means **Starter \$449/yr (25 users, 25 sites)** or **Scale \$1249/yr (50 users,
100 sites)** — and **one licence key per Pangolin server instance**, not shareable across servers. CE
sidesteps all of this.

### 1.4 Commercial use, and redistribution inside our bundle

**Commercial use of CE: yes, unambiguously.** AGPL-3.0 carries no field-of-use restriction. A firm
running an unmodified CE for its own business triggers **no** obligation at all: no conveying (they
distribute nothing) and no §13 network trigger (§13 applies to *modified* versions offered over a
network). Fossorial's own framing agrees — CE is "Free, open-source, and licensed under AGPL-3"
([README](https://github.com/fosrl/pangolin#readme)) with no revenue threshold attached; the \$100K
threshold is attached to **Enterprise Edition** only.

**Redistribution as part of an Orqafy install bundle — three cases, and only one is dangerous:**

| What we ship | Verdict |
|---|---|
| **A compose file that *references* `docker.io/fosrl/pangolin:latest` + `fosrl/gerbil` + `fosrl/newt` by image name** — our own file, their images pulled from Docker Hub by the user | ✅ **Safe, and this is what we should do.** We distribute a URL, not their code. No AGPL obligation is even triggered because nothing of theirs is conveyed. Our compose file is our own work under our AGPL-3.0. |
| **Actually redistributing CE source or binaries/images inside our release artefact** | ✅ **Permitted** — AGPL-3.0 explicitly grants redistribution — **but** we must then carry the AGPL-3.0 text, keep copyright notices intact, and offer corresponding source for what we ship. Our product is already AGPL-3.0 (D-2), so licence compatibility is fine. Adds release-engineering burden for no benefit. **Don't.** |
| **Referencing or bundling the Enterprise image `fosrl/pangolin:ee-*`** | 🚫 **Forbidden.** The [Fossorial Commercial License](https://pangolin.net/fcl) prohibits, for the Licensed Software: *"(7) Resell or redistribute the Licensed Software as-is, **or provide third-party access to Fossorial container images or other deployment artifacts**"*, and *"(8) Allow any third party to deploy, host, or operate any component of the Licensed Software."* It also bars *"(5) Resell, sublicense, or repackage the Licensed Software as a competing product, standalone SaaS product, standalone offering, or derivative solution."* **Note the scope: the FCL governs the EE/paid tier only — it does not reach CE.** But it means the `ee-*` tag must never appear in anything we ship. |

**Standing rule for this repo:** *reference the CE image tag only, never `ee-*`; never vendor or fork
Pangolin/Newt/Gerbil source into `Orqafy-Self-Hosted`.* (This already matches the existing
`R1_REMOTE_ACCESS.md` §2.1 conclusion — this doc confirms it against the licence text.)

**Trademark stance.** **No dedicated trademark policy or `TRADEMARK.md` exists** in `fosrl/pangolin`
(verified — repo root contains only `LICENSE`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`). The only
primary statement found is [Terms of Service §4.2](https://pangolin.net/tos) (last modified 2026-06-09):

> The Fossorial name and logos are trademarks and service marks of Fossorial (collectively the
> "Fossorial Trademarks").

That ToS governs *their hosted Services*, not the AGPL software, so **whether it binds a self-host
redistributor is unverified**. The FCL separately bars *"Remove, alter, or obscure any notices
(including copyright, trademark, or branding) of Fossorial"* — again EE-scoped. **Safe posture, costs us
nothing:** nominative use only ("Orqafy works with Pangolin", "requires a Pangolin CE server"); never
put the Pangolin name or logo in Orqafy's branding, product name, or UI chrome; never imply endorsement.

---

## 2. VPS resource usage

### 2.1 Vendor-stated sizing

From [Choosing a VPS](https://docs.pangolin.net/self-host/choosing-a-vps):

> Pangolin generally requires minimal resources to run effectively. A basic VPS with **1 vCPU, 2GB RAM,
> and 8GB SSD** is sufficient for most deployments. […] If you choose a VPS with only 1GB RAM, you may
> need to create swap space.

| Tier (vendor's own labels) | CPU | RAM | Disk |
|---|---|---|---|
| Minimum ("sufficient for most deployments") | 1 vCPU | 2 GB | 8 GB SSD |
| **Recommended** | **2 vCPU** | **2 GB** | **20 GB SSD** |
| "More Users or Sites" | 4 vCPU | 4 GB | 40 GB SSD |
| "Large Deployment" | 8 vCPU | 8 GB | 80 GB SSD |

Vendor's stated drivers: *primary* = number of connected sites + data throughput; *secondary* =
dashboard usage + database activity.

Required open ports (from [DNS & Networking](https://docs.pangolin.net/self-host/dns-and-networking)):
**TCP 80, TCP 443, UDP 51820** (site tunnels) and **UDP 21820** (client relay — only needed if we use
Pangolin clients, which we do not). Plus a wildcard `A` record `*.domain → VPS IP`.

### 2.2 Idle and light-load footprint (measured, third-party)

The vendor publishes no idle figure. The best primary-ish measurement is a first-hand `docker stats`
report in [fosrl Discussion #512](https://github.com/orgs/fosrl/discussions/512) from a user on an
**OVH VPS S — 2 vCPU / 2 GB RAM** running Pangolin 1.6.2 + Gerbil 1.0.0 + Traefik 3.4.4:

> Pangolin/Gerbil/Traefik/Newt combined consistently stay **under 10% CPU and 10% RAM** usage, even when
> launching 5 streams or downloads in parallel.

On a 2 GB box that is **< ~200 MB RAM and < ~0.2 vCPU** under a five-stream load. Aggregated blog/tutorial
figures put the three containers nearer **~650 MB** — **unverified**, no primary source located; treat the
`docker stats` figure above as the reliable one and budget ~700 MB to be safe.

For our shape — **3–15 concurrent users, ONE downstream site, one app** — control-plane load is
effectively noise. **RAM is not the constraint. CPU headroom is not the constraint.**

⚠ One caution: [issue #2120](https://github.com/fosrl/pangolin/issues/2120) reports a memory leak
introduced in 1.13.1. Pin a version and watch RSS after upgrades; do not run `:latest` unattended.

### 2.3 Does user file traffic transit the VPS? **Yes. All of it.**

This is the decisive answer and it is stated explicitly in the vendor's own
[System Architecture](https://docs.pangolin.net/development/system-architecture) page.

**Public resources (what Orqafy is — a browser/Expo app hitting `https://app.firm.com`):**

> ```
> Internet → Node ingress (Traefik) → Auth (Badger) → Tunnel (Gerbil) → Site connector (Newt) → Backend target
> ```
> HTTP, HTTPS, SSH, RDP, and VNC public resources terminate authentication at the node before traffic
> enters the tunnel.

There is **no peer-to-peer path for a browser**. The peer-to-peer/hole-punching feature the marketing
mentions is a *different flow entirely*:

> **Outbound: private resources via client** — `Client ↔ (direct peer or relay via Gerbil) ↔ Site
> connector (Newt) → Destination on remote network`. Private resources are reachable only when a client
> is connected and authorized.

i.e. P2P requires the **Pangolin client app installed on the user's device** — precisely the
zero-client property we chose Pangolin *for* (`R1_REMOTE_ACCESS.md` C3/C4). We cannot have both.

**Bandwidth implication, stated plainly:**

> **Every byte a site engineer uploads or downloads — every photo, every drawing, every project file —
> crosses the VPS twice: once inbound from the user over TLS, once outbound into the WireGuard tunnel
> to the office desktop (and the mirror image on download). The VPS terminates TLS for all of it. It is
> a full bandwidth-and-CPU relay, not a signalling server.**

The docs also warn about the security consequence of this: *"By tunneling out to the VPS, you are
effectively including the VPS in your security boundary, so you must secure it as part of your overall
network strategy."*

### 2.4 The actual bottleneck — and it is not what you'd guess

Not RAM. Not TLS CPU. It is **per-connection throughput in the Newt/Gerbil userspace WireGuard data
path**, and it is a known, acknowledged, still-open limitation.

[Discussion #512](https://github.com/orgs/fosrl/discussions/512) — opened Apr 2025, **still active
2026-08-31** — collects consistent reports of single-stream transfer collapsing far below available
bandwidth: ~4 MB/s on a 1 Gbit home line + 2.5 Gbit VPS; ~1 MB/s on 500 Mbit symmetric fibre with the
VPS at <10% CPU and `iperf3` proving 450 Mbit/s end-to-end. Diagnosis in-thread:

> …a key limitation is the **sequential processing of packets**, which significantly restricts
> throughput speeds especially for high-bandwidth use cases like 4K video streaming and large file
> transfers. While the core team has acknowledged that parallel processing is both desirable and
> feasible, it has not yet been implemented…

Maintainer `oschwartz10612` (2025-08-16) confirmed it, pointing at `newt/proxy/manager.go`:
*"If not I DO want to do this soon and I am sorry for the slow speed… I also think there is an issue
with too many UDP sockets being created."*

**Current state (2026-08-28, the most recent data points in the thread — this is materially better):**
with **Newt 1.16.0** and `USE_NATIVE_MAIN_INTERFACE=true` (native kernel WireGuard instead of the
userspace netstack), one user reports *"x4 in bandwidth and a lot more stability"* on a Hetzner CAX11
(2 ARM vCPU / 4 GB), with the VPS *"never going beyond 50% CPU whereas it would go up to 200% instantly
with the netstack2 interface."* Another measures **~500 Mbit/s with 8 parallel TCP streams**, but
**single-stream still pinned at ~180–185 Mbit/s**.

**Why the single-stream number is the one that matters for us:** a photo upload, a file download, a
document sync are each *one TCP connection*. ~180 Mbit/s ≈ 22 MB/s is genuinely fine for site photos
(a 5 MB photo in ~0.2 s of transfer time). Without the native-interface flag, the historical ~1–6 MB/s
reports would make a 200 MB drawing set painful. **Action item: `USE_NATIVE_MAIN_INTERFACE=true`,
`network_mode: host`, and a pinned Newt ≥ 1.16.0 are non-negotiable in our Newt compose service, and
must be throughput-tested before any customer install.** (Also reported in-thread: running Newt in
Docker *bridge* mode costs measurable throughput vs. host mode / native install.)

### 2.5 What a 2 vCPU / 8 GB-class VPS realistically supports

| Dimension | Verdict for 3–15 users, 1 site, Orqafy workload |
|---|---|
| **RAM** | Enormously oversized. ~700 MB is the whole stack. 8 GB buys nothing here; **2 GB is the vendor's recommendation and is honest.** |
| **CPU** | Not the limit for the control plane. It *is* consumed by the tunnel path — the report above showed 200% CPU (both cores pegged) on the userspace netstack and ~50% on native. So 2 vCPU is right-sized *only with* the native-interface config; otherwise CPU does become the ceiling. |
| **Disk** | 20 GB is plenty (SQLite + certs + Traefik logs). No user file ever lands on the VPS — files live on the office desktop. Rotate Traefik access logs. |
| **Concurrent users** | 15 concurrent browsers is trivial for Traefik. The constraint is aggregate bytes, not session count. |
| **Real ceiling** | **(1) single-stream tunnel throughput (§2.4), then (2) the provider's monthly transfer quota (§2.6), then (3) CPU.** RAM never. |

**Recommendation: do not buy the 8 GB box for Pangolin.** A **2 vCPU / 2–4 GB / 20–40 GB** VPS with a
**generous transfer allowance and a Singapore/SEA point of presence** is the correct purchase for PH
latency. Spend the money on bandwidth and location, not RAM.

### 2.6 Monthly transfer quota — a genuine concern for a file/photo product

The vendor names this itself, under "Cost Considerations":

> **Hidden costs to watch for:** **Bandwidth overages: Most plans include 1-2TB/month** […]

Because traffic is relayed, **the VPS NIC sees each byte twice** (ingress from user + egress into the
tunnel), and most providers meter egress — some meter both. Rough sizing for Orqafy:

- 15 engineers × 40 site photos/day × 4 MB ≈ **2.4 GB/day inbound**, which the VPS then re-sends into
  the tunnel → **~4.8 GB/day** across the NIC → **~145 GB/month** just for photo capture.
- Add office-side viewing/downloading of those photos and project files (the reverse direction, also
  doubled) and a realistic figure is **300–600 GB/month**, with spikes on drawing-set revisions.

That fits comfortably inside a 1–2 TB allowance, **but it is the same order of magnitude, not two
orders below it** — so this is a line item to watch, not one to ignore. Guidance:

- Prefer providers with large or unmetered-fair-use transfer (Hetzner, Contabo) over ones with tight
  caps and per-GB overage. **Avoid Oracle Free Tier** — a user in #512 reports its 480 Mbps network cap
  plus Pangolin overhead yielding 2–3 MB/s in practice.
- Verify the *overage price*, not just the included allowance, before committing a customer.
- Design decision to carry into R-3 (file sync): anything that lets a phone on the office Wi-Fi reach
  the desktop **directly on the LAN** rather than out-and-back through the VPS removes that traffic
  from the quota entirely. Worth designing for.

---

## 3. Co-tenancy risk — installing Pangolin on a VPS already running production apps

### 3.1 What Pangolin actually binds on the host

From the [manual Docker Compose](https://docs.pangolin.net/self-host/manual/docker-compose) reference
(the installer generates the same layout):

```yaml
gerbil:
  ports:
    - 51820:51820/udp   # site (Newt) tunnels
    - 21820:21820/udp   # client relay tunnels
    - 443:443           # published on GERBIL, used by Traefik
    - 80:80             # published on GERBIL, used by Traefik
traefik:
  network_mode: service:gerbil     # <-- Traefik has NO network stack of its own
networks:
  default:
    driver: bridge
    name: pangolin
```

Three structural facts follow, and they are the whole answer to this question:

1. **Pangolin publishes host ports 80 and 443.** Not optionally — the ingress design requires them
   (ACME HTTP-01 on :80, everything else on :443).
2. **Its Traefik has no network namespace of its own** — `network_mode: service:gerbil` puts Traefik
   *inside Gerbil's* namespace so packets can be routed into WireGuard. Traefik therefore **cannot
   also join your other Docker app networks** the ordinary way.
3. **Its Traefik is remotely driven.** The config points its HTTP provider at
   `http://pangolin:3001/api/v1/traefik-config` with a 5 s poll, loads the Badger plugin, and owns its
   own Let's Encrypt `acme.json`. Pangolin *is* the Traefik controller. It is not a passive proxy you
   can add routes to alongside your own.

### 3.2 The realistic conflicts

| Conflict | Severity | Detail |
|---|---|---|
| **TCP 80 / 443 contention** | 🔴 **Blocking** | An existing production Traefik already binds both. Two containers cannot publish the same host port. The install simply fails or the existing proxy breaks. |
| **UDP 51820** | 🟠 **Likely** | The WireGuard default port. Any existing WireGuard/wg-easy/Headscale-DERP on that box collides. Configurable, but it must be changed on both ends. |
| **UDP 21820** | 🟢 Low | Only needed for Pangolin *clients*. We use none — can be left closed. |
| **Docker network collision** | 🟢 Low | Creates a bridge network literally named `pangolin` from Docker's default address pool. Collides only on a name clash or an exhausted/overlapping pool. Not the real problem. |
| **Does it want to own the host's reverse proxy?** | 🔴 **Yes, effectively** | Per §3.1(3) it is a Traefik *control plane* with a remote dynamic-config provider and its own ACME store, and it expects a wildcard `*.domain → VPS IP` record. Sharing it with hand-written routers for unrelated apps means your routes live in a config Pangolin rewrites every 5 seconds. |

### 3.3 The options people have actually tried, and how they went

[Discussion #457 — "Setup Pangolin with existing traefik instance"](https://github.com/orgs/fosrl/discussions/457)
is the canonical thread. **It is still marked `Unanswered`** — there is no official supported answer.

- **Option A — move your existing Traefik into Gerbil's namespace (the vendor-shaped path).** A
  contributor's advice in-thread: *"traefik should exit through gerbil if you want a tunnel… it will
  break stuff, that's for sure."* The original asker's objection stands unrefuted:
  > When I make my existing and only traefik instance routed through gerbil container, then all my
  > other service not only depend on traefiks stability but on gerbils too, because if the container
  > stops all traffic is dropped… That is why I can not consider this a stable solution.

  Echoed by another participant: *"If Gerbil dies, Traefik dies with it. If WireGuard fails or stalls,
  all of Traefik's traffic halts — not just Pangolin-related routing… That's a big red flag in terms of
  high availability, fault tolerance, and modularity."* **This is the accurate summary: you couple the
  uptime of every unrelated production app on that host to Gerbil's WireGuard process.**
- **Option B — a TCP/SNI splitter (HAProxy or nginx `stream`) in front of two Traefiks on :443.**
  Proposed in-thread (2026-04-09) as the way to save a second VPS, with `trustedIPs` set on both
  Traefiks' entrypoints to preserve client IPs. The proposer states plainly: *"Never had done that by
  myself so far but in theory it should work."* **Untested, adds a third proxy hop to a stack whose
  known weakness is already throughput (§2.4), and makes TLS/real-IP handling subtle. Not a path to put
  a customer on.**
- **Option C — subdomain delegation.** Front Traefik matches `HostRegex(sub.main.tld)` and forwards to
  Pangolin's Traefik. Works, but every Pangolin resource then lives under `*.sub.main.tld`, and the
  asker notes it still leaves unrelated services exposed to Pangolin's failure modes.
- **Option D — Pangolin without Gerbil** ([Without Tunneling](https://docs.pangolin.net/self-host/advanced/without-tunneling)).
  Removes the port-namespace coupling — but also removes tunnelling entirely: *"Pangolin and Traefik
  must now be on the same network as the resources you want to proxy to."* That deletes the single
  reason we chose Pangolin (reaching a CGNAT'd desktop). **Not applicable.**
- **Option E — a dedicated VPS.** No conflicts, no coupling, clean blast radius.

### 3.4 Verdict on co-tenancy

**Risky — avoid. Give Pangolin its own VPS.**

Not because it is badly behaved, but because **it is architecturally a whole-host edge**: it publishes
80/443, it runs its Traefik inside another container's network namespace, and that Traefik is driven by
a remote config provider it owns. Every documented way to share a host with an existing production
Traefik either couples unrelated apps' uptime to a WireGuard tunnel process (Option A — the community's
own red flag), or stacks an untested extra proxy layer on a path already known to be the throughput
bottleneck (Option B).

The economics also do not favour co-tenancy: the whole Pangolin stack is **~700 MB RAM and a fraction of
a core at idle**, so the dedicated box is a **~\$4–6/month** VPS. That is a very cheap price for not
putting a firm's existing production apps behind a single WireGuard process's liveness.

**If the owner nonetheless wants co-tenancy on `Powerbyte-Hostinger` or `LGUCalapan-Hostinger`, the only
defensible shape is Option B (HAProxy/nginx SNI passthrough on :443 → two isolated Traefiks), and it
must be built and load-tested on a throwaway VPS first — never introduced directly onto a host serving
production.** Given §2.4, expect to measure the throughput cost of the extra hop before trusting it.

---

## 4. VERDICT

**(a) Free for unlimited users?**
**Yes.** Self-hosted Community Edition is AGPL-3.0 with **no cap on users, sites, resources, orgs or
connections** — confirmed by the vendor's Self-Hosted feature matrix (Community shows `-` where paid
tiers show 25/50/100) and by the code, where limit enforcement is gated behind `build == "saas"` and the
OSS licence stub reports no quantities. The "5 users" figure everyone quotes is **Pangolin *Cloud*
Basic**, a different product. Commercial use by the firm is fine; referencing the CE image from our
compose bundle is fine. Two hard rules: **never touch the `ee-*` image** (the Fossorial Commercial
License forbids redistributing it or providing third-party access to those images), and use the Pangolin
name nominatively only. The real CE gap is not user count — it is that **all audit/access logging is
Enterprise-only**, which Orqafy must therefore own at the application layer.

**(b) Will a few users make a small VPS struggle?**
**No on RAM, no on CPU, but read the throughput caveat — because we are a file product.** 3–15 users on
one site is nothing for the control plane (~700 MB RAM, <10% of 2 vCPU under load), and the vendor's own
recommendation of **2 vCPU / 2 GB / 20 GB** is honest; an 8 GB box is wasted money. **But all user file
traffic relays through the VPS** — there is no browser peer-to-peer path, only client-app private
resources get that — so the VPS terminates TLS for and re-transmits every photo and drawing, and every
byte crosses its NIC twice against a typical **1–2 TB/month** allowance (we project 300–600 GB/month).
The genuine bottleneck is **per-connection tunnel throughput**: a known, maintainer-acknowledged
sequential-packet limitation that historically capped single streams at ~1–6 MB/s, materially improved
as of Newt 1.16.0 with `USE_NATIVE_MAIN_INTERFACE=true` (~180 Mbit/s single-stream, ~500 Mbit/s
parallel). **That flag plus host networking and a pinned Newt ≥ 1.16.0 are mandatory in our bundle, and
throughput must be measured before any customer install.**

**(c) Is it safe to put on a VPS already running production apps?**
**No — give it its own VPS.** Pangolin publishes host ports 80, 443 and UDP 51820, and runs its Traefik
*inside Gerbil's network namespace* under a remote config provider it controls — it is a whole-host
edge, not a tenant. The only vendor-shaped way to share a host puts your existing Traefik inside that
same namespace, which means **every unrelated production app on the box goes down when the WireGuard
tunnel process does** — the community's own stated red flag, on a thread that is still `Unanswered`. The
SNI-splitter alternative is untested and adds a hop to the exact path that is already the bottleneck.
At ~\$4–6/month for a dedicated box, co-tenancy is not worth the blast radius.

---

## Sources

Primary (fetched 2026-09-06):
[pangolin.net/pricing](https://pangolin.net/pricing) ·
[Fossorial Commercial License](https://pangolin.net/fcl) ·
[Fossorial Terms of Service](https://pangolin.net/tos) ·
[Enterprise Edition](https://docs.pangolin.net/self-host/enterprise-edition) ·
[Choosing a VPS](https://docs.pangolin.net/self-host/choosing-a-vps) ·
[DNS & Networking](https://docs.pangolin.net/self-host/dns-and-networking) ·
[Quick Install](https://docs.pangolin.net/self-host/quick-install) ·
[Manual Docker Compose](https://docs.pangolin.net/self-host/manual/docker-compose) ·
[System Architecture](https://docs.pangolin.net/development/system-architecture) ·
[How Pangolin Works](https://docs.pangolin.net/about/how-pangolin-works) ·
[Without Tunneling](https://docs.pangolin.net/self-host/advanced/without-tunneling) ·
[fosrl/pangolin LICENSE](https://github.com/fosrl/pangolin/blob/main/LICENSE) ·
[server/middlewares/verifyLimits.ts](https://github.com/fosrl/pangolin/blob/main/server/middlewares/verifyLimits.ts) ·
[server/license/license.ts](https://github.com/fosrl/pangolin/blob/main/server/license/license.ts) ·
repo licences via GitHub REST API for `fosrl/{pangolin,newt,gerbil,olm,badger}`.

Community (first-hand reports, weighted as such):
[Discussion #512 — Pangolin performance via Newt](https://github.com/orgs/fosrl/discussions/512) ·
[Discussion #457 — Setup Pangolin with existing traefik instance](https://github.com/orgs/fosrl/discussions/457) ·
[Issue #2120 — memory leak after 1.13.1](https://github.com/fosrl/pangolin/issues/2120).

**Unverified / could not confirm from a primary source:** the "~650 MB idle across three containers"
figure (aggregated tutorial content, no primary measurement located); whether Fossorial's ToS trademark
clause binds a self-host redistributor (no standalone trademark policy exists in the repo); whether the
throughput fix in `newt/proxy/manager.go` has landed as a code change versus being worked around by the
native-interface flag.
