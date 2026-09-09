import { describe, expect, it } from 'vitest';

import { createProcessors } from './worker';
import type { JobDeps } from './deps';

// Minimal fakes — Task 1 only asserts the factory returns a full ProcessorMap.
const fakeDeps = {
  prisma: {} as JobDeps['prisma'],
  storage: {} as JobDeps['storage'],
  ocr: { extract: () => Promise.resolve({ text: '', engine: 'fake', pages: 0 }) },
  queues: { documentMatching: { add: () => Promise.resolve(undefined) } } as unknown as JobDeps['queues'],
} satisfies JobDeps;

describe('createProcessors', () => {
  it('returns a processor for every queue key', () => {
    const processors = createProcessors(fakeDeps);
    expect(Object.keys(processors).sort()).toEqual(
      ['documentMatching', 'notificationDispatch', 'ocr', 'progressRollup', 'scheduledReminders', 'syncOrchestration'].sort(),
    );
  });
});
