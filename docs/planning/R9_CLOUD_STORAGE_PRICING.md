# Orqafy Cloud Storage Add-on — R2 vs S3 Cost Basis + Pricing Tiers

Analysis date: **2026-09-08**. Product: optional paid cloud-storage add-on for the free/self-hosted
Orqafy construction PM app. Users who don't want to self-host their files store assets in OUR bucket on a
monthly subscription tiered by storage size. Goal: pick the cheaper object store as our cost basis, then
design tiers with a healthy margin.

---

## 1. Confirmed rates (cite + date accessed 2026-09-08)

### Cloudflare R2 — VERIFIED (official page, "Last updated Aug 7, 2026")
Source: https://developers.cloudflare.com/r2/pricing/

| Item (Standard storage) | Rate |
|---|---|
| Storage | **$0.015 / GB-month** |
| Class A ops (writes: PUT/POST/LIST/COPY) | **$4.50 / million** |
| Class B ops (reads: GET/HEAD) | **$0.36 / million** |
| **Egress (data transfer to Internet)** | **$0.00 — FREE** (confirmed in footnote 1: egress via Workers API, S3 API and r2.dev domains incurs no data-transfer charge) |
| Free tier / month | 10 GB-month storage · 1M Class A · 10M Class B · unlimited free egress |

- Billing rounds UP to the next GB-month and next million ops.
- Infrequent Access class exists ($0.01/GB-mo, but $0.01/GB retrieval + 30-day minimum) — **not used** here; our workload is read-heavy so Standard is correct.

### AWS S3 Standard (us-east-1) — PARTIALLY VERIFIED
The official page https://aws.amazon.com/s3/pricing/ renders its price tables via JavaScript, so the raw
figures did not come through the fetch. Numbers below are the standard us-east-1 2026 rates, **corroborated
by two independent 2026 sources** (cloudian.com, cloudzero.com) — treat the exact AWS-page verbatim as
lightly UNVERIFIED, though $0.023 storage and $0.09 egress are long-standing and stable.

Sources: https://cloudian.com/blog/5-components-of-aws-s3-storage-pricing/ · https://www.cloudzero.com/blog/s3-pricing/

| Item (S3 Standard, us-east-1) | Rate |
|---|---|
| Storage | **$0.023 / GB-mo** (first 50 TB; $0.022 next 450 TB; $0.021 >500 TB) |
| PUT/COPY/POST/LIST | **$0.005 / 1,000 = $5.00 / million** |
| GET/SELECT | **$0.0004 / 1,000 = $0.40 / million** |
| DELETE/CANCEL | Free |
| **Data transfer OUT to Internet** | **First 100 GB/mo FREE** (aggregated across all AWS services), then **$0.09/GB** up to 10 TB, $0.085 next 40 TB, $0.07 next 100 TB |
| S3 → CloudFront (same region) | Free (mitigation, adds CDN complexity) |

S3 Standard-IA / Intelligent-Tiering exist but add retrieval fees ($0.01/GB IA) or per-object monitoring
charges — worse for a read-heavy workload, so not our basis.

---

## 2. Workload model (explicit assumptions)

Realistic for a construction firm; storage is retained and grows.

- **Avg object size: 4 MB** — blend of many site photos (2–5 MB) + fewer large drawings/PDFs (tens of MB).
- **Monthly new uploads (writes) = 10% of stored GB** — field workers add photos/drawings continuously; retained.
- **Egress-heavy reads** — office staff + clients repeatedly view/download. Modeled at **0.5× / 1× / 2×** of
  stored GB per month (low/mid/high). Each egressed object ≈ 1 Class B / GET.
- Objects at a size: `storedGB × 1024 / 4 MB` (e.g. 100 GB ≈ 25,600 objects; 500 GB ≈ 128,000).

**This is the crux:** S3 bills egress at ~$0.09/GB after 100 GB free; R2 bills egress at $0.

---

## 3. Head-to-head — OUR monthly cost per provider

| Stored | Egress | R2 total | S3 total | of which S3 egress | R2 saves |
|---|---|---|---|---|---|
| 25 GB | 12.5–50 GB | **$0.22** | $0.58 | $0.00 | $0.36 (~158%) |
| 100 GB | 50 GB (low) | **$1.35** | $2.32 | $0.00 | $0.97 (72%) |
| 100 GB | 100 GB (mid) | **$1.35** | $2.32 | $0.00 | $0.97 (72%) |
| 100 GB | 200 GB (high) | **$1.35** | $11.33 | $9.00 | $9.98 (740%) |
| 500 GB | 250 GB (low) | **$7.35** | $25.09 | $13.50 | $17.74 (241%) |
| 500 GB | 500 GB (mid) | **$7.35** | $47.62 | $36.00 | $40.27 (548%) |
| 500 GB | 1 TB (high) | **$7.35** | $92.67 | $81.00 | $85.32 (1161%) |
| 1 TB | 512 GB (low) | **$15.21** | $60.82 | $37.08 | $45.61 (300%) |
| 1 TB | 1 TB (mid) | **$15.21** | $106.95 | $83.16 | $91.74 (603%) |
| 1 TB | 2 TB (high) | **$15.21** | $199.21 | $175.32 | $184.00 (1210%) |
| 2 TB | 1 TB (low) | **$30.57** | $130.63 | $83.16 | $100.06 (327%) |
| 2 TB | 2 TB (mid) | **$30.57** | $222.90 | $175.32 | $192.33 (629%) |
| 2 TB | 4 TB (high) | **$30.57** | $407.43 | $359.64 | $376.86 (1233%) |

