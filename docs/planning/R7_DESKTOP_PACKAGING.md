# R7 — Desktop Packaging, Signing, Auto-Update & the Rust Sidecar Surface

> Research note for the Tauri v2 desktop shell (decision **D-11**). Scope: per-platform code signing,
> the auto-update path for an AGPL **self-hosted** app served from our OWN domain, and the Rust
> sidecar-supervision surface — the **sole non-TypeScript code in the product** (D-11).
>
> **Sourcing rule:** every mechanical claim below is grounded in Tauri v2 docs fetched via **context7**,
> library id **`/tauri-apps/tauri-docs`** (`v2` branch), with the specific doc file cited inline. Anything
> the fetched docs did not confirm is marked **[UNVERIFIED]** in §5. Fetched 2026-09-08.

---

## 0. Context (D-11 recap)

Tauri chosen over Electron: ~17 MB installer vs ~112 MB, lower RAM per client. The trade is ~50–300 lines
of Rust **confined to sidecar supervision**; all UI and app logic stay TypeScript. This note documents the
three packaging surfaces D-11 implies: signing, updating, and that Rust surface.

Self-hosted framing (D-2 AGPL, D-3 Compose-first, D-15 LAN-first): **there is no app store.** Installers
and update artifacts are served from our own domain / release host. That shapes the updater design (§3) —
we run the static-JSON update path, not a store's update channel.

---

## 1. Code signing — per-platform matrix

Signing is a **distribution** concern, independent of the updater's own minisign signature (§3) — do not
conflate the two. A build can run unsigned locally (`--no-sign`) and only gets platform-signed for release.
*Source: `crates/tauri-bundler/src/bundle/macos/app.rs` — `settings.no_sign()` skips signing.*

| Platform | Mechanism | Tauri config / trigger | Distribution extra |
|---|---|---|---|
| **macOS** | Apple **codesign** with a **Developer ID Application** cert + hardened runtime, signed inside-out | `bundle.macos.signingIdentity` (or `APPLE_SIGNING_IDENTITY` env); cert imported to keychain in CI | **Notarization required** for distribution, via Apple's notary service; stapling on by default |
| **Windows** | **Authenticode** — SignTool (thumbprint) OR a custom `signCommand` (Azure Trusted Signing / relic / EV token) | `bundle.windows.certificateThumbprint` + `digestAlgorithm` + `timestampUrl`, **or** `bundle.windows.signCommand` | Timestamping (so signatures outlive cert expiry); EV/OV cert to avoid SmartScreen friction |
| **Linux (AppImage)** | Optional **GPG** embedded signature | `SIGN=1` env (+ `SIGN_KEY`, `APPIMAGETOOL_SIGN_PASSPHRASE`) at build | Effectively a **no-op for trust** — no OS gatekeeper enforces it; informational only |

### 1.1 macOS — Developer ID + notarization + stapling
- **Signing identity:** find it with `security find-identity -v -p codesigning`; the keychain entry name is
  the identity. In CI, import the `.p12` into a build keychain, then pass `APPLE_SIGNING_IDENTITY`.
  *Source: `distribute/Sign/macos.mdx`.*
- **Bundler behaviour:** when a signing identity resolves, Tauri applies the **hardened runtime**, strips
  extended attributes (they can fail codesign), and signs **inside-out** (frameworks + sidecar binaries
  first, then the `.app`) — per Apple's requirement. *Source: `crates/tauri-bundler/src/bundle/macos/app.rs`.*
- **Notarization:** "notarization is required for distribution" and is required specifically when using a
  **Developer ID Application** certificate. Tauri notarizes automatically when notarization credentials are
  present; **stapling is applied unless `bundle.macos.skipStapling` is set** (`notarize` vs
  `notarize_without_stapling` in the bundler). Modern Tauri drives Apple's **notarytool** path.
  *Source: `app.rs`, `distribute/Sign/macos.mdx`.*
