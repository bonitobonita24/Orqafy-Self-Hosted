# R-1 · Remote Access / Overlay Network — decision doc

> **Status:** RESEARCH COMPLETE, recommendation pending owner sign-off.
> **Researched:** 2026-09-06. All GitHub facts pulled live from the GitHub REST API on that date.
> **Question (from `docs/SEED_BRIEF.md` §5):** how does a non-technical construction firm reach a
> desktop-as-server Orqafy install from outside the LAN, **on the server's own real domain**, behind
> Traefik — without a sysadmin?

---

## 0. The problem shape (read this first — it decides the answer)

Five constraints, in priority order:

| # | Constraint | Consequence |
|---|---|---|
| C1 | The install is a **desktop-as-server** on a firm's office/home broadband — likely **CGNAT** (typical PH ISP: PLDT/Globe/Converge residential). No inbound port forward can be assumed. | Anything requiring a routable inbound IP at the *server* is out unless a relay/tunnel sits in front. |
| C2 | Users log in at **the server's own real domain** with real TLS. | Rules out pure mesh-VPN answers where the URL is a `100.x.y.z` address or a `*.ts.net`-style magic-DNS name. A mesh VPN *can* serve a real domain, but only to devices already enrolled in the mesh. |
| C3 | Users are **site engineers, architects, and a firm owner with no sysadmin**. Some are contractors/clients who will never install a VPN client. | Client-software-per-device is a real adoption tax. Zero-client is a big win. |
| C4 | The **Expo mobile app carries background geofencing** — the product differentiator (SEED_BRIEF §4.1). | A device-wide VPN tunnel on the same phone is a live conflict area (§4 below). Avoiding a phone VPN entirely removes the risk class. |
| C5 | The product does **file management + photo capture** (module f, mobile photo-against-task). Traffic is large binary uploads/downloads, not just HTML. | Materially affects the Cloudflare Tunnel option (§6.2) and any relay you don't own. |

**The key structural distinction** between the candidates:

- **Mesh/overlay VPNs** (Headscale, NetBird, Netmaker, Nebula) put every *client device* on a private
  network. Good for admin access; poor for C2/C3 — every phone, laptop and client-visitor must enroll.
- **Reverse tunnels** (Pangolin, Cloudflare Tunnel) put a public entry point on a machine that *does*
  have a public IP, and the desktop dials **out** to it. The browser needs no client at all. Directly
  satisfies C1+C2+C3+C4.

Orqafy is a **web app accessed by many people including outsiders**, not an admin box for one engineer.
That pushes hard toward the reverse-tunnel family.

---

## 1. Candidate comparison — headline table

All stars/licence/release data fetched from `api.github.com` on **2026-09-06**.

