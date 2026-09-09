// Worker process entrypoint (the `worker` compose service runs this).
// Boots every BullMQ consumer against Valkey and holds the process open until a
// termination signal, then drains in-flight jobs before exiting. Processors are
// the real ones — Prisma / storage / the OCR HTTP client are wired from env via
// buildRuntimeDeps (throws early if OCR_URL is unset).

import { connectionFromEnv } from './connection';
import { QUEUE_NAMES } from './queues';
import { buildRuntimeDeps } from './runtime-deps';
import { createWorkers, closeWorkers, createProcessors, type WorkerRegistry } from './worker';

function main(): void {
  const connection = connectionFromEnv();
  const deps = buildRuntimeDeps();
  const workers: WorkerRegistry = createWorkers(connection, createProcessors(deps));

  const names = Object.values(QUEUE_NAMES).join(', ');
  // eslint-disable-next-line no-console
  console.log(`[jobs] worker up — consuming queues: ${names}`);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`[jobs] ${signal} received — draining workers…`);
    void closeWorkers(workers)
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

main();
