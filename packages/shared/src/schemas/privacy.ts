import { z } from 'zod';
import { idSchema, emailSchema, nonEmptyString } from '../primitives';

/**
 * DPA retention categories (Rule 33 / `.ai_prompt/privacy.md` — RetentionPolicy
 * sketch). SPI/payroll entities (payroll documents, leave `reason` text) are
 * deliberately EXCLUDED — never auto-deleted by a retention job.
 * NOTE: this category set is owner-confirmable — see PENDING_DECISIONS.md (a
 * [WHAT], not yet locked); extend the enum there before here.
 */
export const retentionCategoryEnum = z.enum([
  'audit_log',
  'notification',
  'photo',
  'document',
  'completed_project',
  'leave_request',
]);
export type RetentionCategory = z.infer<typeof retentionCategoryEnum>;

/**
 * { category: retainDays }. Zod's `z.record` with an enum key schema already
 * validates a PARTIAL object — only the keys present are checked against the
 * enum + value schema, absent keys are not required. 0 or an absent key both
 * mean "no auto-deletion for that category".
 */
export const retentionSettingsSchema = z.record(
  retentionCategoryEnum,
  z.number().int().min(0),
);
export type RetentionSettings = z.infer<typeof retentionSettingsSchema>;

/** Org-level DPA settings update (DPO contact + retention policy). */
export const orgSettingsUpdateSchema = z.object({
  dpoName: z.string().max(200).nullish(),
  dpoContact: z.string().max(200).nullish(),
  retentionSettings: retentionSettingsSchema.nullish(),
});
export type OrgSettingsUpdate = z.infer<typeof orgSettingsUpdateSchema>;

/** Right-to-access/portability request. Omitted `userId` = self. */
export const dataExportRequestSchema = z.object({
  userId: idSchema.optional(),
});
export type DataExportRequest = z.infer<typeof dataExportRequestSchema>;

/** Right-to-erasure request — `confirm: true` is a deliberate, non-defaultable ack. */
export const eraseUserSchema = z.object({
  userId: idSchema,
  confirm: z.literal(true),
});
export type EraseUser = z.infer<typeof eraseUserSchema>;

/**
 * Right-to-access/portability export shape (`.ai_prompt/privacy.md` dsr.access
 * / dsr.port). NEVER carries `passwordHash` or file bytes — documents/photos
 * carry only their `storageKey` (the bytes live in object storage).
 */
export const dataExportProfileSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  email: emailSchema,
  phone: z.string().optional(),
  isActive: z.boolean(),
  roleName: nonEmptyString,
  createdAt: z.date(),
});
export type DataExportProfile = z.infer<typeof dataExportProfileSchema>;

export const dataExportTaskSchema = z.object({
  id: idSchema,
  title: nonEmptyString,
  projectId: idSchema,
  status: z.string(),
  createdAt: z.date(),
});
export type DataExportTask = z.infer<typeof dataExportTaskSchema>;

export const dataExportDocumentSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  storageKey: z.string(),
  category: z.string(),
  createdAt: z.date(),
});
export type DataExportDocument = z.infer<typeof dataExportDocumentSchema>;

export const dataExportPhotoSchema = z.object({
  id: idSchema,
  storageKey: z.string(),
  taskId: idSchema.optional(),
  milestoneId: idSchema.optional(),
  capturedAt: z.date(),
});
export type DataExportPhoto = z.infer<typeof dataExportPhotoSchema>;

export const dataExportLeaveRequestSchema = z.object({
  id: idSchema,
  leaveTypeId: idSchema,
  startDate: z.date(),
  endDate: z.date(),
  status: z.string(),
  createdAt: z.date(),
});
export type DataExportLeaveRequest = z.infer<typeof dataExportLeaveRequestSchema>;

export const dataExportLeaveBalanceSchema = z.object({
  leaveTypeId: idSchema,
  year: z.number().int(),
  entitled: z.number(),
  used: z.number(),
  remaining: z.number(),
});
export type DataExportLeaveBalance = z.infer<typeof dataExportLeaveBalanceSchema>;

export const dataExportNotificationSchema = z.object({
  id: idSchema,
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.date(),
});
export type DataExportNotification = z.infer<typeof dataExportNotificationSchema>;

export const dataExportAuditLogSchema = z.object({
  id: idSchema,
  action: nonEmptyString,
  targetType: z.string(),
  targetId: idSchema.optional(),
  timestamp: z.date(),
});
export type DataExportAuditLog = z.infer<typeof dataExportAuditLogSchema>;

/**
 * Full right-to-access/portability export document (`.ai_prompt/privacy.md`
 * dsr.access / dsr.port). Metadata only for file-backed entities — never bytes.
 */
export const dataExportPayloadSchema = z.object({
  exportedAt: z.date(),
  profile: dataExportProfileSchema,
  tasks: z.array(dataExportTaskSchema).default([]),
  documents: z.array(dataExportDocumentSchema).default([]),
  photos: z.array(dataExportPhotoSchema).default([]),
  leaveRequests: z.array(dataExportLeaveRequestSchema).default([]),
  leaveBalances: z.array(dataExportLeaveBalanceSchema).default([]),
  notifications: z.array(dataExportNotificationSchema).default([]),
  auditLogs: z.array(dataExportAuditLogSchema).default([]),
});
export type DataExportPayload = z.infer<typeof dataExportPayloadSchema>;
