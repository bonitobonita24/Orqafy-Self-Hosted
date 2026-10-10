// Queue catalogue + typed job payloads.
//
// One queue per background concern (PRODUCT Main Workflows + the sync/OCR
// pipelines). Payload types are the contract between the producer (tRPC
// mutations / the sync supervisor) and the worker processors in `worker.ts`.

import { Queue, type ConnectionOptions } from 'bullmq';

import type { DocumentReviewStatus, NotificationType, OcrStatus, RetentionCategory } from '@orqafy/shared';

/** Canonical queue names (kebab-case, stable — used as Redis key prefixes). */
export const QUEUE_NAMES = {
  ocr: 'ocr',
  documentMatching: 'document-matching',
  syncOrchestration: 'sync-orchestration',
  notificationDispatch: 'notification-dispatch',
  scheduledReminders: 'scheduled-reminders',
  progressRollup: 'progress-rollup',
  retentionSweep: 'retention-sweep',
} as const;

export type QueueKey = keyof typeof QUEUE_NAMES;
export type QueueName = (typeof QUEUE_NAMES)[QueueKey];

// ── Job payloads ──────────────────────────────────────────────────────────

/** Run OCR over an uploaded document revision (PRODUCT Document.ocrStatus). */
export interface OcrJobData {
  documentId: string;
  revisionId: string;
  storageKey: string;
}
export interface OcrJobResult {
  status: OcrStatus;
  text?: string;
}

/** Match an OCR'd document to a project/category/party (review tray). */
export interface DocumentMatchingJobData {
  documentId: string;
  ocrText?: string;
}
export interface DocumentMatchingJobResult {
  status: DocumentReviewStatus;
  suggestedProjectId?: string;
}

/** Drive one `nextcloudcmd` sync pass for a project folder (R8 approach a). */
export interface SyncOrchestrationJobData {
  projectId: string;
  folderPath: string;
  trigger: 'watch' | 'timer' | 'manual';
}

/** Fan a notification out to its channels (in-app / push / email). */
export interface NotificationDispatchJobData {
  notificationId: string;
  type: NotificationType;
  userId: string;
  channels: Array<'in_app' | 'push' | 'email'>;
}

/** A scheduled reminder (leave decisions, milestone sign-off, task due). */
export interface ScheduledReminderJobData {
  kind: 'leave' | 'milestone' | 'task';
  targetId: string;
  /** Epoch ms the reminder is due (used with a BullMQ delay). */
  remindAt: number;
}

/** Recompute a project's roll-up progress (milestone %, task counts). */
export interface ProgressRollupJobData {
  projectId: string;
}

/**
 * Scheduled DPA retention sweep (Rule 33 / `.ai_prompt/privacy.md`
 * RetentionPolicy sketch, DPA W6). `dry-run` (the scheduler's default) only
 * counts candidates; `enforce` deletes expired rows, skipping any category
 * whose rows have dependents (never cascade-deletes business data).
 */
export interface RetentionSweepJobData {
  mode: 'dry-run' | 'enforce';
}
export interface RetentionSweepJobResult {
  mode: 'dry-run' | 'enforce';
  /** Rows older than the category's configured retention window. */
  candidates: Partial<Record<RetentionCategory, number>>;
  /** Rows actually deleted (enforce mode only; always `{}` in dry-run). */
  deleted: Partial<Record<RetentionCategory, number>>;
  /** Candidate rows left alone because deleting them would violate an FK
   * (dependents still reference them) — never force/cascade-deleted. */
  skipped: Partial<Record<RetentionCategory, number>>;
}

/** Map each queue key to its `{ data, result }` payload types. */
export interface JobTypeMap {
  ocr: { data: OcrJobData; result: OcrJobResult };
  documentMatching: { data: DocumentMatchingJobData; result: DocumentMatchingJobResult };
  syncOrchestration: { data: SyncOrchestrationJobData; result: void };
  notificationDispatch: { data: NotificationDispatchJobData; result: void };
  scheduledReminders: { data: ScheduledReminderJobData; result: void };
  progressRollup: { data: ProgressRollupJobData; result: void };
  retentionSweep: { data: RetentionSweepJobData; result: RetentionSweepJobResult };
}

/** All producer-side queues, one per key, typed to their payloads. */
export type QueueRegistry = {
  [K in QueueKey]: Queue<JobTypeMap[K]['data'], JobTypeMap[K]['result']>;
};

/**
 * Construct every producer queue against a shared connection. The API/tRPC
 * layer enqueues jobs through these; the worker process consumes them.
 */
export function createQueues(connection: ConnectionOptions): QueueRegistry {
  const make = <K extends QueueKey>(
    key: K,
  ): Queue<JobTypeMap[K]['data'], JobTypeMap[K]['result']> =>
    new Queue<JobTypeMap[K]['data'], JobTypeMap[K]['result']>(QUEUE_NAMES[key], { connection });

  return {
    ocr: make('ocr'),
    documentMatching: make('documentMatching'),
    syncOrchestration: make('syncOrchestration'),
    notificationDispatch: make('notificationDispatch'),
    scheduledReminders: make('scheduledReminders'),
    progressRollup: make('progressRollup'),
    retentionSweep: make('retentionSweep'),
  };
}
