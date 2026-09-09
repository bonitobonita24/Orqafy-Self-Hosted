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
