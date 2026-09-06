# R-5 · Document AI — drag-a-pile-of-files-in, auto-file it

> **Status:** research / decision doc. `[HOW]`, agent-owned. No code, no commitment.
> **Authored:** 2026-09-06. **Verified against live sources on 2026-09-06** (licences and model
> availability change often — re-verify anything load-bearing before Phase 0).
> **Governing decisions:** D-2 (AGPL-3.0, public repo) · D-3 (server = Docker Compose) ·
> D-5 (single-company install) · D-7 (desktop/mobile are CLIENTS only) · D-8 (TypeScript-only in
> *our* codebase).

---

## 0. The question, restated

> The user drags a messy pile of folders and files from their PC into the app. The system reads them
> and files each document under **Client → Project → category** (invoice / PO / expense / receipt /
> payroll / drawing / permit / photo). Free. Works in a self-hosted install shipped to third parties.

The framing that matters: **this is mostly a matching problem, not an inference problem.** The app's
own DB already holds the ground truth — client names, project names and codes, PO numbers, invoice
numbers, supplier names, date ranges, contract values. The task is therefore *get text out of the
file, then look the text up in our own records*. An LLM is the **residue handler**, not the engine.

---

## 1. Verdict up front

**QUALIFIED YES.** Feasible free and self-hosted, on one condition: the architecture is the layered
L0→L4 pipeline below, **server-side**, with the LLM layer **optional and off by default**.

It is **NOT** feasible if built as "drop file → ask an LLM what it is". That design needs a model big
enough to be trustworthy, which needs hardware a small construction firm does not have, or a
third-party API key we cannot ship.

---

## 2. The layered pipeline — and how much each layer actually carries

| Layer | What it does | Tech | Share of the job it can close *on its own* | Confidence in that number |
|---|---|---|---|---|
| **L0** | File-type + structure heuristics: extension, MIME sniff, PDF text-layer vs image-only, EXIF (GPS/date/camera), folder-path hints, filename patterns | pure TypeScript | **20–35%** — routes every DWG/RVT/IFC → `drawing`, every phone JPEG with EXIF GPS → `photo` (and geofence-matches it to a project site!), every already-tidy `Clients/Acme/PO-2024-118.pdf` → straight to its home | **High.** This is deterministic file inspection, not prediction. |
| **L1** | OCR — only for image-only PDFs and photos | Tesseract / PaddleOCR sidecar | n/a — it produces the input for L2 | — |
| **L2** | Deterministic entity extraction + fuzzy match against **our DB**: project codes, PO/invoice numbers, client & supplier names, TIN, amounts, dates | regex + trigram/Levenshtein + Postgres `pg_trgm` | **+35–50%** on top of L0. A document that literally contains the string `PO-2024-118` or `Acme Builders Inc.` needs no intelligence to file — it needs a `LIKE`/similarity query | **Medium-high.** Depends entirely on OCR text quality, which is the real variable. |
| **L3** | Small local LLM — **only** the residue: no ID matched, or the category is ambiguous | Ollama sidecar, off by default | **+5–15%**, and it recovers *fewer* than people expect | **Low-medium.** See §3. |
| **L4** | Human confirmation UI: review tray, one-click fix, per-supplier template learning from that fix | TypeScript, our own | Closes the rest, and is the only layer that makes the whole thing safe | **High** |

### The honest headline

**L0 + L2, with no LLM anywhere, should file roughly 55–80% of a realistic construction-firm pile
correctly, and correctly *decline* on most of the rest.** The spread is wide because it depends on
one thing: how many of the documents contain a literal identifier that already exists in the DB.

- Firm issues its own POs/invoices from Orqafy → the number is on the document → **near-100% on those.**
- Supplier invoices quoting our PO number → very high.
- A crumpled hardware-store receipt with no reference to anything → **L2 gets the supplier and the
  amount and the date; it cannot know which project.** No LLM can either — the information is not in
  the document. That one belongs in the tray, or gets guessed from *date + site geofence + who
  uploaded it*, which is a heuristic, not AI.

That last point is the most important finding in this document: **a large slice of "unfileable" is
unfileable in principle, not for want of a better model.** Buying a bigger LLM does not fix it. A
one-tap "which project?" prompt does.

---

## 3. OCR engines (L1)

All licences verified 2026-09-06 from the projects' own LICENSE files / READMEs.