| | **Pangolin** | **Headscale** | **NetBird** | **Netmaker** | **Nebula** |
|---|---|---|---|---|---|
| Shape | Tunneled reverse proxy (Traefik + WireGuard `newt` agent) | Self-hosted Tailscale control plane | Mesh VPN (WireGuard + ICE) | Mesh VPN (WireGuard) | Mesh VPN (Noise + certs) |
| Repo | [fosrl/pangolin](https://github.com/fosrl/pangolin) | [juanfont/headscale](https://github.com/juanfont/headscale) | [netbirdio/netbird](https://github.com/netbirdio/netbird) | [gravitl/netmaker](https://github.com/gravitl/netmaker) | [slackhq/nebula](https://github.com/slackhq/nebula) |
| Stars / forks | 22,635 / 777 | 43,587 / 2,558 | 28,939 / 1,656 | 11,773 / 650 | 18,297 / 1,181 |
| Contributors | 104 | 245 | 159 | 90 | 83 |
| Latest release | `1.22.2` — 2026-09-04 | `v0.29.3` — 2026-07-29 | `v0.78.1` — 2026-09-04 | `v1.7.0` — 2026-08-31 | `v1.11.1` — 2026-08-21 |
| Last push | 2026-09-04 | 2026-09-04 | 2026-09-05 | 2026-09-04 | 2026-09-04 |
| Licence (verified from repo) | **Dual: AGPL-3.0 (Community) + Fossorial Commercial (Enterprise/open-core)** | **BSD-3-Clause** | **BSD-3-Clause**, except `management/`, `signal/`, `relay/`, `combined/` which are **AGPL-3.0** | **Apache-2.0**, except `pro/` under a proprietary **Netmaker Enterprise License** | **MIT** |
| Control plane self-hostable? | ✅ fully (CE is complete) | ✅ fully (it *is* the control plane) | ✅ fully (mgmt + signal + relay + STUN, one compose) | ✅ CE fully; relay is Pro | ✅ N/A — no control plane, just a lighthouse |
| Needs a public-IP box you rent? | ✅ yes (small VPS) | ✅ yes (control + DERP) | ✅ yes (mgmt + STUN/relay) | ✅ yes (server + Pro relay for CGNAT) | ✅ yes (lighthouse) |
| Zero client software for end users? | ✅ **yes — browser only** | ❌ Tailscale client per device | ❌ NetBird client per device | ❌ netclient per device | ❌ Nebula client per device |
| Real domain + TLS at the edge? | ✅ built-in (Traefik + Let's Encrypt) | ⚠️ possible but you build it | ⚠️ possible but you build it | ⚠️ possible but you build it | ❌ you build everything |
| Phone needs a device-wide VPN? | ❌ **no** | ✅ yes | ✅ yes | ✅ yes | ✅ yes |

---

## 2. Per-candidate detail

### 2.1 Pangolin ([fosrl/pangolin](https://github.com/fosrl/pangolin))

**What it is.** A self-hosted control server that runs **Traefik** on a small public VPS and accepts
**WireGuard tunnels dialled outward** by the `newt` agent running next to your app. It then reverse-proxies
`app.yourdomain.com` → through the tunnel → to the desktop-as-server. Per the README, it lets you *"expose
HTTPS web applications … without installing a client"* and *"handles routing, load balancing, health checking,
and automatic SSL certificates without exposing your network directly to the internet"*
([README](https://github.com/fosrl/pangolin#readme)).

| Criterion | Assessment |
|---|---|
| **1. Self-hostable control plane** | ✅ Fully. Community Edition is the complete self-host product; no vendor SaaS dependency. Pangolin Cloud is optional and separate. |
| **2. Licence** | **Dual-licensed AGPL-3.0 / Fossorial Commercial**. README: *"Self-Host: Community Edition — Free, open-source, and licensed under AGPL-3."* Enterprise Edition is open-core under the Fossorial Commercial Licence, *"free for personal and hobbyist use, and for businesses making less than $100K USD gross annual revenue."* [`newt`](https://github.com/fosrl/newt) (the agent) is plain **AGPL-3.0**. <br>**AGPL-3.0 compatibility:** we run Pangolin as a *separate service alongside* Orqafy — separate containers, separate processes, network-boundary communication. That is **aggregation, not a derivative work**, so its AGPL does not reach into our code. Our product is *also* AGPL-3.0 (D-2), so even a tighter reading is harmless. **We must not vendor or fork Pangolin/newt source into this repo**; we reference the upstream images in Compose and document the dependency. **Commercial use by the firm:** running an unmodified CE internally triggers no AGPL obligation at all (no modification, no conveying). ✅ |
| **3. NAT traversal** | Not really a NAT-traversal problem: `newt` dials **outbound** WireGuard to the VPS. Works behind CGNAT, symmetric NAT, and hostile hotel/site Wi-Fi with no inbound ports at the desktop. Relaying is inherently **our own infra** (the VPS), so no third-party ToS or capacity risk. Also supports P2P/site networking with NAT traversal for the client-VPN feature, but we do not need it. |
| **4. Mobile clients** | **None needed for the core answer** — engineers open a browser or the Expo app hits `https://app.firm.com` over plain HTTPS. This is the decisive property: **no VPN on the phone ⇒ zero interaction with background geofencing** (see §4). Pangolin does ship an optional client for private-network resources; we would not use it on field phones. |
| **5. Non-technical setup** | Best of the field. Prereqs per [docs](https://docs.digpangolin.com/self-host/quick-install): a Linux server with root + public IP, a domain pointing at it, an email for Let's Encrypt, and open ports 80/443 TCP + 51820/21820 UDP. Install is `curl -fsSL https://static.pangolin.net/get-installer.sh \| bash` then an interactive installer, and afterwards **everything is a web dashboard** — the firm owner adds a resource in a UI, not a config file. The desktop side is one `newt` container in our Compose bundle with a token we can pre-seed. |
| **6. Traefik + real domain + TLS** | **Native.** Pangolin *is* a Traefik control plane; Let's Encrypt certs are automated, wildcard-capable, and terminated at the VPS. This is the single best fit with the brief's Traefik requirement — arguably it *is* our Traefik. |
| **7. Project health** | Very active: 1.22.2 released 2026-09-04, pushed same day, 104 contributors, 22.6k stars in under 2 years (created 2024-09-27). Fossorial is a **Y Combinator 2025 company** ([reported](https://noted.lol/pangolin/) — company/YC status **unverified from a primary source**), i.e. VC-funded with an open-core model. <br>**Rug-pull risk: MEDIUM.** Open-core + VC funding is exactly the shape that historically relicenses (cf. Netmaker's `pro/`). Mitigation: the AGPL-3.0 CE grant on shipped versions is **irrevocable**, and Pangolin is a *swappable edge component* — if CE is gutted we replace it with a plain VPS + Traefik + a WireGuard/`frp`/`rathole` tunnel in about a day, with **no change to Orqafy's own code**. That swappability is why the medium risk is acceptable. |

**Weaknesses to be honest about.** (a) You must rent and keep alive a small VPS (~$4–6/mo) — a recurring
cost and a second machine the firm technically owns. (b) All traffic, including large file/photo uploads,
transits that VPS, so its bandwidth and location matter (put it in Singapore for PH latency). (c) The
Enterprise/CE split is a moving line; check which features you rely on are CE before committing.

---

### 2.2 Headscale ([juanfont/headscale](https://github.com/juanfont/headscale))

| Criterion | Assessment |
|---|---|
| **1. Control plane** | ✅ Fully self-hostable — it is an open-source reimplementation of the Tailscale coordination server, driven by the **official Tailscale clients**. |
| **2. Licence** | **BSD-3-Clause** (verified from `LICENSE`). Maximally permissive; zero friction with AGPL-3.0 or commercial use. ✅ Best licence of the field. ⚠️ Note the *clients* are Tailscale's: the CLI/daemon is open source but the **Windows and macOS/iOS GUI clients are proprietary** — the README states *"Everything in Tailscale is Open Source, except the GUI clients for proprietary OS (Windows and macOS/iOS), and the control server."* So a "fully FOSS" claim does not survive contact with the iPhone. |
| **3. NAT traversal** | Strong — Tailscale's is the best in class. Headscale ships an **embedded DERP relay + STUN** (disabled by default, enabled in config; needs udp/3478 + tcp/443) — see [headscale.net/stable/ref/derp](https://headscale.net/stable/ref/derp/). Docs note symmetric/CGNAT peers *always* fall back to a relay. By default Headscale can point at Tailscale's public DERP fleet; **for a self-contained product we would run our own DERP** — i.e. our own infra, same VPS cost as Pangolin. Embedded DERP is documented as suitable for small tailnets (~<50 nodes), which fits a construction firm. |
| **4. Mobile clients** | Tailscale iOS + Android are **store-published and excellent** — the best mobile story of the mesh options. But they are **device-wide VPNs** with the geofence-coexistence concerns in §4, and Headscale support on the iOS client requires the "use custom coordination server" path, which is an awkward, semi-hidden flow for a non-technical user. |
| **5. Non-technical setup** | ❌ Poor for our audience. Every device must install Tailscale, point it at a custom server, and complete an auth-key flow. Client engineers and outside architects will not do this. |
| **6. Traefik + domain + TLS** | Possible: run Traefik on the desktop, bind it to the tailnet interface, use a real domain resolving to the tailnet IP, and get certs via **DNS-01**. Works, but it is bespoke plumbing *we* would have to build and document, and the domain resolves to nothing for anyone not on the tailnet. |
| **7. Health** | Excellent. 43.6k stars, 245 contributors, `v0.29.3` (2026-07-29), pushed 2026-09-04. No company owns it; one active maintainer is a Tailscale employee permitted to work on it (per README). **Rug-pull risk: LOW** — BSD-3 and community-owned. The real risk is *upstream protocol drift*: Headscale chases a proprietary control protocol it does not control, and the README warns to pin the same tag as the release you use. |

**Verdict:** the right tool for *our* administrative access to a customer's box, and a credible answer for a
firm whose staff are all employees with managed phones. Wrong tool as the primary user-facing front door.

---

### 2.3 NetBird ([netbirdio/netbird](https://github.com/netbirdio/netbird))

| Criterion | Assessment |
|---|---|
| **1. Control plane** | ✅ Fully self-hostable: management, signal, relay and STUN, all in one generated Compose stack via `curl -fsSL .../getting-started.sh \| bash` ([docs](https://docs.netbird.io/selfhosted/selfhosted-quickstart)). Genuinely the slickest self-host installer of the mesh group. |
| **2. Licence** | **Split** (verified from `LICENSE`): BSD-3-Clause for the repo *except* `management/`, `signal/`, `relay/` and `combined/`, which are **AGPL-3.0**. Mobile clients are **GPL-3.0** ([android-client](https://github.com/netbirdio/android-client), [ios-client](https://github.com/netbirdio/ios-client)). GitHub reports the repo licence as `NOASSERTION` because of the split. <br>Same aggregation reasoning as Pangolin: run it as a separate service, don't vendor the source, and there is no conflict with our AGPL-3.0 product or with the firm's internal commercial use. NetBird also gates some features behind a paid tier — **which features are CE vs paid was not verified** in this pass. |
| **3. NAT traversal** | Best-in-class among the pure mesh options: WireGuard + **Pion ICE** (full ICE, not just hole-punch) + STUN + its own relay. Self-hosting requires the VM to be publicly reachable on **TCP 80/443 and UDP 3478**. Relaying is on our own infra. Handles CGNAT well. |
| **4. Mobile clients** | iOS `v0.3.3` (2026-07-23) and Android `v0.5.0` (2026-05-15). Both are real but **noticeably younger and thinner than Tailscale's** — 80 and 213 stars, 44 and 63 open issues respectively. Store availability **unverified**. Same device-wide-VPN geofence concern as Headscale, on a less battle-tested tunnel implementation. That combination is the wrong place to be betting the product differentiator. |
| **5. Non-technical setup** | Server side: genuinely 5 minutes. Client side: same per-device enrollment tax as Headscale, minus the polish. |
| **6. Traefik + domain + TLS** | NetBird's own dashboard wants a public domain + certs; serving *Orqafy* on a real domain over the mesh is the same bespoke build as Headscale. |
| **7. Health** | Very active — 28.9k stars, 159 contributors, `v0.78.1` released 2026-09-04, pushed 2026-09-05. Backed by **NetBird GmbH** (VC-funded, per the copyright header). Note **1,582 open issues**, by far the highest of the field — that is partly scale, but worth a second look. **Rug-pull risk: MEDIUM** — commercial-open-source with an already-split licence, i.e. the mechanism for tightening is pre-installed. |

---

### 2.4 Netmaker ([gravitl/netmaker](https://github.com/gravitl/netmaker))

| Criterion | Assessment |
|---|---|
| **1. Control plane** | ✅ CE self-hostable, but the **relay** — the exact feature CGNAT needs — is Pro. |
| **2. Licence** | **Apache-2.0 for the core**, with everything under `pro/` governed by the **Netmaker Enterprise License** (verified from `LICENSE.md` and `pro/PRO_LICENSE`). The Pro licence is aggressive: production use requires a paid subscription, *"it is forbidden to copy, merge, publish, distribute, sublicense, and/or sell"*, and **it claims ownership of your modifications and patches**. Apache-2.0 core is AGPL-compatible; `pro/` is not something we would touch. <br>⚠️ Widely-repeated claims that Netmaker CE is **SSPL** (e.g. [lilting.ch](https://lilting.ch/en/articles/tailscale-alternatives-wireguard-split-access)) are **out of date** — the current `master` LICENSE.md is Apache-2.0. Netmaker did relicense at some point; **the exact history is unverified.** That it moved licences *at all* is itself the signal. |
| **3. NAT traversal** | Weakest of the field for our case. Kernel WireGuard + STUN hole-punching since v0.18.0; when that fails (symmetric NAT, CGNAT, restrictive site firewalls), the documented fallback is a **Relay Server, which is a Pro feature** ([docs](https://docs.netmaker.io/docs/features/relay-servers-pro)). Our exact scenario — C1, a desktop behind PH residential CGNAT — is the scenario that pushes you into the paid tier. |
| **4. Mobile clients** | Weakest mobile story. **Not verified** in this pass; historically Netmaker's mobile support has lagged and been an explicit gap. Do not plan on it. |
| **5. Non-technical setup** | ❌ Poorest. Multiple published comparisons call out a steeper learning curve than NetBird or Headscale, and it is aimed at network engineers doing site-to-site segmentation. |
| **6. Traefik + domain + TLS** | Same bespoke build as the other mesh options. |
| **7. Health** | Active — 11.8k stars, 90 contributors, `v1.7.0` (2026-08-31). Netmaker, Inc. **Rug-pull risk: HIGH-ish** — it has *already* moved the line once and puts the feature we'd need behind a paid wall with an ownership-grabbing licence. |

**Verdict: rule out.** It fails on the two things that matter most (CGNAT relay is paid; non-technical setup
is worst-in-class), and it has the worst licence posture.

---

### 2.5 Nebula ([slackhq/nebula](https://github.com/slackhq/nebula))

| Criterion | Assessment |
|---|---|
| **1. Control plane** | **There is no control plane** — that is the design. Nebula is a certificate-authority model: you generate a CA, sign a cert per host, distribute config files. Fully self-contained, nothing to run except a **lighthouse**. |
| **2. Licence** | **MIT** (verified). Cleanest licence in the field. ✅ |
| **3. NAT traversal** | UDP hole-punching coordinated by the lighthouse, plus relay hosts (since v1.6). The **lighthouse must have a routable public IP** — the [quick start](https://nebula.defined.net/docs/guides/quick-start/) is explicit about substituting "the routable IP of your own lighthouse". So: same VPS requirement, less automation. Proven at Slack scale for server-to-server. |
| **4. Mobile clients** | [DefinedNet/mobile_nebula](https://github.com/DefinedNet/mobile_nebula) — iOS + Android, `v0.10.0` (2026-04-10), **173 stars, 59 open issues, no declared licence on the repo**. This is a thin, low-traffic client relative to Tailscale's. Store availability and Expo coexistence **unverified**. Not a base to bet field-phone reliability on. |
| **5. Non-technical setup** | ❌ **Worst of all five for our audience.** There is no dashboard, no signup flow, no "click to add a device". Every host means hand-signing a certificate and editing YAML. This is a tool for infrastructure teams. A construction firm owner cannot operate it, and *we* would have to build an entire enrollment UX on top — a project in itself. |
| **6. Traefik + domain + TLS** | Everything is manual. DNS-01 certs against a private overlay IP, hand-rolled. |
| **7. Health** | Healthy and stable: 18.3k stars, 83 contributors, `v1.11.1` (2026-08-21), pushed 2026-09-04. Originated at Slack, now stewarded alongside **Defined Networking** (the commercial managed-Nebula company). **Rug-pull risk: LOW** — MIT, and the open core has stayed open for 6+ years. The commercial layer (Defined Networking) is the *managed control plane*, sold on top rather than carved out. |

**Verdict:** the best licence and a rock-solid protocol, wrapped in the worst operator experience for a
non-technical firm. Rule out on C3.

---

## 3. Serious contenders beyond the brief's five

| Option | Shape | Why it's here | Verdict |
|---|---|---|---|
| **Cloudflare Tunnel (`cloudflared`)** | Free reverse tunnel to Cloudflare's edge | Zero-client, real domain, free, CGNAT-proof, trivially easy | **Strong on paper, blocked by ToS for a file-heavy app — see §6.2.** Keep as an explicit fallback only if file traffic is routed elsewhere. |
| **`frp` / `rathole` on a VPS** | Plain reverse TCP tunnel, [fatedier/frp](https://github.com/fatedier/frp) (Apache-2.0), rathole (Apache-2.0) | The un-opinionated version of Pangolin. Tiny, boring, permissive licence, no company. | **Good escape hatch.** No dashboard, no auth layer, no cert automation — you pair it with your own Traefik. This is the "Pangolin rug-pull" contingency: same architecture, ~1 day of work, no vendor. |
| **`wg-easy` / plain WireGuard on a VPS + reverse proxy** | DIY | Same as above with a UI for the tunnel | Viable, more moving parts than `frp`. |
| **Tailscale Funnel (SaaS)** | Tailscale's own public-ingress feature | Exposes a tailnet service publicly on `*.ts.net` | **Rule out:** SaaS dependency, and it will not serve the firm's own domain. Also *not* available on Headscale (**Funnel support in Headscale is unverified but believed absent**). |
| **ZeroTier** | Mesh overlay | The other classic Tailscale alternative | Not evaluated in depth. Licence is **BUSL-1.1** (source-available, not OSI-open) — poor fit with an AGPL FOSS product's ethos. **Licence version unverified as of 2026.** |

---

## 4. ⚠️ The VPN × background-geofencing question (C4) — the honest read

This is the criterion the brief specifically flagged, so here is what is actually established versus what
is guesswork.

**What is verified:**

- **Only one enterprise VPN tunnel can be active on iOS at a time.** `NETunnelProviderManager` configurations
  are enterprise VPNs and only one may be enabled system-wide; a Personal VPN (`NEVPNManager`) can coexist
  but the enterprise VPN takes precedence ([Apple `NEVPNManager` docs](https://developer.apple.com/documentation/networkextension/nevpnmanager),
  [discussion](https://developer.apple.com/forums/thread/748725)). **Consequence:** if the firm's engineers
  already run a corporate or personal VPN, ours displaces it, or theirs displaces ours and Orqafy silently
  loses connectivity. Same single-slot constraint applies to Android's `VpnService`.
- **`NEPacketTunnelProvider` has documented battery/wake pathology.** Reports of `sleep`/`wake` being called
  ~every 6 seconds on iOS 17 versus ~42 seconds on iOS 16 ([Apple forum thread 737280](https://developer.apple.com/forums/thread/737280)),
  and of high "Overhead"/"Network" energy impact in the *host app* while the tunnel runs
  ([thread 682844](https://developer.apple.com/forums/thread/682844)).
- **Geofencing is already fragile on its own.** iOS caps region monitoring at **20 geofences per app**
  ([Radar](https://radar.com/blog/limitations-of-ios-geofencing)); Android's Doze mode disables GPS entirely
  and geofence intents are routinely delayed by hours or dropped by OEM battery managers
  ([android/location-samples #203](https://github.com/android/location-samples/issues/203),
  [#219](https://github.com/android/location-samples/issues/219), [dontkillmyapp.com](https://dontkillmyapp.com)).
- **Expo's own docs** confirm the background-location contract: background location stops if the user
  terminates the app; on **iOS the system restarts a terminated app on a geofence event**, but on **Android it
  does not** ([expo-location](https://docs.expo.dev/versions/latest/sdk/location/)).

**What is NOT verified (and I will not invent it):** I found **no authoritative source stating that an active
VPN tunnel blocks or degrades geofence *triggering*.** Mechanically it should not — Core Location / Android's
Geofencing API operate below the network stack and fire regardless of routing.

**So the real risk is not the trigger, it's the delivery.** The failure mode is:

> geofence fires → OS wakes the app for a few seconds → the app must POST to the server → **but the server is
> only reachable through a VPN tunnel that may be asleep, re-handshaking, or displaced by another VPN** →
> the wake budget expires → the "you have something to do here" notification never sends.

Add the battery pathology above, on phones that are already in Doze all day on a construction site, and you
are stacking two fragile subsystems on top of each other to solve a problem that a public HTTPS endpoint
solves for free.

**Conclusion: do not put a VPN on the field phones.** This is not a "probably fine, we'll test it" —
it is an avoidable dependency between the product's differentiator and its network layer. Pangolin (or any
reverse tunnel) removes the entire risk class because the Expo app makes an ordinary HTTPS call to a public
domain. **This single point is the strongest argument in this document.**

---

## 5. Non-technical setup burden — realistic step counts

What the firm owner actually does, end to end:

| Option | Server-side steps | Per-user steps | Realistic verdict |
|---|---|---|---|
| **Pangolin** | Rent VPS · point domain A-record at it · run one installer script · add a resource in the web UI. Our Compose bundle ships `newt` with a pre-seeded token. | **Zero.** Open `https://app.firm.com`, log in. | ✅ We can do the server part once during onboarding; the firm never touches it again. |
| **Cloudflare Tunnel** | Move DNS to Cloudflare · `cloudflared` container · one dashboard route. | **Zero.** | ✅ Easiest of all — but see §6.2. |
| **Headscale** | VPS · install · enable DERP · configure DNS/certs ourselves. | Install Tailscale · set custom control server (buried setting on iOS) · redeem auth key · keep VPN on. | ❌ ~5 steps × every device, forever, including new hires and outside architects. |
| **NetBird** | VPS · one script. | Install client · SSO login · keep VPN on. | ❌ Better than Headscale, still a per-device tax. |
| **Netmaker** | VPS · install · configure networks · (pay for relay). | Install netclient · join network. | ❌ |
| **Nebula** | VPS lighthouse · generate CA · hand-sign a cert per device · distribute YAML. | Receive+install a cert and config file. | ❌❌ Not operable by a non-technical firm. |
| **Port-forward + Traefik + LE** | Router port-forward 80/443 · DDNS or static IP · Traefik does certs. | **Zero.** | ✅ *If and only if* the ISP gives a routable IP (see §6.1). |

---

## 6. The honest alternative: no overlay at all

### 6.1 Plain Traefik + Let's Encrypt + port-forward

**This is the correct answer whenever the firm has a routable public IP** — a business fibre line, a static
IP add-on, or any ISP not doing CGNAT. It is simpler, faster (no relay hop), free of recurring VPS cost, and
has zero third-party dependency. Traefik with an HTTP-01 challenge on ports 80/443 forwarded from the router
is a solved, boring problem, and it is what the app is architected for anyway.

**When it is the better answer:**
- The office has a static or at least routable dynamic IP (pair with DDNS).
- The owner can access the router, or an ISP tech will do it once.
- A single-site deployment where the desktop-as-server lives in the office with the fibre line.

**When it fails:**
- **CGNAT** — no inbound connection is possible, full stop. This is the common case for PH residential/SME
  broadband and is why R-1 exists.
- ISP blocks inbound 80/443 (also common).
- The dynamic IP changes and DDNS lags, breaking cert renewal and logins at random.
- Security posture: it publishes the desktop's router directly to the internet, whereas a tunnel exposes
  only the VPS.

**Design consequence:** the storage/ingress layer must treat this as a **swappable front door**, exactly
like the NAS abstraction in R-2. The app itself must not know or care whether the request arrived via
port-forward or a tunnel — it sees Traefik and a `Host` header, nothing more. Build for that and this whole
decision stays reversible per-customer.

### 6.2 Cloudflare Tunnel — ⚠️ the ToS trap

Technically Cloudflare Tunnel is *excellent* for this: free, zero-client, CGNAT-proof, real domain, automatic
TLS, one container. It would be the recommendation on merit alone.

**But:** Cloudflare's late-2025 ToS update removed the old blanket HTML/non-HTML rule and moved a
content restriction into the **CDN-specific Service-Specific Terms** — video and large files hosted
*outside* Cloudflare (i.e. not on Stream / Images / R2) remain restricted
([Cloudflare, "Updated ToS"](https://blog.cloudflare.com/updated-tos)). Community reading is that
self-hosted media/large-file serving through Tunnel is still not permitted
([LowEndTalk discussion](https://lowendtalk.com/discussion/186268/no-more-non-html-terms-on-cloudflare)).

Orqafy Self-Hosted is, by design, a **file-management and site-photo product** (SEED_BRIEF §3f, mobile photo
capture). Its steady-state traffic is exactly the category at issue. Recommending an architecture whose
terms of service our own core feature arguably violates — to a customer who cannot read those terms — is not
acceptable, especially when the whole point of the project is self-hosted independence.

> **Flagged as interpretation, not verified fact:** whether a construction firm's project photos constitute
> "large files" under the CDN terms is a judgment call, and I found **no Cloudflare statement specifically
> addressing document/photo workloads**. The risk is real but not quantified. It could be mitigated by
> putting the app UI behind Tunnel and file traffic on a direct/other path — which reintroduces most of the
> complexity Tunnel was meant to remove.

**Verdict:** viable fallback for a *light* deployment (no heavy file sync), documented with the caveat.
Not the default.

---

## 7. RECOMMENDATION

### ✅ Primary: **Pangolin** (Community Edition, AGPL-3.0) on a small VPS + `newt` in the Compose bundle

**Decisive reasons, in order:**

1. **It removes the VPN from the phone.** The Expo app calls a public HTTPS domain. Background geofencing —
   the product's entire differentiator — never has to survive a sleeping WireGuard tunnel, a Doze-throttled
   `NEPacketTunnelProvider`, or a single-VPN-slot collision with a user's other VPN (§4). Every mesh option
   couples the differentiator to the network layer; this one decouples them.
2. **Zero client software for end users** (C3). Site engineers, the owner, outside architects and clients all
   just open a URL. No mesh option can say this.
3. **It is literally Traefik + Let's Encrypt + a real domain** (C2, C6) — the brief's requirement is the
   product's core feature, not something we bolt on.
4. **CGNAT is a non-issue** (C1): the desktop dials outbound; nothing inbound is ever required.
5. **Licence is clean for us**: AGPL-3.0 CE run as a separate service alongside our AGPL-3.0 product =
   aggregation, no code contamination, no obligation on the firm for unmodified internal use.
6. **Swappable in a day.** The architecture (public entry point + outbound tunnel + Traefik) survives even if
   Pangolin itself does not — `frp`/`rathole` + our own Traefik is the same shape with a permissive licence.

### ✅ Fallback: **Plain Traefik + Let's Encrypt + port-forward** (§6.1)

Use it **first**, not last, whenever the site has a routable IP: simpler, free, faster, no third party. Ship
both paths in the Compose bundle and choose per-customer at install time. Cloudflare Tunnel is a *distant
third* — only for light, non-file-heavy installs, and only with the ToS caveat written down for the customer.

### 🔧 Complementary, not competing: **Headscale** for *our* admin access

BSD-3, best NAT traversal, best mobile clients, community-owned, lowest rug-pull risk. Wrong as the user
front door, but a good way for Powerbyte support engineers to reach a customer's desktop-as-server for
maintenance without exposing SSH. **Optional, and a later track — not v1.**

### ❌ Ruled out

**Netmaker** (CGNAT relay is a paid feature, worst setup burden, licence already moved once and its Pro terms
claim your modifications) · **Nebula** (excellent MIT protocol, but hand-signed certs and YAML per device is
unusable by a non-technical firm) · **ZeroTier** (BUSL-1.1, not OSI-open) · **Tailscale Funnel** (SaaS, wrong
domain). **NetBird** is a credible *second* mesh choice behind Headscale if the mesh model is ever chosen —
better installer, worse licence split and less mature mobile clients.

### What would change the call

| If… | Then… |
|---|---|
| The target firm has a **static/routable public IP** | Drop the tunnel entirely — go straight to §6.1. Simpler and free. |
| Pangolin CE is **gutted or relicensed** | Swap to `frp`/`rathole` + our own Traefik on the same VPS. No Orqafy code changes. |
| The owner **refuses a recurring VPS cost** | Cloudflare Tunnel with the §6.2 ToS caveat documented, *and* file sync kept off the tunnel — or accept LAN-only + port-forward-where-possible for v1. |
| Every user is an **employee on a managed phone**, and geofencing is dropped or moved server-side | Headscale becomes viable (best licence, best clients). Still worse for outside collaborators. |
| Field testing shows **geofence delivery works fine over an idle WireGuard tunnel** | The §4 argument weakens and mesh options re-enter. **This is testable and worth 2 hours of real-device testing before the decision is locked.** |
| We ever need **site-to-site** (office NAS ↔ server ↔ second office) | Re-open NetBird — it is the strongest true mesh in this survey. |

### Open items to verify before Phase 0

- [ ] Fossorial's YC-2025 status and funding — **unverified**, cited from a secondary blog.
- [ ] Exact Pangolin **CE vs Enterprise feature line** as of 1.22.x — verify nothing we depend on is EE.
- [ ] NetBird's **CE vs paid feature line** — not checked this pass.
- [ ] **Netmaker's licence history** (SSPL → Apache-2.0) — current state verified, the transition is not.
- [ ] Nebula/NetBird **mobile client app-store availability** — unverified.
- [ ] Whether **Headscale supports Tailscale Funnel** — believed no, unverified.
- [ ] **Real-device test:** geofence-triggered notification delivery with an active WireGuard tunnel on iOS + Android (the one experiment that could change the recommendation).

---

### Sources

[fosrl/pangolin](https://github.com/fosrl/pangolin) · [Pangolin quick install](https://docs.digpangolin.com/self-host/quick-install) · [fosrl/newt](https://github.com/fosrl/newt) · [juanfont/headscale](https://github.com/juanfont/headscale) · [Headscale DERP reference](https://headscale.net/stable/ref/derp/) · [netbirdio/netbird](https://github.com/netbirdio/netbird) · [NetBird self-hosting quickstart](https://docs.netbird.io/selfhosted/selfhosted-quickstart) · [gravitl/netmaker](https://github.com/gravitl/netmaker) · [Netmaker Relay Servers (Pro)](https://docs.netmaker.io/docs/features/relay-servers-pro) · [slackhq/nebula](https://github.com/slackhq/nebula) · [Nebula quick start](https://nebula.defined.net/docs/guides/quick-start/) · [DefinedNet/mobile_nebula](https://github.com/DefinedNet/mobile_nebula) · [Cloudflare updated ToS](https://blog.cloudflare.com/updated-tos) · [LowEndTalk ToS discussion](https://lowendtalk.com/discussion/186268/no-more-non-html-terms-on-cloudflare) · [Apple NEVPNManager](https://developer.apple.com/documentation/networkextension/nevpnmanager) · [Apple forum 748725 — multiple enterprise VPNs](https://developer.apple.com/forums/thread/748725) · [Apple forum 737280 — tunnel wake frequency](https://developer.apple.com/forums/thread/737280) · [Apple forum 682844 — tunnel energy impact](https://developer.apple.com/forums/thread/682844) · [Radar — iOS geofencing limitations](https://radar.com/blog/limitations-of-ios-geofencing) · [android/location-samples #203](https://github.com/android/location-samples/issues/203) · [android/location-samples #219](https://github.com/android/location-samples/issues/219) · [Expo Location docs](https://docs.expo.dev/versions/latest/sdk/location/) · [dontkillmyapp.com](https://dontkillmyapp.com) · [lilting.ch — Tailscale alternatives](https://lilting.ch/en/articles/tailscale-alternatives-wireguard-split-access) · [noted.lol — Pangolin](https://noted.lol/pangolin/)