- **Notarization credentials (env):** `APPLE_ID` + `APPLE_PASSWORD` (an app-specific password) + `APPLE_TEAM_ID`;
  **alternatively** `APPLE_API_KEY` + `APPLE_API_ISSUER` (App Store Connect API key). If `APPLE_ID` is set, the
  password and team id must also be set. *Source: `reference/environment-variables.mdx`, `distribute/Sign/macos.mdx`.*
- **Free Apple account caveat:** a free developer account **cannot notarize** — the app still shows as
  unverified on open. A paid Apple Developer Program membership is required. *Source: `distribute/Sign/macos.mdx`.*

### 1.2 Windows — Authenticode (+ Azure Trusted Signing / EV options)
- **Default (SignTool by thumbprint):** set `bundle.windows.certificateThumbprint`, `digestAlgorithm`
  (`sha256`), and `timestampUrl` (e.g. `http://timestamp.comodoca.com`). A **dedicated code-signing
  certificate** is required — SSL certs are not valid for signing. *Source: `distribute/Sign/windows.mdx`.*
- **Custom sign command** via `bundle.windows.signCommand` (the `%1` placeholder is the file to sign),
  which lets us swap in cloud/HSM signers instead of a local cert:
  - **Azure Trusted Signing** (formerly Azure Code Signing / Azure Artifact Signing): e.g.
    `"signCommand": "artifact-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d MyApp %1"`.
  - **relic + Azure Key Vault:** `"signCommand": "relic sign --file %1 --key azure --config relic.conf"`
    with a `relic.conf` in `src-tauri/` pointing at the Key Vault certificate.
  *Source: `distribute/Sign/windows.mdx`.*
- **EV vs OV:** the docs distinguish **OV** (organization-validated) certificates and note EV as the
  higher-assurance option; both are valid Authenticode certs. EV/OV choice is a SmartScreen-reputation and
  key-storage (HSM/token) decision, not a Tauri-config decision. *Source: `distribute/Sign/windows.mdx` (OV Certificates section).*
  - **[Partly unverified]** the exact SmartScreen reputation-reset behaviour per cert type is not stated in
    the fetched docs — see §5.

### 1.3 Linux — AppImage signature (effectively a no-op for trust)
- Sign with **gpg / gpg2**; generate a key via `gpg2 --full-gen-key`. *Source: `distribute/Sign/linux.mdx`.*
- Embed at build via env: `SIGN=1` (enable), `SIGN_KEY` (specific GPG key id), `APPIMAGETOOL_SIGN_PASSPHRASE`
  (**must** be set in CI, else gpg prompts interactively), `APPIMAGETOOL_FORCE_SIGN=1` (fail the build on
  signing error instead of shipping unsigned). *Source: `distribute/Sign/linux.mdx`.*
- Inspect with `./App_x.y.z_amd64.AppImage --appimage-signature`; validate with AppImageCommunity's
  `validate-*` tool. *Source: `distribute/Sign/linux.mdx`.*
- **Practical note:** no Linux desktop gatekeeper enforces this signature; it is an integrity/provenance
  signal only. For our AGPL self-hosted distribution the **updater's minisign signature (§3) is the
  load-bearing integrity check**, not the AppImage GPG signature. *(Interpretation — see §5.)*

---

## 2. Signing vs updating — two independent signatures

Two separate cryptographic mechanisms, easy to confuse:
1. **Platform code signing (§1)** — Apple codesign / Windows Authenticode / Linux GPG. Establishes OS-level
   trust and identity of the installer.
2. **Updater signature (§3)** — Tauri's own **minisign** keypair. Establishes that an update artifact the
   client downloaded came from us, and is verified by the updater plugin **before install**.

Both can (and for release, should) be applied. They use different keys and different tooling.

---

## 3. Auto-update — Tauri v2 updater plugin, self-hosted

### 3.1 Model
The updater plugin runs in one of two modes: a **dynamic update server**, or a **static JSON file** on any
static host (S3, gist, GitHub releases, **or our own domain**). *Source: `plugin/updater.mdx`.* For an
AGPL self-hosted, no-app-store product (D-2/D-15), the **static-JSON-on-our-own-domain** path is the natural
fit — no store, no bespoke update server needed for v1.

