// @orqafy/jobs — BullMQ queues + typed job definitions + worker bootstrap,
// backed by Valkey. Producer side (createQueues) is used by the API layer;
// consumer side (createWorkers) runs in the worker process. Processor bodies
// are Part 5+ stubs; the plumbing and payload contracts are real.
export * from './connection';
export * from './queues';
export * from './worker';
export type { JobDeps } from './deps';
export type { OcrClient, OcrExtraction } from './ocr';
