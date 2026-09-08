// Shared enums — the controlled vocabularies referenced across v1 entities.
// Values mirror docs/PRODUCT.md ("User Roles & Access Control" + "Core Entities").
// Pure Zod; source of truth for both the DB layer (Part 3) and the API/UI.
import { z } from 'zod';

/**
 * Predefined starting-point roles (PRODUCT "User Roles & Access Control").
 * Engineer & architect both map to `project_manager`. `accountant`/`client`
 * are v2-facing but enumerated now so the role model is stable.
 * NOTE: roles are seeded as system PermissionGroups at Part 3 — this enum is
 * the seed identity, while User.roleId remains a reference to a role record.
 */
export const systemRoleEnum = z.enum([
  'owner_admin',
  'project_manager',
  'field_staff',
  'accountant',
  'client',
]);
export type SystemRole = z.infer<typeof systemRoleEnum>;

/**
 * Assignable permissions (PRODUCT "Key permissions"). Custom PermissionGroups
 * and per-user overrides are composed from these.
 */
export const permissionEnum = z.enum([
  'manage_users',
  'configure_server',
  'create_project',
  'view_finances',
  'manage_finances',
  'approve_leave',
  'manage_files',
  'view_all_projects',
  'export_data',
  'view_audit_log',
]);
export type Permission = z.infer<typeof permissionEnum>;

/** Project lifecycle (PRODUCT Project.status). */
export const projectStatusEnum = z.enum([
  'planning',
  'active',
  'on-hold',
  'completed',
  'cancelled',
]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

/** Task board/lifecycle status (PRODUCT Task.status). */
export const taskStatusEnum = z.enum(['todo', 'in-progress', 'blocked', 'done']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

/**
 * Task priority. PRODUCT names the field but not its values; this is a
 * conventional four-level scale (ASSUMPTION — see report).
 */
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

/** Milestone lifecycle (PRODUCT names the field, not its values — ASSUMPTION). */
export const milestoneStatusEnum = z.enum(['pending', 'in-progress', 'completed']);
export type MilestoneStatus = z.infer<typeof milestoneStatusEnum>;

/** Milestone client sign-off state (PRODUCT: pending/approved/rejected, v2). */
export const signOffStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export type SignOffStatus = z.infer<typeof signOffStatusEnum>;

/** Document category (PRODUCT Document.category — "PO" normalised to `po`). */
export const documentCategoryEnum = z.enum([
  'invoice',
  'po',
  'expense',
  'receipt',
  'payroll',
  'drawing',
  'permit',
  'photo',
  'other',
]);
export type DocumentCategory = z.infer<typeof documentCategoryEnum>;

/** OCR pipeline state (PRODUCT Document.ocrStatus — values conventional). */
export const ocrStatusEnum = z.enum(['pending', 'processing', 'done', 'failed', 'skipped']);
export type OcrStatus = z.infer<typeof ocrStatusEnum>;

/** Review-tray disposition (PRODUCT DocumentReview.status). */
export const documentReviewStatusEnum = z.enum(['pending', 'confirmed', 'reassigned']);
export type DocumentReviewStatus = z.infer<typeof documentReviewStatusEnum>;

/**
 * Notification kinds (PRODUCT Main Workflows). Extensible; the payload shape is
 * per-type and carried as a structured record on the Notification entity.
 */
export const notificationTypeEnum = z.enum([
  'task_assigned',
  'geofence_alert',
  'leave_requested',
  'leave_decided',
  'milestone_signoff',
  'document_review',
  'mention',
  'system',
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

/** Leave request state (PRODUCT LeaveRequest.status). */
export const leaveRequestStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export type LeaveRequestStatus = z.infer<typeof leaveRequestStatusEnum>;

/** Audit-log target kinds (DPA access trail; extend as entities are added). */
export const auditTargetTypeEnum = z.enum([
  'organization',
  'user',
  'permission_group',
  'client',
  'project',
  'task',
  'milestone',
  'document',
  'document_review',
  'photo',
  'notification',
  'leave_type',
  'leave_balance',
  'leave_request',
]);
export type AuditTargetType = z.infer<typeof auditTargetTypeEnum>;
