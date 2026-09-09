# Document OCR + Doc-Matching Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the two no-op `@orqafy/jobs` processors (`ocr`, `documentMatching`) into real processors so an uploaded document is OCR'd offline and then either auto-filed to its project or surfaced in the `DocumentReview` match tray.

**Architecture:** The worker `ocr` processor fetches the uploaded bytes via `@orqafy/storage.getObject`, POSTs them to a **profile-gated, offline OCR HTTP sidecar** (RapidOCR default, per D-13/R-5 — no OCR library inside the TS repo), persists `Document.ocrText`/`ocrStatus`, then enqueues a `documentMatching` job. The `documentMatching` processor runs deterministic **exact-ID matching** (D-13 thin slice, NO LLM): it scans the OCR text for a `Project.code`/`Project.name`, and on a confident single hit auto-files the document (sets `Document.projectId`/`clientId` + a `confirmed` `DocumentReview`), otherwise writes a `pending` `DocumentReview` for the tray. Processors are refactored behind a `createProcessors(deps)` factory so they take injected `{ prisma, storage, ocr, queues }` and are unit-testable with fakes.

**Tech Stack:** TypeScript (strict), BullMQ 5, Valkey, Prisma (`@orqafy/db`), `@orqafy/storage` (S3/MinIO), Vitest (unit), Python 3.11 + FastAPI + rapidocr_onnxruntime + poppler-utils (OCR sidecar, Docker Compose profile).

**Spec:** `docs/planning/R5_DOCUMENT_AI.md` (OCR lane) + `docs/DECISIONS_LOG.md` D-12/D-13 (thin-slice: drop → OCR → full-text search → exact-ID auto-file → review tray, no LLM in v1). Ground-truth reconnaissance: memory obs `79481`.

## Global Constraints

- **TypeScript strict everywhere; no `any`; no `.js` in `src/`** (Rule 12). `exactOptionalPropertyTypes` is on across the repo — optional props are spread conditionally (`...(x !== undefined ? { x } : {})`), never assigned `undefined`. Match `connection.ts` idiom.
- **No OCR library inside the TS repo** (D-13/R-5). OCR runs in a separate HTTP service; the worker only does an HTTP POST. RapidOCR is the default engine; Tesseract is the documented fallback (swap the service, no TS change).
- **NO LLM in v1** (D-13). Matching is deterministic exact-ID/keyword logic only.
- **Offline / self-hosted / CPU-only / licence-clean** — the OCR sidecar pulls no cloud API and no non-free model.
- **AGPL-public repo asset guard:** never add `.ai_prompt/`, `AI/`, or `starter/admincn/` content. This plan touches only `packages/jobs`, `packages/db` (no schema change — fields already exist), `deploy/compose/**`, `apps/web/src/server/queues.ts` (helper only).
- **HARD HOLD:** all work is LOCAL commits on a feature branch only. No push, no staging/prod/demo deploy. The OCR sidecar is **profile-gated** (`--profile ocr`) so the default dev stack is unchanged.
- **Branch:** `feat/document-ocr-matching` off `main` (branch-and-commit discipline). Conventional Commits + the `Co-Authored-By: Claude Opus 4.8` trailer.
- **DB access idiom:** import the shared client as `import { prisma } from '@orqafy/db'` for runtime wiring; processors receive a `PrismaClient`-typed `prisma` via deps so tests inject a fake. Confirm the exact export name from `packages/db/src/index.ts` before wiring `main.ts` (Task 6) — do not assume.

---

### Task 1: Jobs-package deps + Vitest harness + processor dependency seam

Establishes the test runner and the injectable-deps shape every later task builds on. No behavior change yet — the default processors keep resolving `{ status: 'pending' }`, but they move behind a `createProcessors(deps)` factory.

**Files:**
- Modify: `packages/jobs/package.json` (add deps + `test` script + vitest devDeps)
- Create: `packages/jobs/vitest.config.ts`
- Create: `packages/jobs/src/deps.ts` (the injected-deps type)
- Modify: `packages/jobs/src/worker.ts` (add `createProcessors(deps)`; keep `defaultProcessors` for back-compat)
- Modify: `packages/jobs/src/index.ts` (export new symbols)
- Test: `packages/jobs/src/worker.test.ts`

**Interfaces:**
- Produces: `JobDeps` type = `{ prisma: PrismaClient; storage: StorageAdapter; ocr: OcrClient; queues: Pick<QueueRegistry, 'documentMatching'> }`. `OcrClient` is defined in Task 2 — for Task 1 declare it as an imported type from `./ocr` and create a minimal `./ocr.ts` stub exporting only the `OcrClient` interface (Task 2 fills the implementation).
- Produces: `createProcessors(deps: JobDeps): ProcessorMap` — returns a full `ProcessorMap`; `ocr` and `documentMatching` are the real ones in later tasks, the other four remain the existing stubs.

- [ ] **Step 1: Add deps + test script to `packages/jobs/package.json`**

Add to `dependencies`: `"@orqafy/db": "workspace:*"`, `"@orqafy/storage": "workspace:*"`. Add to `devDependencies`: `"vitest": "^2.1.8"`. Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`. (Pin vitest to the same major already used in `packages/storage`; run `grep '"vitest"' packages/storage/package.json` and copy that exact version string.)

- [ ] **Step 2: Create `packages/jobs/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

// Node-environment unit tests for the worker processors. Prisma / storage / the
// OCR HTTP client are injected as fakes — no DB, no network, no queue in unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create `packages/jobs/src/ocr.ts` (interface only for now)**

