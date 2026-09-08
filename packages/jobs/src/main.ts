// Worker process entrypoint (Part 7 — the `worker` compose service runs this).
// Boots every BullMQ consumer against Valkey and holds the process open until a
// termination signal, then drains in-flight jobs before exiting. Processor
// bodies are the Part-4 stubs (see worker.ts) — the plumbing is production-shaped.

import { connectionFromEnv } from './connection';
import { createWorkers, closeWorkers, type WorkerRegistry } from './worker';
import { QUEUE_NAMES } from './queues';

function main(): void {
  const connection = connectionFromEnv();
  const workers: WorkerRegistry = createWorkers(connection);

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
