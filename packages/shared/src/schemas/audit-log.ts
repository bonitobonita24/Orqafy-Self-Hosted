import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';
import { auditTargetTypeEnum } from '../enums';

/**
 * App-layer DPA access trail (D-20): who did what to which record, when.
 * Append-only in practice; `metadata` carries request-specific context.
 */
export const auditLogSchema = z.object({
  id: idSchema,
  userId: idSchema,
  action: nonEmptyString,
  targetType: auditTargetTypeEnum,
  targetId: idSchema.optional(),
  ip: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.date(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
