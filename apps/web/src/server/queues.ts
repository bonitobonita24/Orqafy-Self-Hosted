// Server-side BullMQ queue-registry singleton + typed enqueue helpers.
//
// The tRPC layer is the producer side: it enqueues jobs the worker process
// consumes. The registry is cached on globalThis so Next.js dev HMR never opens
// a second pool of Valkey connections (same pattern as storage / the Prisma
// client).
import 'server-only';
import { connectionFromEnv, createQueues, type OcrJobData, type QueueRegistry } from '@orqafy/jobs';

const globalForQueues = globalThis as unknown as { orqafyQueues?: QueueRegistry };

/** The process-wide producer queue registry, built lazily on first use. */
export function getQueues(): QueueRegistry {
  const existing = globalForQueues.orqafyQueues;
  if (existing !== undefined) return existing;

  const queues = createQueues(connectionFromEnv(process.env));
  globalForQueues.orqafyQueues = queues;
  return queues;
}

/**
 * Enqueue an OCR job for a stored document revision. Callers should wrap this
 * in try/catch — a queue outage must never fail the metadata write that already
 * committed.
 */
export async function enqueueOcr(data: OcrJobData): Promise<void> {
  await getQueues().ocr.add('ocr', data);
}