### 3.2 Config (`tauri.conf.json`)
```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT FROM PUBLICKEY.PEM",
      "endpoints": [
        "https://releases.<our-domain>/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```
- `bundle.createUpdaterArtifacts: true` — emits the update artifacts + their `.sig` signatures (v2 layout).
  Use `"v1Compatible"` only if supporting v1 clients. *Source: `plugin/updater.mdx`.*
- `endpoints` support the template variables `{{target}}`, `{{arch}}`, `{{current_version}}`; multiple
  endpoints allowed (fallback / channels). Endpoints can also be set at runtime for dynamic channels.
  *Source: `plugin/updater.mdx`.*
- `pubkey` is the minisign public key; it can alternatively be injected at runtime via
  `tauri_plugin_updater::Builder::new().pubkey("...")`. *Source: `plugin/updater.mdx`.*

### 3.3 Update manifest shape (static JSON)
```json
{
  "version": "1.2.0",
  "notes": "release notes",
  "pub_date": "2026-09-08T00:00:00Z",
  "platforms": {
    "linux-x86_64":   { "signature": "<content of .sig>", "url": "https://releases.<our-domain>/.../app.AppImage" },
    "windows-x86_64": { "signature": "<content of .sig>", "url": "https://releases.<our-domain>/.../app-setup.exe" },
    "darwin-x86_64":  { "signature": "<content of .sig>", "url": "https://releases.<our-domain>/.../app.app.tar.gz" }
  }
}
```
*Source: `plugin/updater.mdx` (Static JSON Update File Structure).* The `signature` field is the **content of
the artifact's `.sig` file** produced by the build (see §3.5).

### 3.4 Minisign signing keys
- Generate: `pnpm tauri signer generate -w ~/.tauri/orqafy.key` (Tauri CLI signer). Produces a **public** key
  (goes in `tauri.conf.json` `pubkey`, safe to share) and a **private** key (signs installers, **never
  share**). *Source: `plugin/updater.mdx`.*
- **Losing the private key = you can never ship updates to already-installed clients.** Store it in the
  Server-Setups vault (SOPS+age), never in the repo. *Source: `plugin/updater.mdx`; storage per `~/.claude/CLAUDE.md`.*
- Provide at build time via env: `TAURI_SIGNING_PRIVATE_KEY` (path or content) and optional
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. *Source: `plugin/updater.mdx`.*

### 3.5 Build artifacts & signature wiring (per platform)
With `createUpdaterArtifacts: true` (v2), the build emits the standard installer **plus a `.sig`**:
- **Windows:** `app-setup.exe` + `app-setup.exe.sig` (NSIS) and/or `app.msi` + `app.msi.sig` — the standard
  installer is re-used as the update artifact. *Source: `plugin/updater.mdx` (Building > v2).*
- **macOS:** the updater artifact is the `.app.tar.gz` (+ `.sig`). *(darwin platform key in the manifest.)*
- **Linux:** the AppImage (+ `.sig`).
The `.sig` file's content is what you paste into the manifest `signature` field. *(v1-compatible mode instead
produces zipped `.nsis.zip`/`.msi.zip` bundles + `.sig`. Source: `plugin/updater.mdx`.)*

### 3.6 How it fits our AGPL self-hosted delivery
- Host the installers + `latest.json` on **our own domain** (a plain static file host / object store /
  Compose-served nginx). No store, no account, consistent with D-2/D-15.
- The updater **verifies the minisign signature against `pubkey` before installing** — so even over plain
  HTTP or an untrusted mirror, a tampered artifact is rejected. Serve over HTTPS regardless.
- **[UNVERIFIED]** exact updater behaviour on macOS `.app.tar.gz` re-signing / re-notarization after an
  in-place update, and Linux AppImage in-place replacement semantics — confirm at implementation (§5).
- Ships behind our HARD HOLD: the updater is wired but pointed at a real release host only when the owner
  authorizes a distribution channel.

---

## 4. The Rust sidecar surface — sole non-TypeScript code (D-11)