| Engine | Code licence | Weights licence | AGPL-shippable? | CPU speed, office PC (est.) | Clean digital PDF | Scanned invoice | Phone photo of crumpled receipt | PH language support |
|---|---|---|---|---|---|---|---|---|
| **Tesseract 5** | Apache-2.0 ([LICENSE](https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE)) | same, `tessdata_*` Apache-2.0 | ✅ yes, clean | ~1–3 s/page (300 dpi, 1 core) | n/a — use the text layer | **good** if deskewed ≥300 dpi | **poor** — the classic failure case | `eng` + **`fil`** (Filipino, in tessdata/best/fast); legacy `tgl` only in ≤4.00 ([lang table](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files-in-different-versions.md)) |
| **PaddleOCR (PP-OCRv5/v6)** | Apache-2.0 ([README](https://github.com/PaddlePaddle/PaddleOCR)) | Apache-2.0 | ✅ yes, clean | v6 tiers **tiny 1.5M / small 7.7M / medium 34.5M params**; README claims **5.2× CPU speedup via OpenVINO** vs v5 | excellent | **excellent** | **best of the free field** — detection model handles rotation, curvature, low contrast | 100+ langs; v6 = single model for 50 langs incl. 46 Latin-script (Filipino is Latin-script; **treat as `en`+Latin, accuracy on Tagalog unverified**) |
| **RapidOCR** | Apache-2.0 ([LICENSE](https://github.com/RapidAI/RapidOCR/blob/main/LICENSE)) | PaddleOCR models, Apache-2.0 | ✅ yes, clean | PaddleOCR models re-exported to **ONNX Runtime / OpenVINO** — same accuracy, far lighter deploy, no Paddle framework | = Paddle | = Paddle | = Paddle | as Paddle (default zh+en, others via model list) |
| **docTR** | Apache-2.0 ([LICENSE](https://github.com/mindee/doctr/blob/main/LICENSE)) | Apache-2.0 | ✅ yes | slower on CPU than Paddle | good | good | fair | Latin |
| **Surya (Surya 2)** | code Apache-2.0 | ⚠️ **modified AI Pubs OpenRAIL-M — "free for research, personal use, and startups under $5M funding/revenue"** ([README](https://github.com/datalab-to/surya#commercial-usage)) | ❌ **NO — cannot be a shipped default.** A construction firm using it to run its business is commercial use, and we cannot grant them rights we do not have | 650M-param VLM; vendor quotes **5 pages/s on an RTX 5090** — i.e. GPU-class | 83.3% olmOCR-bench (top <3B) | very good | very good | 91 langs, **English 92.3%** |
| **olmOCR-2-7B** | Apache-2.0 (model card) | Apache-2.0 | ✅ licence-wise yes | **8B VLM — unusable CPU-only.** Needs a real GPU | SOTA | SOTA | SOTA | multilingual |
| **dots.ocr** | 1.7B VLM, SOTA on OmniDocBench | ⚠️ **weights licence not confirmed in this pass — UNVERIFIED** | ⚠️ do not adopt until checked | ~1.7B VLM, still GPU-preferred | SOTA-class | SOTA-class | SOTA-class | strong on low-resource langs |
| **tesseract.js v7.0.0** | Apache-2.0 (`package.json`) | Apache-2.0 | ✅ yes | **WASM — roughly 2–5× slower than native Tesseract; est. 3–10 s/page single-threaded** *(estimate, not benchmarked)* | n/a | fair | poor | as Tesseract |

**Recommendation (L1):** **RapidOCR** (PaddleOCR models on ONNX Runtime) as the default engine,
shipped as a **container with an HTTP endpoint**. Tesseract as the fallback/simple path — it is the
one every sysadmin already understands and it is the only one with a Filipino-labelled model.
**Do not ship Surya.** Its code licence is a red herring; the weights licence is the one that binds,
and it excludes exactly our user.

**Wrapper worth knowing:** **OCRmyPDF** (MPL-2.0) adds a searchable text layer to a scanned PDF
in-place. That is a genuinely valuable side effect — after ingest, every PDF in the firm's archive
becomes full-text searchable, whether or not the auto-filing worked. Cheap win, ship it.

---

## 4. Local LLM for the L3 residue

### 4.1 Licences — the part that actually decides this

| Model | Licence | May we **bundle** it in an AGPL product? | May we **auto-download** it? | Notes |
|---|---|---|---|---|
| **Qwen3-4B-Instruct-2507** | **Apache-2.0** (model card frontmatter, verified) | ✅ yes | ✅ yes | Cleanest option at a useful size |
| **Qwen3-VL-4B-Instruct** | **Apache-2.0** (verified) | ✅ yes | ✅ yes | Vision model — could collapse L1+L3 into one, if you have the compute |
| **Phi-4-mini-instruct (3.8B)** | **MIT** (model card §License) | ✅ yes | ✅ yes | Strong at structured/instruction-following at small size |
| **Granite-4.0-H-Tiny (7B)** | **Apache-2.0** (model card) | ✅ yes | ✅ yes | IBM, enterprise-shaped, explicit tool-calling |
| **SmolLM3-3B** | **Apache-2.0** (model card §License) | ✅ yes | ✅ yes | Genuinely small |
| **Mistral-7B-Instruct-v0.3** | **apache-2.0** (frontmatter) | ✅ yes | ⚠️ HF repo has a gated-description; check gating at time of use |
| **Llama 3.x** | **Llama Community License** — not OSI. Redistribution allowed **only if** you (a) ship a copy of the agreement, (b) prominently display **"Built with Llama"**, (c) include the exact NOTICE string, (d) prefix any derived model's name with "Llama"; plus the 700M-MAU clause ([license text](https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/LICENSE)) | ⚠️ **technically yes, practically no** — it pushes a non-free, use-restricted term onto every downstream self-hoster of an AGPL product. That is exactly the "further restriction" AGPL §7 exists to prevent for *code*; the model is data, not code, so it is not strictly a licence violation — but it makes our LICENSE story a mess for zero benefit when Apache-2.0 alternatives exist | avoid | **Do not use.** No upside. |
| **Gemma 3** | **Gemma Terms of Use** — §3.1 requires you to impose the §3.2 use restrictions "**as an enforceable provision**" in any agreement governing redistribution, pass through the Prohibited Use Policy, and ship a NOTICE ([terms](https://ai.google.dev/gemma/terms)) | ❌ **no.** We would have to bolt a use-restriction EULA onto a free AGPL product | ❌ **also blocked in practice:** `google/gemma-3-1b-it` on HF returned *"Access to model … is restricted. You must have access to it and be authenticated"* on 2026-09-06 — **a gated download cannot be an unattended install step** | Hard exclude |

**Conclusion:** stay in the **Apache-2.0 / MIT** lane — Qwen3-4B, Phi-4-mini, Granite-4.0-Tiny,
SmolLM3. There is no reason to touch Llama or Gemma.

### 4.2 Runtime and hardware reality

| Runtime | Licence | TypeScript path | Verdict |
|---|---|---|---|
| **Ollama** | **MIT** ([LICENSE](https://github.com/ollama/ollama/blob/main/LICENSE)) | HTTP REST on `:11434` (`/api/chat`, `/api/generate`) — plain `fetch` from our Node/tRPC layer | ✅ **the pick.** One extra Compose service, zero Python in our repo |
| **llama.cpp / llama-server** | **MIT** ([LICENSE](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE)) | OpenAI-compatible HTTP | ✅ fine; Ollama is friendlier to package |

**Throughput on hardware a small construction firm owns** *(figures below are engineering estimates
from typical Q4_K_M llama.cpp behaviour, **not benchmarked in this pass — flag as unverified**)*:

| Hardware | Model | RAM for weights | Realistic gen speed | Usable for a batch of 200 documents? |
|---|---|---|---|---|
| 4-core i5 desktop, 8 GB, no GPU | SmolLM3-3B Q4 | ~2 GB | ~5–12 tok/s | Painful. ~10–20 s per document. A 200-file drop = ~45 min |
| 6–8-core, 16 GB, iGPU | Qwen3-4B Q4 | ~2.6 GB | ~8–15 tok/s | Tolerable **as a background job**, never inline |
| 8-core server, 32 GB | Granite-4.0-Tiny 7B Q4 | ~4.5 GB | ~4–8 tok/s | Slower per token but better judgement |
| Any of the above | 7B+ at full precision | 14 GB+ | unusable | ❌ |

### 4.3 What quality is actually achievable at 3–4B, quantised

| Task | Achievable? | Honest assessment |
|---|---|---|
| **Document-type classification** (11 fixed categories) from the first ~1000 chars of OCR text | ✅ **yes, this works well** | This is closed-set text classification, the easiest thing a small model does. Expect ~85–93% with a good prompt and a constrained output grammar. Genuinely useful. |
| **Extracting a field that is present and labelled** ("Invoice No: 4471") | ✅ yes, but **regex already got it** | The LLM adds little over L2 here. Use it only where the label is unusual. |
| **Extracting from noisy OCR of a crumpled receipt** | ⚠️ mixed | Small models hallucinate plausible numbers when the OCR is garbage. **This is the dangerous case** — a confident wrong amount is worse than a blank. |
| **Inferring which project a document belongs to, with no identifier present** | ❌ **no** | The model does not have the information. It will guess. Do not ask it to. |
| **Reasoning over a supplier list of 200 names to pick the right one** | ⚠️ works but wasteful | Trigram similarity in Postgres does this better, faster, deterministically, and explains itself. |

**Design consequence:** L3 is scoped to **classification + a small number of named-field extractions,
with a constrained JSON output schema, and it is never allowed to assign a client or project on its
own.** It proposes; L2's matcher and L4's human dispose.

---

## 5. Structured extraction without an LLM — and the per-supplier template idea

| Approach | Tool | Licence | Fit |
|---|---|---|---|
| Regex + keyword-anchored field extraction | our own TypeScript | — | ✅ carries the bulk of L2 |
| Fuzzy match to DB records | Postgres `pg_trgm` similarity + Levenshtein, already in our stack | — | ✅ the single highest-value component in the whole design |
| **Template-per-supplier** | **invoice2data** (MIT) — YAML templates, one per issuer | MIT | ✅ **the pattern is right, even if we reimplement it in TS** |
| Layout-aware document parsing | **Docling** (code MIT; *model licences separate — check per model*) — has a `docling-serve` HTTP API server | MIT code | ✅ good sidecar candidate for tables/layout, if we need it |

### The per-supplier template idea — evaluated seriously

**This is the strongest non-obvious idea in the brief, and it should be a v1 feature, not a v2 one.**

The reasoning holds up. A construction firm's document flow is dominated by **repeat issuers**: the
same six suppliers, the same two rental companies, the same LGU permit office, the same bank. Their
documents are **pixel-stable** — the invoice number sits in the same place on every invoice that
vendor has ever sent. So:

1. Document arrives, L2 identifies the **issuer** (supplier name / TIN — one high-confidence match).
2. Look for a stored template keyed by that issuer.
3. **Template hit** → extract by anchored position/regex. Deterministic, ~10 ms, ~98% accurate,
   fully explainable ("matched *Invoice No.* anchor at line 4").
4. **Template miss** → fall through to generic L2, then L3, then the tray.
5. **Human corrects one document in the tray → we write/refine that issuer's template.** The next
   invoice from that supplier files silently.

**Why this beats a generic LLM for this product specifically:**

| | Per-supplier template | Generic small LLM |
|---|---|---|
| Accuracy on the 6th invoice from the same supplier | ~98% | ~80–90%, and varies run to run |
| Cost per document | microseconds | seconds of CPU |
| Explainable to the user | yes — "matched your saved layout for Acme" | no |
| Improves when corrected | **yes, immediately and permanently** | no, not without fine-tuning |
| Hardware needed | none | 2.6 GB RAM + CPU |
| Cold start on an unseen supplier | ❌ nothing | ✅ something |

They are complements, not rivals. **The LLM's real job is to survive the cold start; the template's
job is to make the firm's steady state fast, free and correct.** After ~2 months of use in a real
firm, most of the volume should be flowing through templates and the LLM should be nearly idle.

---

## 6. Where it runs

| Option | Verdict |
|---|---|
| **(a) On each client PC** | ❌ **Reject.** Four reasons, any one fatal: (1) the **DB needed for L2 matching lives on the server** — the whole design collapses without it, and replicating client/project/PO/supplier tables to every laptop is a data-exposure and sync nightmare; (2) **D-7 says clients are thin** — bundling OCR models + a 2.6 GB LLM into a Windows and a macOS installer is a packaging workstream of its own; (3) mobile clients cannot do it at all; (4) results would vary by whose laptop processed the file. |
| **(b) On the Compose server** | ✅ **Recommended.** The DB is here. One place to install, one place to update models, one place to tune. Ships as two extra Compose services (`ocr`, and optionally `llm`), gated behind a profile so a firm that does not want them simply does not start them. The work is queued through **BullMQ, which is already in the stack** (D-1) — ingest returns instantly, processing happens in the background, the user watches a progress list. |
| **(c) Hybrid** | ⚠️ **One narrow, worthwhile slice only:** the desktop client does **L0 locally before upload** — read extension, sniff MIME, pull EXIF, check for a PDF text layer, hash for dedupe. That is milliseconds of pure TypeScript, needs no model, and lets the client **skip uploading duplicates entirely** and send extracted text instead of a 40 MB scan where possible. Everything from L1 onward is server-side. Do not put models on the client. |

**Recommendation: (b), with the (c) L0-preflight slice.**

Sizing note for the Compose bundle: OCR-only adds roughly **+1 GB RAM and ~500 MB image**. Adding the
optional LLM service adds roughly **+3–4 GB RAM**. The README must state this plainly — a firm running
this on an old office tower needs to know before it starts swapping.

---

## 7. D-8 language discipline — where the line falls

D-8's consequence clause is the governing text: *"Wrapping a third-party service through its API is
fine (it is a black box); having to write PHP, Go or Python to extend it is not."*

| Component | Language inside | In **our** codebase? | D-8 verdict |
|---|---|---|---|
| RapidOCR / PaddleOCR container with an HTTP endpoint | Python/C++ | **no** — we send an HTTP POST | ✅ **acceptable** — black-box sidecar, exactly the Syncthing/Pangolin pattern already accepted |
| Tesseract native binary invoked in a container | C++ | no | ✅ acceptable |
| **tesseract.js** (Apache-2.0, v7.0.0) | WASM, JS API | **yes — TypeScript all the way** | ✅ **purest** D-8 fit; slower, but zero foreign toolchain anywhere |
| OCRmyPDF container | Python | no — CLI in a container | ✅ acceptable |
| Docling via `docling-serve` HTTP API | Python | no | ✅ acceptable |
| **Ollama** HTTP API on `:11434` | Go | no — `fetch()` from Node | ✅ acceptable |
| Writing our own PaddleOCR fine-tuning scripts | Python | **yes** | ❌ **not acceptable** — this is the line. If a component ever requires us to maintain Python to make it do our job, drop the component. |
| invoice2data as a library | Python | yes if imported | ❌ — **take the idea, not the package.** Reimplement the YAML-template matcher in TypeScript; it is a few hundred lines and we then own it. |

**All of our own code stays TypeScript.** The pipeline orchestrator, the L0 heuristics, the L2 matcher,
the template engine, the confidence scoring, the review UI, the BullMQ workers — all TS. Foreign
languages exist only inside containers we did not write and will not modify.

**⚠️ Flag for the desktop-client `[HOW]` in D-8:** if the desktop shell ends up being Tauri, the L0
preflight must be written so it runs in the webview/Node side, not in Rust. Electron-family avoids
the question.

---

## 8. Privacy and the self-hosted promise

**The brief's reasoning is correct, and I would state it more strongly.**

| Claim | Assessment |
|---|---|
| "We cannot ship our own API keys" | **Confirmed, and it is not even close.** A key in a public AGPL repo is a key that is scraped within hours, billed to us, and revoked. There is no obfuscation that survives a public repo — the source *is* the product. |
| "Sending a firm's invoices and payrolls to a third party contradicts the self-hosted pitch" | **Confirmed, and it is worse than a contradiction — it is the one thing that would kill adoption.** The reason a construction firm self-hosts is that its payroll, its margins, its client list and its supplier pricing are the business. A default that ships those to a US API endpoint is a betrayal of the install decision, whatever the privacy policy says. In PH context there is also **RA 10173 (Data Privacy Act)** exposure the firm did not sign up for. |
| Additional point the brief did not make | **Free tiers are not a foundation.** Gemini's and Groq's free tiers are marketing, revocable at will, rate-limited, and geo-restricted. A shipped product whose core feature stops working when a vendor changes a pricing page is not a shipped product. |

### The opt-in escape hatch — what it should look like

Some firms *will* want the quality of a frontier model, and that is legitimate. Design it as:

1. **Off by default. Genuinely off** — no cloud call is ever made until an admin turns it on.
2. **The firm supplies its own key**, stored encrypted in *their* DB, entered in *their* admin UI.
   We never see it and never ship one.
3. **Provider-agnostic**: an OpenAI-compatible base URL + key + model name. That one form covers
   OpenAI, Groq, OpenRouter, a self-hosted vLLM, and Gemini's compat endpoint, and it commits us to
   no vendor.
4. **A hard, visible consent screen at enable time** naming exactly what leaves the building:
   *"Document text — including amounts, names, and payroll figures — will be sent to <host>."*
5. **Per-category opt-out** — a firm may want cloud help on drawings but never on payroll. Default
   the payroll category to *never leaves the server*, and make that toggle deliberate to change.
6. **An audit log** of every outbound call: which document, which provider, when, by whom. Note that
   D-9 already establishes we build our own audit trail at the application layer (Pangolin CE has
   none), so this rides along on the same surface.
7. **Never a dependency.** Every feature must still work with the hatch closed. It is an accelerant,
   never a requirement.

---

## 9. Failure modes and the human-in-the-loop design

Misfiling a payroll under the wrong client is not a bug, it is a **business incident** — it can leak
salaries to the wrong folder, misstate a project's cost, or corrupt a billing run.

### Failure modes, ranked by harm

| # | Failure | Harm | Mitigation |
|---|---|---|---|
| 1 | **Payroll or a bank document filed under the wrong client** | Severe — confidentiality breach inside the firm | **Payroll and HR categories NEVER auto-file. Ever. Confidence is irrelevant.** Hard rule in code, not a threshold. |
| 2 | **Invoice filed to the wrong project** | High — corrupts project cost, mis-bills a client | Require a *matched DB identifier* (not a similarity guess) to auto-file anything financial |
| 3 | **Confident wrong amount from garbage OCR** | High — silently wrong numbers | Never store an LLM-extracted amount as fact. Amounts are either regex-matched against the OCR text verbatim, or flagged for entry |
| 4 | **Two similar clients** ("ABC Construction" vs "ABC Construction & Dev't") | High and *insidious* — looks right | If the top two candidates are within a small similarity margin of each other, **force the tray regardless of absolute score** |
| 5 | Duplicate of an already-filed document | Medium — double counting | Content hash at L0, on the client, before upload |
| 6 | Everything lands unsorted | Low harm, high annoyance — kills trust in the feature | Measure it; if the tray rate exceeds ~40% the feature is failing and should say so |
| 7 | OCR silently produces empty text | Medium — document vanishes into a bucket | Explicit `ocr_failed` state, visible, retryable with a different engine |

### The three-band disposition

| Band | Condition | Behaviour |
|---|---|---|
| 🟢 **Auto-file silently** | An **exact identifier match** to a DB record (PO/invoice/project code present verbatim) **or** a per-supplier template hit, **AND** the runner-up candidate is clearly behind, **AND** the category is not payroll/HR | Files it. Shows a dismissible "12 documents filed" summary with an **Undo**. Every auto-file is logged with its reason and is reversible for 30 days. |
| 🟡 **Confirm** | Strong-but-fuzzy match, or a template hit on a new layout, or L3's classification with no ID match | Lands in the **Review tray** with our best guess **pre-selected** and the evidence shown ("matched `PO-2024-118` → Acme Tower, Purchase Order"). One click accepts. This is the design's centre of gravity — make it fast and it does not matter that it is 30% of the pile. |
| 🔴 **Unsorted tray** | No match, ambiguous top-two, OCR failed, payroll/HR, or unknown file type | Sits in **Unsorted** with the extracted text visible for search. Never guessed at. Never deleted. |

**Rule: the system must be more willing to say "I don't know" than any product instinct wants it to
be.** A tray of 40 items a user clears in three minutes builds trust. Six silent misfilings destroy it
permanently, and the user will never turn the feature back on.

### How corrections feed back

| Correction | What we learn | Where it goes |
|---|---|---|
| User re-assigns client/project | An alias: this OCR'd string → this record | `entity_alias` table — matched on every subsequent document, first-class, immediate |
| User fixes the category | Class label for this issuer + layout | Adjusts the issuer's default category |
| User fixes an extracted field on a document from a **known issuer** | **The template.** Which anchor, which offset | Writes/refines `supplier_template` — **the single highest-leverage feedback loop in the system** |
| User confirms a 🟡 correct | Positive evidence for that match shape | Nudges that pattern's threshold |

No model training, no fine-tuning, no ML pipeline. It is rows in Postgres. That is precisely why it
is maintainable by a small team in TypeScript, and why it improves from day one rather than after a
retraining cycle.

---

## 10. Build cost

Assumes one competent full-stack TS developer, on the AIEF stack, with the PM core and file storage
already built (i.e. this lands after the v1 file module, not before).

| Workstream | Estimate | Notes |
|---|---|---|
| Ingest: drag-drop of nested folders, dedupe by hash, BullMQ queue, progress UI | **1.0–1.5 wk** | The folder-tree drop and resumable large uploads are fiddlier than they look |
| L0 heuristics (MIME, EXIF, PDF text-layer detect, path/filename parsing) | **0.5 wk** | Pure TS, well-understood |
| OCR sidecar: container, HTTP client, retries, timeouts, `ocr_failed` handling, OCRmyPDF text-layer pass | **1.0 wk** | Mostly plumbing and failure handling |
| **L2 matcher: entity extraction + `pg_trgm` fuzzy matching + confidence scoring + the ambiguity rule** | **2.0–3.0 wk** | **The core.** Deserves the most time. This is where the accuracy lives |
| Per-supplier template engine (TS reimplementation of the invoice2data idea) + learn-from-correction | **1.5–2.0 wk** | Highest ROI per week spent |
| L4 Review tray UI + Unsorted + bulk-accept + Undo + audit trail | **1.5–2.0 wk** | shadcn/ui; do not skimp — this is the feature users touch |
| L3 Ollama integration, prompt + constrained JSON schema, off-by-default gating | **1.0 wk** | Small, *if* scoped to classification only |
| BYO-key escape hatch (provider-agnostic, consent screen, per-category opt-out, audit) | **0.5–1.0 wk** | |
| Compose packaging, profiles, resource docs, README honesty about RAM | **0.5 wk** | |
| Testing against a **real** messy pile from an actual firm | **1.0 wk** | Non-negotiable. Synthetic test data will lie to you about this feature |
| **Total v1** | **≈ 10.5–14.5 weeks** | Call it **3–3.5 months** of focused work |

### The thin slice — what to build first

**"Drop a folder, get searchable text and a review tray."** No LLM at all.

| In | Out |
|---|---|
| Drag-drop of files and nested folders | The LLM layer entirely |
| L0 heuristics + content-hash dedupe | Per-supplier templates (v1.1 — but design the schema for them now) |
| OCR sidecar → full-text search over every uploaded document | Auto-filing of anything financial |
| L2 matching on **exact identifier hits only** (project code / PO no. / invoice no. present verbatim) | Amount and line-item extraction |
| 🟢 auto-file only on an exact ID hit; **everything else → Review tray with a pre-selected guess** | The BYO-key hatch |
| One-click accept/correct, and corrections write `entity_alias` rows | |

**Why this is the right first cut:** it is roughly **3–4 weeks**, it needs no model licence decision,
no GPU, no extra RAM budget, and it delivers the thing users actually feel — *"I dropped 400 files
and now I can search all of them, and half of them filed themselves."* Full-text search over a
construction firm's paper archive is, on its own, worth the install. Everything above it is
incremental improvement on a working base, which is the right shape for a feature whose accuracy
ceiling is genuinely uncertain until real documents hit it.

---

## 11. RECOMMENDATION

**Feasible? QUALIFIED YES** — free, self-hosted, no cloud, no API key, no GPU, licence-clean, and
TypeScript-only in our own codebase — **provided it is built as DB-matching-first with the LLM as an
optional residue handler.** It is **not** feasible as an LLM-first design.

### Recommended architecture

| Layer | Choice | Where |
|---|---|---|
| L0 | TypeScript heuristics (MIME, EXIF, PDF text-layer, path/filename, content hash) | **Desktop client pre-upload** + server |
| L1 | **RapidOCR** container (Apache-2.0, PaddleOCR models on ONNX Runtime) via HTTP; Tesseract fallback; **OCRmyPDF** for the searchable-text-layer side effect | Compose server |
| L2 | **TypeScript entity extraction + Postgres `pg_trgm` fuzzy match against our own records** — *the core of the product* | Compose server |
| L2.5 | **Per-supplier templates in TypeScript**, written and refined from human corrections | Compose server |
| L3 | **Ollama (MIT) + Qwen3-4B-Instruct-2507 or Phi-4-mini (Apache-2.0 / MIT)** — **classification only, off by default, optional Compose profile** | Compose server |
| L4 | Review tray + Unsorted + Undo + alias/template feedback loop | Web + desktop UI |
| Escape hatch | Firm-supplied, OpenAI-compatible base URL + key. Off by default. Per-category opt-out. Payroll never leaves. | Admin UI |

**Hard exclusions:** Surya weights (OpenRAIL-M, commercial-restricted) · Llama (Community License) ·
Gemma (use-restriction pass-through **and** gated download) · any shipped API key · any Python we
would have to maintain.

### Thin-slice v1

**Drop a folder → OCR → full-text search → exact-ID auto-file → review tray.** No LLM. ~3–4 weeks.

### Top three risks

| # | Risk | Why it is the one to watch | Mitigation |
|---|---|---|---|
| **1** | **The "unfileable in principle" ceiling.** A large share of real construction paperwork — cash receipts, delivery notes, site photos of a whiteboard — contains **no identifier that ties it to a project**. No model can recover information that is not there. The feature could land at 55% and be perceived as broken | This is a **product-expectation** risk, not a technical one, and it is the likeliest way this feature disappoints | Set the expectation in the UI from day one: the promise is *"I'll file what I can prove and ask you about the rest"*, not *"I'll file everything"*. Make the tray fast enough that 40% unsorted still feels like a win. **Validate against a real firm's pile before committing the full 3 months.** |
| **2** | **A silent misfile destroys trust permanently.** One payroll in the wrong client folder and the feature is switched off forever — and the firm's confidence in the whole product takes the hit | Recovery from this is social, not technical | Payroll/HR **never** auto-files, at any confidence. Auto-file requires an *exact* identifier match, never a similarity score. Ambiguous top-two forces the tray. Undo on everything, 30 days. |
| **3** | **Hardware reality on the target box.** The install target is a small firm's office server or a spare desktop. OCR alone adds ~1 GB RAM; the LLM adds ~3–4 GB. A 200-file drop is minutes of pinned CPU on that machine | Self-hosted means we do not control the hardware, and a feature that makes the whole app sluggish will be blamed on the app | Everything through **BullMQ background jobs**, never inline. LLM service behind an opt-in Compose profile. **State the RAM and CPU cost in the README before install, not after.** Ship a "processing throttle" setting. |

---

## 12. Verification status

| Verified 2026-09-06 from primary sources | Flagged **UNVERIFIED** — confirm before relying on it |
|---|---|
| Tesseract, PaddleOCR, docTR, RapidOCR, tesseract.js v7.0.0 = Apache-2.0 (LICENSE files / `package.json`) | All CPU tokens/sec and seconds-per-page figures — **estimates, not benchmarked in this pass** |
| Surya: code Apache-2.0, **weights modified AI Pubs OpenRAIL-M, free only <$5M revenue** (project README) | All OCR accuracy ratings on "crumpled phone photo" — **judgement, no public benchmark found for that class** |
| Tesseract has `fil` (Filipino) in tessdata/best/fast; `tgl` legacy-only (tessdoc language table) | **Tagalog/Filipino accuracy** for PaddleOCR/RapidOCR — Latin-script coverage is claimed, Filipino-specific accuracy is not published |
| Qwen3-4B-Instruct-2507, Qwen3-VL-4B-Instruct, Granite-4.0-H-Tiny, SmolLM3-3B, Mistral-7B-Instruct-v0.3 = Apache-2.0; Phi-4-mini-instruct = MIT (model cards) | **dots.ocr weights licence** — not confirmed; do not adopt until checked |
| Llama 3.2 Community License clauses: "Built with Llama", NOTICE string, 700M MAU (license text) | The L0/L2 percentage shares in §2 — reasoned estimates; **only a real document pile can settle them** |
| Gemma Terms §3.1/§3.2 pass-through requirement; `google/gemma-3-1b-it` on HF returned *access restricted* | Build estimates in §10 — planning figures, not a quote |
| Ollama = MIT, REST on `:11434`; llama.cpp = MIT; Docling code = MIT (+`docling-serve` HTTP API); OCRmyPDF = MPL-2.0; invoice2data = MIT | Whether `pg_trgm` alone suffices or we need a dedicated match-scoring pass — **prototype it** |
| PaddleOCR PP-OCRv6: tiny 1.5M / small 7.7M / medium 34.5M params, 50 langs single model, "5.2× CPU speedup (OpenVINO)" (project README) | |

**Sources:** github.com/tesseract-ocr/tesseract · github.com/tesseract-ocr/tessdoc ·
github.com/naptha/tesseract.js · github.com/PaddlePaddle/PaddleOCR · github.com/RapidAI/RapidOCR ·
github.com/mindee/doctr · github.com/datalab-to/surya · github.com/ocrmypdf/OCRmyPDF ·
github.com/docling-project/docling · github.com/invoice-x/invoice2data · github.com/ollama/ollama ·
github.com/ggml-org/llama.cpp · github.com/meta-llama/llama-models · ai.google.dev/gemma/terms ·
huggingface.co/{Qwen/Qwen3-4B-Instruct-2507, Qwen/Qwen3-VL-4B-Instruct, microsoft/Phi-4-mini-instruct,
ibm-granite/granite-4.0-h-tiny, HuggingFaceTB/SmolLM3-3B, mistralai/Mistral-7B-Instruct-v0.3,
allenai/olmOCR-2-7B-1025, rednote-hilab/dots.ocr, google/gemma-3-1b-it}
