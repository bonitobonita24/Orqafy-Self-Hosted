// Worker bootstrap. Real, typed queue/worker wiring; processor BODIES are
// stubs with explicit TODOs (Part 5+ implements OCR, matching, sync supervision,
// notification fan-out, reminders, and roll-ups). Swap any processor by passing
// your own into `createWorkers`.

import { Worker, type ConnectionOptions, type Processor } from 'bullmq';

import type { JobDeps } from './deps';
import { QUEUE_NAMES, type JobTypeMap, type QueueKey } from './queues';

/** A processor per queue key, each typed to that queue's data/result. */
export type ProcessorMap = {
  [K in QueueKey]: Processor<JobTypeMap[K]['data'], JobTypeMap[K]['result'], string>;
};

/** A worker per queue key. */
export type WorkerRegistry = {
  [K in QueueKey]: Worker<JobTypeMap[K]['data'], JobTypeMap[K]['result']>;
};

/**
 * Default stub processors. Each resolves without doing the real work yet — the
 * queue/worker plumbing is production-shaped, the domain logic is Part 5+.
 */
export const defaultProcessors: ProcessorMap = {
  // TODO(part-5): pull the object via @orqafy/storage, run OCR, persist text +
  // ocrStatus, then enqueue a documentMatching job.
  ocr: () => Promise.resolve({ status: 'pending' as const }),

  // TODO(part-5): match OCR text to a project/category/party; write a
  // DocumentReview row for the review tray.
  documentMatching: () => Promise.resolve({ status: 'pending' as const }),

  // TODO(part-7): serialize one `nextcloudcmd` pass per folder behind a lock,
  // parse its exit code, apply capped back-off (R8 §3.2).
  syncOrchestration: () => Promise.resolve(),

  // TODO(part-5): fan the notification to its channels (in-app row already
  // exists; push via the native app; email via the SMTP transport).
  notificationDispatch: () => Promise.resolve(),

  // TODO(part-5): resolve the reminder target's current state and, if still
  // pending, dispatch a notification.
  scheduledReminders: () => Promise.resolve(),

  // TODO(part-5): recompute milestone % + task counts for the project and
  // cache the roll-up.
  progressRollup: () => Promise.resolve(),
};

/**
 * Build the real processor map from injected deps. `ocr` and `documentMatching`
 * are implemented in later tasks; the remaining four reuse the stubs until their
 * own parts land.
 */
export function createProcessors(deps: JobDeps): ProcessorMap {
  return {
    ...defaultProcessors,
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
    // Task 5 replaces this body.
    documentMatching: defaultProcessors.documentMatching,
  };
}

/**
 * Start every worker against a shared connection. Returns the registry so the
 * host process can await graceful shutdown via {@link closeWorkers}.
 */
export function createWorkers(
  connection: ConnectionOptions,
  processors: ProcessorMap = defaultProcessors,
): WorkerRegistry {
  const make = <K extends QueueKey>(
    key: K,
  ): Worker<JobTypeMap[K]['data'], JobTypeMap[K]['result']> =>
    new Worker<JobTypeMap[K]['data'], JobTypeMap[K]['result']>(QUEUE_NAMES[key], processors[key], {
      connection,
    });

  return {
    ocr: make('ocr'),
    documentMatching: make('documentMatching'),
    syncOrchestration: make('syncOrchestration'),
    notificationDispatch: make('notificationDispatch'),
    scheduledReminders: make('scheduledReminders'),
    progressRollup: make('progressRollup'),
  };
}

/** Gracefully close every worker (drain in-flight jobs, then disconnect). */
export async function closeWorkers(workers: WorkerRegistry): Promise<void> {
  await Promise.all(Object.values(workers).map((worker) => worker.close()));
}
