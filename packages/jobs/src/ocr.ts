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
      // Under the newer TS DOM lib `Uint8Array` is generic over `ArrayBufferLike`
      // (which includes `SharedArrayBuffer`) and no longer satisfies `BlobPart`
      // structurally, so `new Blob([input.body])` fails to typecheck through the
      // web app's stricter lib. `.slice()` returns a full-length copy backed by a
      // fresh `ArrayBuffer`; passing that buffer (a valid BlobPart in both the DOM
      // and Node libs) is behaviourally identical and resolves in both tsconfigs.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- required under the web app's stricter DOM lib (ArrayBufferLike ⊄ BlobPart); this package's own lib deems it redundant, so the two tsconfigs disagree.
      const blob = new Blob([input.body.slice().buffer as ArrayBuffer], {
        type: input.contentType,
      });
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
