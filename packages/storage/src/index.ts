// @orqafy/storage — S3-compatible object storage behind one interface, with an
// NFS/MinIO path AND a local-disk fallback selected by config (R-2). Provider-
// agnostic so the same code serves MinIO, AWS S3, and the post-v1 R2 add-on (D-27).
export * from './adapter';
export { S3StorageAdapter } from './s3-adapter';
export { LocalDiskStorageAdapter } from './local-disk-adapter';
export { createStorageAdapter, createStorageAdapterFromRaw } from './factory';
