import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';
import { documentCategoryEnum, ocrStatusEnum } from '../enums';

/** One entry in a Document's revision chain (concurrent edits kept as revisions). */
export const documentRevisionSchema = z.object({
  revision: z.number().int().nonnegative(),
  storageKey: z.string(),
  size: z.number().int().nonnegative(),
  uploadedBy: idSchema,
  uploadedAt: z.date(),
  note: z.string().optional(),
});
export type DocumentRevision = z.infer<typeof documentRevisionSchema>;

/**
 * A stored file. `storageKey` points at the object in MinIO/S3 (the bytes live
 * there, never in the row). `isSPI` gates payroll/HR documents behind finance
 * permissions and excludes them from broad search (PH DPA).
 */
export const documentSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  storageKey: z.string(),
  projectId: idSchema.optional(),
  clientId: idSchema.optional(),
  category: documentCategoryEnum,
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  ocrText: z.string().optional(),
  ocrStatus: ocrStatusEnum.default('pending'),
  isSPI: z.boolean().default(false),
  revisionHistory: z.array(documentRevisionSchema).default([]),
  uploadedBy: idSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Document = z.infer<typeof documentSchema>;
