# PRODUCT.md back-port — D-36 / D-37 / D-38 (paste-ready)

`docs/PRODUCT.md` is human-edited only (Rule 1), so the agent drafts and the owner pastes.
These three decisions were made on 2026-10-11 and are already built and shipped in v0.2.0, but
PRODUCT.md doesn't describe them yet. Paste each block where it says, then delete this file
(or tell the agent to).

---

## 1 · D-36 — under `## Data Sensitivity` (append)

```markdown
**Document access (D-36):** this is a single-company install, so documents **not** flagged SPI are
shared across the organisation — any signed-in user can list and download them. The **SPI flag is the
confidentiality boundary**: SPI documents need `view_finances`. Per-project document confidentiality is
a possible future feature, not v1 behaviour.
```

## 2 · D-37 — under `## User Roles & Access Control` (append after the Site-photo upload paragraph)

```markdown
**Passwords (D-37):** every signed-in user can **change their own password** (current password
required; rate-limited). An admin with `manage_users` can **reset** any user's password — this is the
recovery path for a forgotten password. There is **no email-based reset** (LAN-first install, no SMTP
assumed). Any password change or reset signs the user out everywhere: older mobile tokens and web
sessions stop working.
```

## 3 · D-38 — under `## Compliance & Data Privacy` (replace the "DPA mechanisms — built into v1" bullet)

```markdown
- **DPA mechanisms — built into v1 (defaults confirmed, D-38):**
  - **Retention periods** per category (`audit_log`, `notification`, `photo`, `document`,
    `completed_project`, `leave_request`). Unset = never auto-delete. The retention job runs
    **dry-run by default**. SPI/payroll records are never a retention category.
  - **Export-my-data** for every user (self-service); admins can export any user.
  - **Erasure** is **admin-only** (`manage_users`). It pseudonymizes the person in place. SPI/payroll
    documents are **kept** (the firm's legal records), with the uploader reference pseudonymized.
  - **Access audit log** — who viewed/downloaded what, including SPI views, with the request IP.
  - **Breach notification** is **not** a v1 feature.
```