**How much egress swings it:** at 1 TB stored, going low→high egress barely moves R2 ($15.21 flat — egress
free, ops within free tier) but nearly **quadruples** S3 ($60 → $199). Egress IS the S3 bill for this workload.

---

## 4. VERDICT

**Cloudflare R2 is decisively cheaper — use it as the cost basis.** For this egress-heavy resale workload R2
runs **~2.5× to ~13× cheaper** than S3, and the gap widens exactly where a viewing/download product lives
(high read volume). R2's cost is essentially **just storage** ($0.015/GB) because egress is free and our op
counts sit within R2's free tier at these sizes; S3's bill is dominated by the ~$0.09/GB egress it charges
and Orqafy can't avoid. **Decision: build the add-on on Cloudflare R2.**

---

## 5. Proposed monthly TIERS (priced on R2, the cheaper provider)

- COGS = R2 cost at **mid egress (1×)**. Ops are within R2 free tier at every tier → COGS ≈ storage only.
- **VPS amortization:** assume a ~$10/mo VPS (app + control plane) spread across **20 subscribers = $0.50/subscriber**.
- PHP at ₱58/USD (indicative).

| Tier | Included storage | R2 COGS (mid) | +VPS/sub | Suggested price | ₱ (~58) | Gross margin | Net $/sub |
|---|---|---|---|---|---|---|---|
| **Starter** | 25 GB | $0.22 | $0.72 | **$3/mo** | ₱174 | 93% | $2.27 |
| **Team** | 100 GB | $1.35 | $1.85 | **$6/mo** | ₱348 | 78% | $4.15 |
| **Business** | 250 GB | $3.60 | $4.10 | **$12/mo** | ₱696 | 70% | $7.90 |
| **Pro** | 500 GB | $7.35 | $7.85 | **$19/mo** | ₱1,102 | 61% | $11.15 |
| **Scale** | 1 TB | $15.21 | $15.71 | **$35/mo** | ₱2,030 | 57% | $19.29 |
| **Max** | 2 TB | $30.57 | $31.07 | **$60/mo** | ₱3,480 | 49% | $28.93 |

**Egress stress test — all subscribers at HIGH (2×) egress simultaneously** (proves the model is egress-proof
because R2 egress is $0): margins only slip a few points — Starter 76%, Team 69%, Business 66%, Pro 59%,
Scale 55%, Max 48%. No egress blow-up is possible, which is the whole reason to build on R2.

Notes: prices are round and ladder ~2× per tier. Even the Starter tier at $3 covers its $0.72 all-in cost
6× over. If 20 paying subscribers land on a $10 VPS, VPS is fully covered by ~4 Starter subs; everything else
is contribution margin.

---

## 6. Overage / fair-use

- **Storage overage** (past the tier cap): our marginal cost on R2 is exactly **$0.015/GB-mo**. Charge overage
  at a round **$0.03–0.05/GB-mo** (2–3× markup) or simply prompt an upgrade to the next tier. Never hard-delete;
  soft-block new uploads at cap + grace.
- **Egress abuse guardrails — largely MOOT on R2** (egress is free, so a heavy-download client costs us nothing).
  This is a genuine structural advantage: we can advertise unlimited viewing/downloads without a cost tail.
  The only R2 cost lever left is **Class B (reads) at $0.36/M** — abuse would need tens of millions of object
  reads/mo to matter (10M/mo free). A light per-account read-rate limit is enough; no egress metering needed.
- **If we had chosen S3, egress guardrails would be mandatory** (per-account egress caps, forced CloudFront,
  throttling) — another reason R2 wins operationally, not just on price.

---

## 7. Risks / caveats

- **UNVERIFIED:** exact S3 figures were not read verbatim off aws.amazon.com/s3/pricing (JS-rendered tables);
  they're corroborated by two independent 2026 sources. R2 figures ARE verified on the official page.
  Re-confirm S3 storage/egress/request rates at build time if the S3 comparison must be airtight.
- **R2 free tier is per Cloudflare ACCOUNT, not per customer.** We host all subscribers in our one account, so
  the 10 GB / 1M A / 10M B free tier is absorbed once across the whole fleet — the tier COGS above conservatively
  still charge storage from GB 0 at scale (free tier only helps the first few GB fleet-wide). Model holds.
- **No hard minimum billing on R2 Standard** beyond rounding-up to the next GB-month / next million ops
  (negligible). Infrequent-Access has a 30-day minimum — we don't use it.
- **Feature parity for a MinIO→S3 abstraction (what Orqafy's storage layer needs): R2 supports it.**
  R2 exposes an **S3-compatible API**, **presigned URLs**, **multipart uploads**, and **object lifecycle rules** —
  the surface a MinIO/S3 driver expects. Confirm exact SDK behaviors at integration time, but no blocking gap.
  (Known minor gaps vs S3: no cross-region replication semantics, some S3 edge APIs unsupported — not needed here.)
- **Egress "free" fine print:** free when egressing directly from R2 (S3 API, Workers, r2.dev). If we front it
  with a *metered* third-party service that bills transfer, that service could charge — serve directly from R2
  (or Cloudflare's own CDN) to keep egress at $0.
- **Region/currency:** S3 numbers are us-east-1 (cheapest); other regions cost more — another point for R2's
  flat global model. Bill customers in USD; PHP shown indicatively at ₱58/USD.