**Purpose:** spawn, supervise, and restart the **file-sync sidecar** (the headless Nextcloud client, per
D-14) as a child of the desktop shell, so the user sees one app and we write no sync engine. This is exactly
what D-11's "~50–300 lines of Rust confined to sidecar supervision" refers to.

### 4.1 Mechanism (Tauri bundled sidecar)
- **Bundle the binary:** list it under `bundle.externalBin` in `tauri.conf.json`. Tauri expects the binary
  named with the **host target triple** suffix, e.g. `binaries/orqafy-sync-<triple>` (get the triple with
  `rustc --print host-tuple`). A rename step moves the compiled binary into `src-tauri/binaries/`.
  *Source: `develop/sidecar.mdx`, `learn/sidecar-nodejs.mdx`.*
- **Permission (capabilities):** grant `shell:allow-execute` scoped to the sidecar in
  `src-tauri/capabilities/*.json`, with `"sidecar": true`, `"name": "binaries/orqafy-sync"`, and either
  `"args": true` or an explicit validated arg allow-list. *Source: `develop/sidecar.mdx`, `plugin/shell.mdx`.*
- **Spawn & supervise from Rust** via `tauri_plugin_shell::ShellExt`:
  ```rust
  use tauri_plugin_shell::ShellExt;
  use tauri_plugin_shell::process::CommandEvent;

  let cmd = app.shell().sidecar("orqafy-sync").unwrap();
  let (mut rx, mut child) = cmd.spawn().expect("spawn sync sidecar");
  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(bytes) => { /* parse status line */ }
        CommandEvent::Stderr(bytes) => { /* log */ }
        CommandEvent::Terminated(payload) => { /* restart w/ backoff */ }
        _ => {}
      }
    }
  });
  ```
  *Source: `develop/sidecar.mdx` (spawn/read stdout/write stdin; `child` handle for stdin + kill).*

### 4.2 What the Rust supervision surface must do (spec)
1. **Locate & launch** the bundled sync binary on app start via `app.shell().sidecar(...)`.
2. **Own the child lifecycle** — hold the `child` handle; kill it on app exit (no orphaned sync process).
3. **Watch the event stream** — consume `CommandEvent::{Stdout,Stderr,Terminated,Error}`.
4. **Restart on crash** with **exponential backoff + a cap** (avoid hot-restart loops); surface repeated
   failures to the TS UI via a Tauri event.
5. **Drive the sync cadence** — per the **D-14 OPEN CAVEAT**, the Nextcloud headless client may be
   **one-shot, not a daemon**; if so, this surface re-invokes it on a schedule / filesystem-watch trigger
   rather than assuming a long-lived process. This is a stated feasibility check, not settled.
6. **Bridge status to TS** — emit sync state (idle / syncing / error / offline-queued) as Tauri events for
   the offline-first UI (D-15). No business logic here — status relay only.
7. **Pass only validated args** — keep the capability arg allow-list tight (paths/flags the sync client
   needs), nothing shell-general.

### 4.3 Boundaries (keep it the *sole* Rust surface)
- No sync algorithm, no conflict resolution, no file I/O logic in Rust — that lives in the Nextcloud client.
- No app/domain logic in Rust — all TypeScript (D-8/D-11). If this surface grows past supervise+relay, that
  is the D-11 signal to revisit the Tauri decision.
- macOS reminder: the sidecar binary is **signed inside-out with the `.app`** (§1.1) — it must be present at
  bundle time so codesign covers it. *Source: `crates/tauri-bundler/src/bundle/macos/app.rs`.*

---

## 5. Unverified / gaps (confirm at implementation)

Each item was NOT confirmed in the fetched context7 docs (`/tauri-apps/tauri-docs`) and must be verified
against the live Tauri v2 docs / a spike before it is load-bearing:

1. **notarytool specifically** — the bundler comment says "notarization is required for distribution" and
   env vars match Apple's notary flow, but the fetched docs did **not** name the `notarytool` binary
   explicitly (older toolchains used `altool`). Treat "Tauri drives notarytool" as **[UNVERIFIED]** — confirm
   the current notary transport.
