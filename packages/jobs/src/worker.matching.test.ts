import { describe, expect, it, vi } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';
import type { DocumentMatchingJobData } from './queues';

function makeDeps(projects: Array<{ id: string; code: string; name: string; clientId: string }>) {
  const docUpdate = vi.fn(() => Promise.resolve({}));
  const reviewCreate = vi.fn(() => Promise.resolve({}));
  const deps = {
    prisma: {
      project: { findMany: () => Promise.resolve(projects) },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(docUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ projectId: 'p1', clientId: 'c1', category: 'invoice' }) }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: 'd1', suggestedProjectId: 'p1', status: 'confirmed', confidence: 0.95 }) }));
  });

  it('writes a pending review when nothing matches', async () => {
    const { deps, docUpdate, reviewCreate } = makeDeps(projects);
    const res = await createProcessors(deps).documentMatching(job({ documentId: 'd1', ocrText: 'unrelated' }), 't');
    expect(res).toMatchObject({ status: 'pending' });
    expect(docUpdate).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: 'd1', status: 'pending', confidence: 0 }) }));
  });

  it('writes a pending review when ocrText is empty', async () => {
    const { deps, reviewCreate } = makeDeps(projects);
    const res = await createProcessors(deps).documentMatching(job({ documentId: 'd1' }), 't');
    expect(res).toMatchObject({ status: 'pending' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed `any` by vitest
    expect(reviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending', confidence: 0 }) }));
  });
});
