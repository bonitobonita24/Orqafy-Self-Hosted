// Worker process entrypoint (the `worker` compose service runs this).
// Boots every BullMQ consumer against Valkey and holds the process open until a
// termination signal, then drains in-flight jobs before exiting. Processors are
// the real ones — Prisma / storage / the OCR HTTP client are wired from env via
// buildRuntimeDeps (throws early if OCR_URL is unset).

import { Queue } from 'bullmq';

import { connectionFromEnv } from './connection';
import { QUEUE_NAMES } from './queues';
import { buildRuntimeDeps } from './runtime-deps';
import { createWorkers, closeWorkers, createProcessors, type WorkerRegistry } from './worker';

/** Scheduler id for the daily DPA retention sweep — stable across restarts so
 * `upsertJobScheduler` updates the existing scheduler instead of creating a
 * duplicate (idempotent re-registration on every boot). */
const RETENTION_SWEEP_SCHEDULER_ID = 'retention-sweep-daily';

async function main(): Promise<void> {
  const connection = connectionFromEnv();
  const deps = buildRuntimeDeps();
  const workers: WorkerRegistry = createWorkers(connection, createProcessors(deps));

  // Dedicated producer-side Queue for the retention-sweep scheduler (the
  // worker registry above is consumer-side only). `upsertJobScheduler` is
  // idempotent on the scheduler id — safe to call on every process start.
  const retentionQueue = new Queue(QUEUE_NAMES.retentionSweep, { connection });
  await retentionQueue.upsertJobScheduler(
    RETENTION_SWEEP_SCHEDULER_ID,
    { pattern: '0 3 * * *' }, // daily at 03:00
    { name: 'retention-sweep', data: { mode: 'dry-run' } },
  );

  const names = Object.values(QUEUE_NAMES).join(', ');
  // eslint-disable-next-line no-console
  console.log(`[jobs] worker up — consuming queues: ${names}`);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`[jobs] ${signal} received — draining workers…`);
    void Promise.all([closeWorkers(workers), retentionQueue.close()])
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('[jobs] workers closed — exiting');
        process.exit(0);
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[jobs] error during shutdown', err);
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[jobs] fatal startup error', err);
  process.exit(1);
});