```ts
// OCR HTTP client contract. The worker never runs OCR in-process (D-13/R-5): it
// POSTs bytes to a self-hosted OCR sidecar and receives extracted text. Task 2
// implements `createOcrClient`; this interface is the seam the processor depends on.

/** Text extracted from one document by the OCR sidecar. */
export interface OcrExtraction {
  text: string;
  /** Which engine produced it (diagnostics); e.g. 'rapidocr'. */
  engine: string;
  /** Page count the sidecar processed (PDFs rasterize to N pages). */
  pages: number;
}

/** The single OCR port the `ocr` processor depends on. */
export interface OcrClient {
  /** OCR one object's bytes. `contentType` lets the sidecar branch image vs PDF. */
  extract(input: { body: Uint8Array; contentType: string; filename: string }): Promise<OcrExtraction>;
}
```

- [ ] **Step 4: Create `packages/jobs/src/deps.ts`**

```ts
import type { PrismaClient } from '@orqafy/db';
import type { StorageAdapter } from '@orqafy/storage';

import type { OcrClient } from './ocr';
import type { QueueRegistry } from './queues';

/** Everything the real processors need, injected so they are unit-testable. */
export interface JobDeps {
  prisma: PrismaClient;
  storage: StorageAdapter;
  ocr: OcrClient;
  /** Only the queues a processor enqueues onto (the `ocr` processor fans to matching). */
  queues: Pick<QueueRegistry, 'documentMatching'>;
}
```

> If `@orqafy/db` does not re-export `PrismaClient`, import it from `@prisma/client` instead — check `packages/db/src/index.ts` exports first and use whichever is exported. If `@orqafy/storage` does not export `StorageAdapter` from its package root, add it to `packages/storage/src/index.ts` exports (it is defined in `packages/storage/src/adapter.ts`).

- [ ] **Step 5: Add `createProcessors` to `packages/jobs/src/worker.ts`**

Keep `defaultProcessors` exactly as-is. Add below it (real `ocr`/`documentMatching` bodies land in Tasks 3 & 5 — for now they delegate to the stubs so the factory compiles and the seam exists):

```ts
import type { JobDeps } from './deps';

/**
 * Build the real processor map from injected deps. `ocr` and `documentMatching`
 * are implemented in later tasks; the remaining four reuse the stubs until their
 * own parts land.
 */
export function createProcessors(deps: JobDeps): ProcessorMap {
  return {
    ...defaultProcessors,
    // Task 3 replaces this body.
    ocr: defaultProcessors.ocr,
    // Task 5 replaces this body.
    documentMatching: defaultProcessors.documentMatching,
  };
}
```

(The `deps` param is intentionally unused in Task 1 — suppress the lint with `void deps;` on the first line of the function body, or leave it and let Tasks 3/5 consume it. Prefer `void deps;` so `pnpm --filter @orqafy/jobs lint` stays green.)

- [ ] **Step 6: Export new symbols from `packages/jobs/src/index.ts`**

Add exports for `createProcessors` (from `./worker`), `JobDeps` (from `./deps`), and `OcrClient`/`OcrExtraction` (from `./ocr`). Read the existing `index.ts` first and match its export style.

- [ ] **Step 7: Write the failing test `packages/jobs/src/worker.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';

// Minimal fakes — Task 1 only asserts the factory returns a full ProcessorMap.
const fakeDeps = {
  prisma: {} as JobDeps['prisma'],
  storage: {} as JobDeps['storage'],
  ocr: { extract: async () => ({ text: '', engine: 'fake', pages: 0 }) },
  queues: { documentMatching: { add: async () => undefined } } as unknown as JobDeps['queues'],
} satisfies JobDeps;

describe('createProcessors', () => {
  it('returns a processor for every queue key', () => {
    const processors = createProcessors(fakeDeps);
    expect(Object.keys(processors).sort()).toEqual(
      ['documentMatching', 'notificationDispatch', 'ocr', 'progressRollup', 'scheduledReminders', 'syncOrchestration'].sort(),
    );
  });
});
```

- [ ] **Step 8: Install + run**

Run: `pnpm install` (root) then `pnpm --filter @orqafy/jobs test`
Expected: PASS. Then `pnpm --filter @orqafy/jobs typecheck` and `pnpm --filter @orqafy/jobs lint` — both green.

- [ ] **Step 9: Commit**

```bash
git add packages/jobs
git commit -m "feat(jobs): add vitest + createProcessors deps seam for OCR pipeline"
```

---

### Task 2: OCR HTTP client (`createOcrClient`)

The engine-agnostic HTTP client the `ocr` processor calls. Pure I/O against a URL — fully unit-testable by stubbing `fetch`.

**Files:**
- Modify: `packages/jobs/src/ocr.ts` (add `createOcrClient` + config)
- Test: `packages/jobs/src/ocr.test.ts`

**Interfaces:**
- Consumes: the `OcrClient`/`OcrExtraction` interfaces from Task 1.
- Produces: `createOcrClient(config: { baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number }): OcrClient`.

- [ ] **Step 1: Write the failing test `packages/jobs/src/ocr.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';

import { createOcrClient } from './ocr';

describe('createOcrClient', () => {
  it('POSTs the bytes as multipart and returns the parsed extraction', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ text: 'INVOICE PRJ-017', engine: 'rapidocr', pages: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createOcrClient({ baseUrl: 'http://ocr:9003', fetchImpl });

    const out = await client.extract({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      filename: 'scan.png',
    });

    expect(out).toEqual({ text: 'INVOICE PRJ-017', engine: 'rapidocr', pages: 1 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://ocr:9003/ocr');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('throws when the sidecar returns a non-2xx status', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const client = createOcrClient({ baseUrl: 'http://ocr:9003', fetchImpl });
    await expect(
      client.extract({ body: new Uint8Array([1]), contentType: 'image/png', filename: 'x.png' }),
    ).rejects.toThrow(/OCR sidecar/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orqafy/jobs test -- ocr.test.ts`
