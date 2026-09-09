import { describe, expect, it, vi } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';
import type { OcrJobData } from './queues';

function makeDeps(over: {
  mimeType?: string;
  extract?: JobDeps['ocr']['extract'];
} = {}): { deps: JobDeps; update: ReturnType<typeof vi.fn>; add: ReturnType<typeof vi.fn> } {
  const update = vi.fn(() => Promise.resolve({}));
  const add = vi.fn(() => Promise.resolve(undefined));
  const deps = {
    prisma: {
      document: {
        findUnique: () => Promise.resolve({ id: 'd1', mimeType: over.mimeType ?? 'image/png' }),
        update,
      },
    },
    storage: { getObject: () => Promise.resolve({ key: 'k', body: new Uint8Array([1]), contentType: over.mimeType ?? 'image/png', size: 1 }) },
    ocr: { extract: over.extract ?? (() => Promise.resolve({ text: 'PRJ-017', engine: 'rapidocr', pages: 1 })) },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ ocrText: 'PRJ-017', ocrStatus: 'done' }) }));
    expect(add).toHaveBeenCalledWith('document-matching', { documentId: 'd1', ocrText: 'PRJ-017' });
  });

  it('skips non-image/non-pdf and does not enqueue', async () => {
    const { deps, update, add } = makeDeps({ mimeType: 'text/csv' });
    const res = await createProcessors(deps).ocr(job({ documentId: 'd1', revisionId: '0', storageKey: 'k' }), 't');
    expect(res).toMatchObject({ status: 'skipped' });
    expect(add).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ocrStatus: 'skipped' }) }));
  });

  it('marks failed and rethrows when OCR errors', async () => {
    const { deps, update } = makeDeps({ extract: () => Promise.reject(new Error('sidecar down')) });
    await expect(createProcessors(deps).ocr(job({ documentId: 'd1', revisionId: '0', storageKey: 'k' }), 't')).rejects.toThrow('sidecar down');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ocrStatus: 'failed' }) }));
  });
});