2. **macOS `skipStapling` exact config key casing** — bundler code shows `skip_stapling`; the
   `tauri.conf.json` JSON key (`skipStapling` under `bundle.macos`) is inferred, not seen verbatim. **[UNVERIFIED]**
3. **Windows EV vs OV SmartScreen behaviour** — the reputation/SmartScreen consequences per cert type are
   general Windows knowledge, not stated in the fetched Tauri docs. **[UNVERIFIED — not a Tauri fact]**
4. **macOS updater `.app.tar.gz` re-notarization** — whether an in-place update needs the downloaded bundle
   to be independently notarized/stapled, or the minisign check suffices, was not covered. **[UNVERIFIED]**
5. **Linux AppImage in-place update semantics** — how the updater replaces a running AppImage, and whether
   the GPG AppImage signature interacts with the updater at all, not confirmed. **[UNVERIFIED]**
6. **Exact `.sig` → manifest `signature` automation** — the manifest field takes the `.sig` content; whether
   `tauri-action` / a CLI populates `latest.json` automatically for a self-hosted (non-GitHub) endpoint was
   not shown for our exact case. Likely a small script we own. **[UNVERIFIED for self-host]**
7. **One-shot vs daemon Nextcloud client** (D-14 caveat) — dictates whether §4.2(5) is a scheduler or a
   process-supervisor. Product-level feasibility check, already queued in `docs/TASK_QUEUE.md`.
8. **Updater plugin permissions** — the `updater:default`/`updater:allow-check` capability entries were not
   fetched; confirm the capability wiring alongside the shell/sidecar capability. **[UNVERIFIED]**

---

## 6. Citations

All via **context7**, library id **`/tauri-apps/tauri-docs`** (branch `v2`), fetched 2026-09-08:
- `src/content/docs/distribute/Sign/macos.mdx` — Developer ID cert, `security find-identity`, notarization
  requirement, `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` (+ `APPLE_API_KEY`/`APPLE_API_ISSUER`),
  `APPLE_SIGNING_IDENTITY`, CI keychain import, free-account caveat.
- `crates/tauri-bundler/src/bundle/macos/app.rs` — `--no-sign`, hardened runtime, inside-out signing,
  `notarize` vs `notarize_without_stapling` (`skip_stapling`), "notarization is required for distribution".
- `src/content/docs/distribute/Sign/windows.mdx` — `certificateThumbprint`/`digestAlgorithm`/`timestampUrl`,
  `signCommand` + `%1`, Azure Trusted Signing (`artifact-signing-cli`), relic + Azure Key Vault, OV/EV,
  dedicated cert requirement.
- `src/content/docs/distribute/Sign/linux.mdx` — gpg/gpg2 keygen, `SIGN`/`SIGN_KEY`/
  `APPIMAGETOOL_SIGN_PASSPHRASE`/`APPIMAGETOOL_FORCE_SIGN`, `--appimage-signature`, validate tool.
- `src/content/docs/plugin/updater.mdx` — `createUpdaterArtifacts`, `pubkey`/`endpoints`, template vars,
  static JSON manifest, minisign `signer generate`, `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)`, v2 vs
  v1Compatible artifacts + `.sig`, static-file vs dynamic-server model, runtime pubkey/endpoints.
- `src/content/docs/reference/environment-variables.mdx` — `APPLE_ID` and companion vars.
- `src/content/docs/develop/sidecar.mdx` — `externalBin`, target-triple naming, `shell:allow-execute` +
  `"sidecar": true` capability, arg validators, `ShellExt::sidecar().spawn()`, `CommandEvent`, stdin/child.
- `src/content/docs/learn/sidecar-nodejs.mdx` — `rustc --print host-tuple`, rename into `src-tauri/binaries/`,
  capability example.
- `src/content/docs/plugin/shell.mdx` — shell capability / execute-scope configuration.
- `crates/tauri-bundler/src/bundle/linux/rpm.rs` — external-binary placement / triple-suffix stripping (deb/rpm).