Expected: FAIL with "createOcrClient is not a function".

- [ ] **Step 3: Implement `createOcrClient` in `packages/jobs/src/ocr.ts`**

Append below the interfaces:

```ts
export interface OcrClientConfig {
  /** Base URL of the OCR sidecar, e.g. `http://ocr:9003` (env `OCR_URL`). */
  baseUrl: string;
  /** Injectable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Abort the request after this many ms (default 120_000 — OCR is slow). */
  timeoutMs?: number;
}

/** HTTP OCR client. Engine-agnostic: any sidecar honouring `POST /ocr` works. */
export function createOcrClient(config: OcrClientConfig): OcrClient {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 120_000;
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/ocr`;

  return {
    async extract(input) {
      const form = new FormData();
      const blob = new Blob([input.body], { type: input.contentType });
      form.append('file', blob, input.filename);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(endpoint, { method: 'POST', body: form, signal: controller.signal });
        if (!res.ok) {
          throw new Error(`OCR sidecar returned ${res.status} for ${input.filename}`);
        }
        const json = (await res.json()) as { text?: unknown; engine?: unknown; pages?: unknown };
        return {
          text: typeof json.text === 'string' ? json.text : '',
          engine: typeof json.engine === 'string' ? json.engine : 'unknown',
          pages: typeof json.pages === 'number' ? json.pages : 0,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @orqafy/jobs test -- ocr.test.ts` → PASS. Then `typecheck` + `lint` green.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/ocr.ts packages/jobs/src/ocr.test.ts
git commit -m "feat(jobs): add engine-agnostic OCR HTTP client"
```

---

### Task 3: `ocr` processor implementation

Fetch bytes → OCR → persist → enqueue matching. Guards mime type and marks `failed` on error so BullMQ retries.

**Files:**
- Modify: `packages/jobs/src/worker.ts` (replace the `ocr` body inside `createProcessors`)
- Test: `packages/jobs/src/worker.ocr.test.ts`

**Interfaces:**
- Consumes: `JobDeps` (Task 1), `OcrJobData`/`OcrJobResult` (`queues.ts`), `getObject` (storage), `documentMatching` queue `.add`.
- Produces: an `ocr` processor `(job: { data: OcrJobData }) => Promise<OcrJobResult>` that sets `Document.ocrStatus` and returns `{ status, text }`.

Behavior contract:
1. If `mimeType` is not `image/*` and not `application/pdf` → set `ocrStatus='skipped'`, return `{ status: 'skipped' }`, do NOT enqueue matching.
2. Otherwise set `ocrStatus='processing'`; `storage.getObject(storageKey)`; `ocr.extract(...)`; on success set `ocrText` + `ocrStatus='done'`, enqueue `documentMatching` `{ documentId, ocrText }`, return `{ status: 'done', text }`.
3. On any thrown error set `ocrStatus='failed'` then rethrow (BullMQ marks the job failed / retries).

- [ ] **Step 1: Write the failing tests `packages/jobs/src/worker.ocr.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';
import type { OcrJobData } from './queues';

function makeDeps(over: {
  mimeType?: string;
  extract?: JobDeps['ocr']['extract'];
} = {}): { deps: JobDeps; update: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn> } {
  const update = vi.fn(async () => ({}));
  const add = vi.fn(async () => undefined);
  const deps = {
    prisma: {
      document: {
        findUnique: async () => ({ id: 'd1', mimeType: over.mimeType ?? 'image/png' }),
        update,
      },
    },
    storage: { getObject: async () => ({ key: 'k', body: new Uint8Array([1]), contentType: over.mimeType ?? 'image/png', size: 1 }) },
    ocr: { extract: over.extract ?? (async () => ({ text: 'PRJ-017', engine: 'rapidocr', pages: 1 })) },
    queues: { documentMatching: { add } },
  } as unknown as JobDeps;
  return { deps, update, add };
}

const job = (d: OcrJobData) => ({ data: d }) as never;

describe('ocr processor', () => {
  it('extracts, persists ocrText+done, and enqueues matching', async () => {
    const { deps, update, add } = makeDeps();
    const res = await createProcessors(deps).ocr(job({ documentId: 'd1', revisionId: '0', storageKey: 'k' }), 't');
    expect(res).toMatchObject({ status: 'done', text: 'PRJ-017' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ ocrText: 'PRJ-017', ocrStatus: 'done' }) }));
    expect(add).toHaveBeenCalledWith('document-matching', { documentId: 'd1', ocrText: 'PRJ-017' });
  });

  it('skips non-image/non-pdf and does not enqueue', async () => {
    const { deps, update, add } = makeDeps({ mimeType: 'text/csv' });
    const res = await createProcessors(deps).ocr(job({ documentId: 'd1', revisionId: '0', storageKey: 'k' }), 't');
    expect(res).toMatchObject({ status: 'skipped' });
    expect(add).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ocrStatus: 'skipped' }) }));
  });

  it('marks failed and rethrows when OCR errors', async () => {
    const { deps, update } = makeDeps({ extract: async () => { throw new Error('sidecar down'); } });
    await expect(createProcessors(deps).ocr(job({ documentId: 'd1', revisionId: '0', storageKey: 'k' }), 't')).rejects.toThrow('sidecar down');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ocrStatus: 'failed' }) }));
  });
});
```

- [ ] **Step 2: Run to verify failure** — Run: `pnpm --filter @orqafy/jobs test -- worker.ocr.test.ts`; Expected: FAIL (still the stub returning `{status:'pending'}`).

- [ ] **Step 3: Implement the `ocr` processor in `createProcessors` (`worker.ts`)**

Replace the `ocr: defaultProcessors.ocr,` line with:

```ts
    ocr: async (job): Promise<JobTypeMap['ocr']['result']> => {
      const { documentId, storageKey } = job.data;
      const doc = await deps.prisma.document.findUnique({ where: { id: documentId } });
      if (doc === null) {
        return { status: 'skipped' as const };
      }
      const isOcrable = doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf';
      if (!isOcrable) {
        await deps.prisma.document.update({ where: { id: documentId }, data: { ocrStatus: 'skipped' } });
        return { status: 'skipped' as const };
      }
      await deps.prisma.document.update({ where: { id: documentId }, data: { ocrStatus: 'processing' } });
      try {
        const obj = await deps.storage.getObject(storageKey);
        const extraction = await deps.ocr.extract({
          body: obj.body,
          contentType: doc.mimeType,
          filename: doc.name,
        });
        await deps.prisma.document.update({
          where: { id: documentId },
          data: { ocrText: extraction.text, ocrStatus: 'done' },
        });
        await deps.queues.documentMatching.add('document-matching', { documentId, ocrText: extraction.text });
        return { status: 'done' as const, text: extraction.text };
      } catch (err) {
        await deps.prisma.document.update({ where: { id: documentId }, data: { ocrStatus: 'failed' } });
        throw err;
      }
    },
```

(Import `JobTypeMap` in `worker.ts` if not already; it is already imported per the existing file. The queue `.add` name string is `'document-matching'` to match `QUEUE_NAMES.documentMatching`.)

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @orqafy/jobs test -- worker.ocr.test.ts` → PASS. `typecheck` + `lint` green.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/worker.ts packages/jobs/src/worker.ocr.test.ts
git commit -m "feat(jobs): implement ocr processor (fetch->extract->persist->enqueue match)"
```

---

### Task 4: Exact-ID matcher (pure logic)

The deterministic core of D-13. No DB, no I/O — takes OCR text + the org's projects and returns a match verdict. Pure and heavily unit-tested.

**Files:**
- Create: `packages/jobs/src/matching.ts`
- Test: `packages/jobs/src/matching.test.ts`

**Interfaces:**
- Produces:
  - `interface ProjectRef { id: string; code: string; name: string; clientId: string }`
  - `type MatchVerdict = { kind: 'auto-file'; projectId: string; clientId: string; confidence: number; category?: DocumentCategory } | { kind: 'review'; suggestedProjectId?: string; suggestedClientId?: string; suggestedCategory?: DocumentCategory; confidence: number }`
  - `function matchDocument(input: { text: string; projects: ProjectRef[] }): MatchVerdict`
  - `function guessCategory(text: string): DocumentCategory | undefined`

Rules (deterministic, testable):
- Normalize text to uppercase for comparison.
- **Exact code match:** a project whose `code` (uppercased) appears in the text as a whole token (bounded by non-alphanumeric or string ends). If **exactly one** project code matches → `auto-file` at confidence `0.95`.
- If **>1** distinct project codes match → ambiguous → `review` with `suggestedProjectId` = the first match, confidence `0.5`.
- **Name match (no code hit):** a project whose `name` (uppercased, length ≥ 4) appears as a substring. Exactly one → `review` with that project suggested, confidence `0.6` (name is softer than a code, so tray-not-auto). >1 or zero → see below.
- **No match:** `review` with no suggestion, confidence `0.0`.
- `guessCategory`: keyword map → `invoice`/`po`/`receipt`/`expense`/`payroll`/`permit`/`drawing`; else `undefined`. Attach to every verdict where found.

- [ ] **Step 1: Write the failing tests `packages/jobs/src/matching.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { matchDocument, guessCategory } from './matching';

const projects = [
  { id: 'p1', code: 'PRJ-017', name: 'Harborfront Tower', clientId: 'c1' },
  { id: 'p2', code: 'PRJ-018', name: 'Riverside Depot', clientId: 'c2' },
];

describe('matchDocument', () => {
  it('auto-files on a single exact code hit', () => {
    const v = matchDocument({ text: 'INVOICE\nProject PRJ-017 amount due', projects });
    expect(v).toMatchObject({ kind: 'auto-file', projectId: 'p1', clientId: 'c1', confidence: 0.95, category: 'invoice' });
  });

  it('routes to review (ambiguous) when two codes match', () => {
    const v = matchDocument({ text: 'PRJ-017 and PRJ-018 both referenced', projects });
    expect(v).toMatchObject({ kind: 'review', suggestedProjectId: 'p1', confidence: 0.5 });
  });

  it('suggests via name match (no code) as review', () => {
    const v = matchDocument({ text: 'delivery for Harborfront Tower site', projects });
    expect(v).toMatchObject({ kind: 'review', suggestedProjectId: 'p1', suggestedClientId: 'c1', confidence: 0.6 });
  });

  it('review with no suggestion when nothing matches', () => {
    const v = matchDocument({ text: 'random unrelated text', projects });
    expect(v).toEqual({ kind: 'review', confidence: 0 });
  });

  it('does not match a code that is only a substring of a larger token', () => {
    const v = matchDocument({ text: 'XPRJ-0179Z', projects });
    expect(v).toMatchObject({ kind: 'review', confidence: 0 });
  });
});

describe('guessCategory', () => {
  it('detects invoice and po', () => {
    expect(guessCategory('This INVOICE is due')).toBe('invoice');
    expect(guessCategory('PURCHASE ORDER 55')).toBe('po');
    expect(guessCategory('hello world')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @orqafy/jobs test -- matching.test.ts`; Expected: FAIL ("matchDocument is not a function").

- [ ] **Step 3: Implement `packages/jobs/src/matching.ts`**

```ts
import type { DocumentCategory } from '@orqafy/shared';

export interface ProjectRef {
  id: string;
  code: string;
  name: string;
  clientId: string;
}

export type MatchVerdict =
  | { kind: 'auto-file'; projectId: string; clientId: string; confidence: number; category?: DocumentCategory }
  | {
      kind: 'review';
      suggestedProjectId?: string;
      suggestedClientId?: string;
      suggestedCategory?: DocumentCategory;
      confidence: number;
    };

const CATEGORY_KEYWORDS: Array<[DocumentCategory, RegExp]> = [
  ['invoice', /\bINVOICE\b/],
  ['po', /\b(PURCHASE ORDER|\bPO\b)\b/],
  ['receipt', /\bRECEIPT\b/],
  ['expense', /\bEXPENSE\b/],
  ['payroll', /\bPAYROLL\b/],
  ['permit', /\bPERMIT\b/],
  ['drawing', /\b(DRAWING|BLUEPRINT)\b/],
];

/** Keyword-guess a document category from OCR text; undefined when unknown. */
export function guessCategory(text: string): DocumentCategory | undefined {
  const upper = text.toUpperCase();
  for (const [category, re] of CATEGORY_KEYWORDS) {
    if (re.test(upper)) return category;
  }
  return undefined;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-token match: the code bounded by non-alphanumerics or string ends. */
function codeAppears(text: string, code: string): boolean {
  const re = new RegExp(`(?<![A-Z0-9])${escapeRegExp(code)}(?![A-Z0-9])`);
  return re.test(text);
}

/**
 * Deterministic exact-ID matcher (D-13, no LLM). Single code hit auto-files;
 * everything else routes to the review tray with a best-effort suggestion.
 */
export function matchDocument(input: { text: string; projects: ProjectRef[] }): MatchVerdict {
  const upper = input.text.toUpperCase();
  const category = guessCategory(input.text);

  const codeHits = input.projects.filter((p) => codeAppears(upper, p.code.toUpperCase()));

  if (codeHits.length === 1) {
    const p = codeHits[0]!;
    return {
      kind: 'auto-file',
      projectId: p.id,
      clientId: p.clientId,
      confidence: 0.95,
      ...(category !== undefined ? { category } : {}),
    };
  }
  if (codeHits.length > 1) {
    const p = codeHits[0]!;
    return {
      kind: 'review',
      suggestedProjectId: p.id,
      suggestedClientId: p.clientId,
      confidence: 0.5,
      ...(category !== undefined ? { suggestedCategory: category } : {}),
    };
  }

  const nameHits = input.projects.filter(
    (p) => p.name.length >= 4 && upper.includes(p.name.toUpperCase()),
  );
  if (nameHits.length === 1) {
    const p = nameHits[0]!;
    return {
      kind: 'review',
      suggestedProjectId: p.id,
      suggestedClientId: p.clientId,
      confidence: 0.6,
      ...(category !== undefined ? { suggestedCategory: category } : {}),
    };
  }

  return {
    kind: 'review',
    confidence: 0,
    ...(category !== undefined ? { suggestedCategory: category } : {}),
  };
}
```

> Note: the `no-match` test expects exactly `{ kind: 'review', confidence: 0 }`. When `guessCategory` returns undefined (as in `'random unrelated text'`) the spread adds nothing, so the object equals that literal. Keep the test inputs category-free for the strict `toEqual`.

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @orqafy/jobs test -- matching.test.ts` → PASS. `typecheck` + `lint` green. Confirm `DocumentCategory` is exported from `@orqafy/shared` (it is per `packages/shared/src/enums.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/matching.ts packages/jobs/src/matching.test.ts
git commit -m "feat(jobs): add deterministic exact-ID document matcher (D-13)"
```

---

### Task 5: `documentMatching` processor implementation

Load projects, run the matcher, apply the verdict to the DB (auto-file → update `Document` + `confirmed` `DocumentReview`; review → `pending` `DocumentReview`).

**Files:**
- Modify: `packages/jobs/src/worker.ts` (replace the `documentMatching` body in `createProcessors`)
- Test: `packages/jobs/src/worker.matching.test.ts`

**Interfaces:**
- Consumes: `matchDocument`/`ProjectRef` (Task 4), `JobDeps.prisma`, `DocumentMatchingJobData`/`Result` (`queues.ts`).
- Produces: `documentMatching` processor `(job: { data: DocumentMatchingJobData }) => Promise<DocumentMatchingJobResult>`.

Behavior contract:
1. If `ocrText` is empty/undefined → write a `pending` `DocumentReview` (confidence 0) and return `{ status: 'pending' }` (nothing to match on).
2. Load projects: `prisma.project.findMany({ select: { id, code, name, clientId } })`.
3. `matchDocument({ text: ocrText, projects })`.
4. `auto-file` → `prisma.document.update` set `projectId`, `clientId`, and `category` if the verdict carries one; create `DocumentReview` `{ fileId, suggestedProjectId, suggestedClientId, suggestedCategory?, confidence, status: 'confirmed' }`. Return `{ status: 'confirmed', suggestedProjectId }`.
5. `review` → create `DocumentReview` `{ fileId, suggested*?, confidence, status: 'pending' }`. Return `{ status: 'pending', suggestedProjectId? }`.

- [ ] **Step 1: Write the failing tests `packages/jobs/src/worker.matching.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';
import type { DocumentMatchingJobData } from './queues';

function makeDeps(projects: Array<{ id: string; code: string; name: string; clientId: string }>) {
  const docUpdate = vi.fn(async () => ({}));
  const reviewCreate = vi.fn(async () => ({}));
  const deps = {
    prisma: {
      project: { findMany: async () => projects },
      document: { update: docUpdate },
      documentReview: { create: reviewCreate },
    },
  } as unknown as JobDeps;
  return { deps, docUpdate, reviewCreate };
}
const job = (d: DocumentMatchingJobData) => ({ data: d }) as never;
const projects = [{ id: 'p1', code: 'PRJ-017', name: 'Harborfront Tower', clientId: 'c1' }];

describe('documentMatching processor', () => {
  it('auto-files a confident single code hit and writes a confirmed review', async () => {
    const { deps, docUpdate, reviewCreate } = makeDeps(projects);
    const res = await createProcessors(deps).documentMatching(job({ documentId: 'd1', ocrText: 'INVOICE PRJ-017' }), 't');
    expect(res).toMatchObject({ status: 'confirmed', suggestedProjectId: 'p1' });
    expect(docUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ projectId: 'p1', clientId: 'c1', category: 'invoice' }) }));
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: 'd1', suggestedProjectId: 'p1', status: 'confirmed', confidence: 0.95 }) }));
  });

  it('writes a pending review when nothing matches', async () => {
    const { deps, docUpdate, reviewCreate } = makeDeps(projects);
    const res = await createProcessors(deps).documentMatching(job({ documentId: 'd1', ocrText: 'unrelated' }), 't');
    expect(res).toMatchObject({ status: 'pending' });
    expect(docUpdate).not.toHaveBeenCalled();
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: 'd1', status: 'pending', confidence: 0 }) }));
  });

  it('writes a pending review when ocrText is empty', async () => {
    const { deps, reviewCreate } = makeDeps(projects);
    const res = await createProcessors(deps).documentMatching(job({ documentId: 'd1' }), 't');
    expect(res).toMatchObject({ status: 'pending' });
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending', confidence: 0 }) }));
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @orqafy/jobs test -- worker.matching.test.ts`; Expected: FAIL (stub returns `{status:'pending'}` but does no DB writes, so the `reviewCreate` assertions fail).

- [ ] **Step 3: Implement the `documentMatching` processor in `createProcessors`**

Add `import { matchDocument, type ProjectRef } from './matching';` to `worker.ts`. Replace the `documentMatching: defaultProcessors.documentMatching,` line with:

```ts
    documentMatching: async (job): Promise<JobTypeMap['documentMatching']['result']> => {
      const { documentId, ocrText } = job.data;
      if (ocrText === undefined || ocrText.trim().length === 0) {
        await deps.prisma.documentReview.create({
          data: { fileId: documentId, confidence: 0, status: 'pending' },
        });
        return { status: 'pending' as const };
      }
      const projects: ProjectRef[] = await deps.prisma.project.findMany({
        select: { id: true, code: true, name: true, clientId: true },
      });
      const verdict = matchDocument({ text: ocrText, projects });

      if (verdict.kind === 'auto-file') {
        await deps.prisma.document.update({
          where: { id: documentId },
          data: {
            projectId: verdict.projectId,
            clientId: verdict.clientId,
            ...(verdict.category !== undefined ? { category: verdict.category } : {}),
          },
        });
        await deps.prisma.documentReview.create({
          data: {
            fileId: documentId,
            suggestedProjectId: verdict.projectId,
            suggestedClientId: verdict.clientId,
            confidence: verdict.confidence,
            status: 'confirmed',
            ...(verdict.category !== undefined ? { suggestedCategory: verdict.category } : {}),
          },
        });
        return { status: 'confirmed' as const, suggestedProjectId: verdict.projectId };
      }

      await deps.prisma.documentReview.create({
        data: {
          fileId: documentId,
          confidence: verdict.confidence,
          status: 'pending',
          ...(verdict.suggestedProjectId !== undefined ? { suggestedProjectId: verdict.suggestedProjectId } : {}),
          ...(verdict.suggestedClientId !== undefined ? { suggestedClientId: verdict.suggestedClientId } : {}),
          ...(verdict.suggestedCategory !== undefined ? { suggestedCategory: verdict.suggestedCategory } : {}),
        },
      });
      return {
        status: 'pending' as const,
        ...(verdict.suggestedProjectId !== undefined ? { suggestedProjectId: verdict.suggestedProjectId } : {}),
      };
    },
```

- [ ] **Step 4: Run to verify pass** — full `pnpm --filter @orqafy/jobs test` → all suites PASS. `typecheck` + `lint` green.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/worker.ts packages/jobs/src/worker.matching.test.ts
git commit -m "feat(jobs): implement documentMatching processor (auto-file + review tray)"
```

---

### Task 6: Wire real processors into the worker entrypoint

`main.ts` currently boots `createWorkers(connection)` with the stub `defaultProcessors`. Switch it to `createProcessors(deps)` with real Prisma/storage/OCR client, env-driven, with a small concurrency bump.

**Files:**
- Modify: `packages/jobs/src/main.ts`
- Possibly create: `packages/jobs/src/runtime-deps.ts` (build `JobDeps` from env)

**Interfaces:**
- Consumes: `createProcessors` (Task 1), `createOcrClient` (Task 2), `@orqafy/db` prisma client, `@orqafy/storage` `createStorageAdapter`, `createQueues`/`connectionFromEnv`.

- [ ] **Step 1: Create `packages/jobs/src/runtime-deps.ts`**

```ts
// Build the real JobDeps for the worker process from environment configuration.
// Kept out of main.ts so it stays a thin entrypoint and deps can be smoke-tested.
import { prisma } from '@orqafy/db';
import { createStorageAdapterFromEnv } from '@orqafy/storage';

import { connectionFromEnv } from './connection';
import { createOcrClient } from './ocr';
import { createQueues } from './queues';
import type { JobDeps } from './deps';

/** Assemble the worker's live dependencies. Throws if OCR_URL is unset. */
export function buildRuntimeDeps(env: NodeJS.ProcessEnv = process.env): JobDeps {
  const ocrUrl = env['OCR_URL'];
  if (ocrUrl === undefined || ocrUrl.length === 0) {
    throw new Error('OCR_URL is required for the jobs worker (points at the OCR sidecar).');
  }
  const connection = connectionFromEnv(env);
  const queues = createQueues(connection);
  return {
    prisma,
    storage: createStorageAdapterFromEnv(env),
    ocr: createOcrClient({ baseUrl: ocrUrl }),
    queues: { documentMatching: queues.documentMatching },
  };
}
```

> **Verify the real export names before writing this file:** `grep -rn "export" packages/db/src/index.ts` (Prisma client export — likely `prisma`) and `grep -rn "createStorageAdapter" packages/storage/src` (the env-driven factory — the web app already builds an adapter; reuse that exact function name and signature). If the web app builds the adapter via a config object rather than an env helper, replicate that construction here instead of `createStorageAdapterFromEnv`, reading `apps/web/src/server/storage.ts` (or equivalent) for the pattern.

- [ ] **Step 2: Update `packages/jobs/src/main.ts` to use real processors**

Change the body of `main()`:

```ts
import { connectionFromEnv } from './connection';
import { createWorkers, closeWorkers, createProcessors, type WorkerRegistry } from './worker';
import { buildRuntimeDeps } from './runtime-deps';
import { QUEUE_NAMES } from './queues';

function main(): void {
  const connection = connectionFromEnv();
  const deps = buildRuntimeDeps();
  const workers: WorkerRegistry = createWorkers(connection, createProcessors(deps));
  // ...rest unchanged (log line, shutdown handlers)...
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter @orqafy/jobs typecheck && pnpm --filter @orqafy/jobs lint` → green. (No unit test for `main`/`runtime-deps`; they are exercised by the live e2e in Task 8. If `createStorageAdapterFromEnv` does not exist, this task's real deliverable is discovering the correct adapter constructor — do NOT invent an export.)

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/main.ts packages/jobs/src/runtime-deps.ts
git commit -m "feat(jobs): boot worker with real OCR + matching processors"
```

---

### Task 7: OCR sidecar (Compose profile) + worker wiring

Add the profile-gated RapidOCR HTTP service and give the worker container `OCR_URL` + the `@orqafy/db`/`@orqafy/storage` it now imports (Prisma client generation).

**Files:**
- Create: `deploy/compose/ocr/Dockerfile` (RapidOCR FastAPI sidecar)
- Create: `deploy/compose/ocr/app.py`
- Create: `deploy/compose/ocr/requirements.txt`
- Modify: `deploy/compose/dev/docker-compose.app.yml` (add profile-gated `ocr` service; add `OCR_URL` to `worker` env)
- Modify: `deploy/compose/dev/Dockerfile.worker` (ensure `prisma generate` runs so `@orqafy/db` client exists at runtime)
- Modify: `.env.dev` / env template (add `OCR_URL=http://ocr:9003`)

**Interfaces:**
- Produces: `POST /ocr` (multipart `file`) → `{ "text": string, "engine": "rapidocr", "pages": number }`; `GET /health` → `{ "status": "ok" }`. This is the exact contract Task 2's client consumes.

- [ ] **Step 1: `deploy/compose/ocr/requirements.txt`**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
python-multipart==0.0.20
rapidocr-onnxruntime==1.4.4
pdf2image==1.17.0
pillow==11.1.0
numpy==2.2.1
```

- [ ] **Step 2: `deploy/compose/ocr/app.py`**

```python
"""Offline OCR sidecar (D-13 / R-5). RapidOCR (PaddleOCR models on ONNX Runtime),
CPU-only, licence-clean. Accepts an image or PDF and returns extracted text.
No cloud, no LLM. Tesseract is the documented fallback engine (swap this service)."""
import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from pdf2image import convert_from_bytes
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

app = FastAPI(title="Orqafy OCR sidecar")
engine = RapidOCR()


def _ocr_image(img: Image.Image) -> str:
    result, _ = engine(np.array(img.convert("RGB")))
    if not result:
        return ""
    return "\n".join(line[1] for line in result)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    ct = (file.content_type or "").lower()
    try:
        if ct == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
            pages = convert_from_bytes(data, dpi=200)
            texts = [_ocr_image(p) for p in pages]
            return {"text": "\n".join(texts), "engine": "rapidocr", "pages": len(pages)}
        img = Image.open(io.BytesIO(data))
        return {"text": _ocr_image(img), "engine": "rapidocr", "pages": 1}
    except Exception as exc:  # noqa: BLE001 — surface any decode/OCR failure as 500
        raise HTTPException(status_code=500, detail=f"ocr failed: {exc}") from exc
```

- [ ] **Step 3: `deploy/compose/ocr/Dockerfile`**

```dockerfile
FROM python:3.11-slim
# poppler-utils provides pdftoppm for pdf2image (PDF rasterisation before OCR).
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 9003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9003"]
```

- [ ] **Step 4: Add the `ocr` service to `deploy/compose/dev/docker-compose.app.yml`**

Add a service (read the existing file first to match indentation, network name, and the `${VAR}` env style). Profile-gated so it is opt-in:

```yaml
  ocr:
    build:
      context: ../ocr
      dockerfile: Dockerfile
    container_name: orqafy_dev_ocr
    restart: unless-stopped
    profiles: ["ocr"]
    ports:
      - "${OCR_PORT:-9003}:9003"
    # RapidOCR models (~500MB) download on first run; ~1GB RAM headroom.
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:9003/health').status==200 else 1)"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
```

Then add to the existing `worker` service `environment:` block: `OCR_URL=http://ocr:9003`. (The worker does not need `depends_on: ocr` — a queued OCR job simply fails and retries until the sidecar is up.)

- [ ] **Step 5: Ensure the worker image generates the Prisma client**

Read `deploy/compose/dev/Dockerfile.worker`. The worker now imports `@orqafy/db`, whose client must be generated. If the Dockerfile does not already run `pnpm --filter @orqafy/db prisma generate` (or a root `prisma generate`), add it after `pnpm install` and before `CMD`. Match how the web app's Dockerfile does it (read `deploy/compose/dev/Dockerfile.web` or equivalent for the exact command).

- [ ] **Step 6: Env template**

Add `OCR_URL=http://ocr:9003` and `OCR_PORT=9003` to `.env.dev` (and the checked-in `.env.example`/template if one exists — never commit real secrets; these are non-secret local values).

- [ ] **Step 7: Build the sidecar image**

Run: `docker compose -f deploy/compose/dev/docker-compose.app.yml --profile ocr build ocr`
Expected: image builds (first build is slow — pip installs onnxruntime). If the build fails, this is the point to fall back to the Tesseract path (R-5 fallback) — document the failure in `docs/planning/` and swap `app.py`/`requirements.txt` to `pytesseract` + `tesseract-ocr` apt package, keeping the same `/ocr` contract; no TS change needed.

- [ ] **Step 8: Commit**

```bash
git add deploy/compose/ocr deploy/compose/dev/docker-compose.app.yml deploy/compose/dev/Dockerfile.worker .env.dev
git commit -m "feat(deploy): add profile-gated RapidOCR sidecar + wire worker OCR_URL"
```

---

### Task 8: Live end-to-end verification (evidence, not self-report)

Prove the whole path on the running dev stack. Rule 32 Verifiable-Done: real upload → OCR runs → text extracted → matcher populates the tray.

**Files:** none (verification only) — capture evidence to `screenshots/` and worker logs to `test-artifacts/`.

- [ ] **Step 1: Start the stack with the OCR profile**

Run: `bash deploy/compose/start.sh dev up -d --build` then `docker compose -f deploy/compose/dev/docker-compose.app.yml --profile ocr up -d --build ocr worker`
Confirm: `docker ps` shows `orqafy_dev_ocr` healthy and `orqafy_dev_worker` up. Tail worker logs in a background pane: `docker logs -f orqafy_dev_worker` — expect `[jobs] worker up — consuming queues: ocr, document-matching, ...`.

- [ ] **Step 2: Seed a matchable project**

Ensure a project exists with a known `code` (e.g. `PRJ-017`) via the web UI or a Prisma script. Record its `code`, `id`, `clientId`.

- [ ] **Step 3: Upload a document whose text contains the code**

Prepare a PNG/JPG (or PDF) that visibly contains `PRJ-017` and an `INVOICE` header (a screenshot of typed text is fine). Upload it through the web app's document upload UI (the path that calls `enqueueOcr`). Use Playwright (isolated) to drive login → documents → upload, and capture a screenshot.

- [ ] **Step 4: Verify the pipeline ran**

- Worker logs show the `ocr` job completing then a `document-matching` job.
- DB check (Prisma script or pgAdmin): the `Document` row has `ocrStatus='done'` and non-empty `ocrText`; because the code matched, `projectId`/`clientId` are set and a `DocumentReview` row exists with `status='confirmed'`, `confidence=0.95`.
- Upload a second document with NO code → confirm `ocrStatus='done'`, a `pending` `DocumentReview` row (tray) is created.

- [ ] **Step 5: Capture evidence**

Save worker-log excerpt + the two DB states + the Playwright screenshot to `test-artifacts/ocr-e2e-2026-09-09/`. This is the done-claim evidence.

- [ ] **Step 6: Dev-freshness + close**

Run `bash scripts/dev-freshness-check.sh --report-only` (worker + web fresh off the branch). Then governance reconcile (STATE.md, TASK_QUEUE.md, CHANGELOG_AI.md, SESSION_LOG.md), commit, rewrite the slot handoff, and reboot per the save-session routine. HARD HOLD — nothing pushed.

---

## Self-Review

**Spec coverage (D-13 thin slice: drop → OCR → full-text search → exact-ID auto-file → review tray, no LLM):**
- drop/upload → already live (enqueueOcr). ✅ (unchanged)
- OCR → Tasks 2, 3, 7 (HTTP sidecar + processor). ✅
- full-text search target → `Document.ocrText` persisted (Task 3); search UI is a separate existing/next surface, out of this plan's scope (noted). ✅ persisted
- exact-ID auto-file → Task 4 (`auto-file` verdict) + Task 5 (Document update). ✅
- review tray → Task 5 (`pending` DocumentReview). ✅
- no LLM → matcher is deterministic. ✅
- offline/self-hosted/CPU/licence-clean → RapidOCR sidecar, no cloud. ✅

**Placeholder scan:** every code step has real content; no TBD/"handle edge cases". The two "verify the real export name" notes (Tasks 1, 6) are explicit discovery steps, not placeholders — they name exactly what to grep and the fallback.

**Type consistency:** `OcrClient.extract` signature identical across Tasks 1/2/3. `JobDeps` shape identical Tasks 1/4/5/6. Queue `.add` name string `'document-matching'` matches `QUEUE_NAMES.documentMatching`. `MatchVerdict` fields (`kind`, `projectId`, `clientId`, `confidence`, `category`, `suggested*`) consistent Tasks 4↔5. Prisma model/field names (`document.update`, `documentReview.create`, `project.findMany`, `fileId`, `suggestedProjectId`, `suggestedClientId`, `suggestedCategory`, `confidence`, `status`) match `schema.prisma` verbatim.

**Known scope boundary (not gaps):** review-tray *UI* surface and full-text *search UI* are separate existing/next web surfaces — this plan makes the data correct (the tray is populated, `ocrText` is searchable); building/altering those screens is out of scope and belongs to a follow-up task if they don't already exist.
