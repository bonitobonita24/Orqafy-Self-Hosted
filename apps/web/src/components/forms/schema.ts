// Client-side form schemas for the create/edit dialogs. These are BOUND to the
// canonical @orqafy/shared entity schemas (via .omit/.extend) so the UI validates
// against the same field rules as the API — the divergences are deliberate and
// documented:
//
//  * Status enums use the PRISMA-NATIVE underscore values (`on_hold`,
//    `in_progress`) because the tRPC mutations validate against
//    `z.nativeEnum(ProjectStatus|TaskStatus)` — NOT the hyphenated
//    `@orqafy/shared` string enums (those are the DB @map source form). Sending a
//    hyphenated value would be rejected server-side.
//  * Date / geofence-coordinate fields are typed as strings here (the shape the
//    native <input type="date|datetime-local|number"> produces); the dialogs
//    convert them to Date / number just before calling the mutation.
import { z } from 'zod';
import {
  clientSchema,
  projectSchema,
  taskSchema,
  taskPriorityEnum,
  documentSchema,
  type RetentionCategory,
} from '@orqafy/shared';

// ── Client ────────────────────────────────────────────────────────────────
export const clientFormSchema = clientSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Allow an empty string (blank optional field) OR a valid email.
    email: z.union([z.string().email('Enter a valid email address'), z.literal('')]).optional(),
  });
export type ClientFormValues = z.infer<typeof clientFormSchema>;

// ── Project ───────────────────────────────────────────────────────────────
// Prisma-native ProjectStatus values (underscore) — the tRPC contract form.
const projectStatusValues = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;
const PROJECT_STATUS_LABEL: Record<(typeof projectStatusValues)[number], string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const PROJECT_STATUS = projectStatusValues.map((value) => ({
  value,
  label: PROJECT_STATUS_LABEL[value],
}));

export const projectFormSchema = projectSchema
  .omit({ id: true, createdAt: true, updatedAt: true, progressPct: true })
  .extend({
    status: z.enum(projectStatusValues),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
  });
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ── Task ──────────────────────────────────────────────────────────────────
// Prisma-native TaskStatus values (underscore) — the tRPC contract form.
const taskStatusValues = ['todo', 'in_progress', 'blocked', 'done'] as const;
const TASK_STATUS_LABEL: Record<(typeof taskStatusValues)[number], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};
export const TASK_STATUS = taskStatusValues.map((value) => ({
  value,
  label: TASK_STATUS_LABEL[value],
}));

export const TASK_PRIORITY = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export const taskFormSchema = taskSchema
  .omit({
    id: true,
    projectId: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
    location: true,
    geofenceActiveFrom: true,
    geofenceActiveUntil: true,
  })
  .extend({
    status: z.enum(taskStatusValues),
    priority: taskPriorityEnum,
    assigneeId: z.string().optional(),
    dueDate: z.string().optional(),
    // Geofence anchor (D-19) — optional, but all three coordinates are required
    // together. Cross-field validation is enforced in the dialog's submit path.
    geofenceLat: z.string().optional(),
    geofenceLng: z.string().optional(),
    geofenceRadius: z.string().optional(),
    geofenceActiveFrom: z.string().optional(),
    geofenceActiveUntil: z.string().optional(),
  });
export type TaskFormValues = z.infer<typeof taskFormSchema>;

// ── Milestone ───────────────────────────────────────────────────────────────
// Prisma-native MilestoneStatus values (underscore) — the tRPC contract form.
const milestoneStatusValues = ['pending', 'in_progress', 'completed'] as const;
const MILESTONE_STATUS_LABEL: Record<(typeof milestoneStatusValues)[number], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};
export const MILESTONE_STATUS = milestoneStatusValues.map((value) => ({
  value,
  label: MILESTONE_STATUS_LABEL[value],
}));

export const milestoneFormSchema = z.object({
  title: z.string().min(1, 'A title is required'),
  status: z.enum(milestoneStatusValues),
  targetDate: z.string().optional(),
});
export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

// ── Leave request (D-21) ─────────────────────────────────────────────────────
// `reason` is optional and must never require health detail (SPI minimisation,
// PH DPA). Dates are strings from <input type="date">, converted before submit.
export const leaveFormSchema = z.object({
  leaveTypeId: z.string().min(1, 'Select a leave type'),
  startDate: z.string().min(1, 'A start date is required'),
  endDate: z.string().min(1, 'An end date is required'),
  reason: z.string().optional(),
});
export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

// ── User (D-17 — role assignment only; the permission-builder editor is a later
// chunk). `password` is create-only and required in the dialog (min 8, enforced
// there so edit mode can omit it). `isActive` is edit-only.
export const userFormSchema = z.object({
  name: z.string().min(1, 'A name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().optional(),
  roleId: z.string().min(1, 'Assign a role'),
  phone: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
export type UserFormValues = z.infer<typeof userFormSchema>;

// ── Permission group (D-17 — custom-group builder) ────────────────────────────
// `permissions` is a plain string[] here (the shape RHF collects from a grid of
// same-name checkboxes). The atoms match `permissionEnum`, so the tRPC mutation
// (`z.array(permissionEnum)`) accepts them; the dialog narrows the cast on submit.
export const groupFormSchema = z.object({
  name: z.string().min(1, 'A name is required'),
  permissions: z.array(z.string()).default([]),
});
export type GroupFormValues = z.infer<typeof groupFormSchema>;

// ── Document (D-13) ───────────────────────────────────────────────────────
// METADATA-only shape: the /api/media upload response supplies storageKey/size/
// mimeType — never the user — so those server-owned fields are omitted here.
// `projectId`/`clientId` are optional Select values (blankToUndef on submit).
export const documentFormSchema = documentSchema
  .pick({ name: true, category: true, isSPI: true })
  .extend({
    projectId: z.string().optional(),
    clientId: z.string().optional(),
  });
export type DocumentFormValues = z.infer<typeof documentFormSchema>;

// ── Privacy / DPA settings (Settings → Privacy, Rule 33 / `.ai_prompt/privacy.md`) ──
// `retention` carries one string-per-category day count (native <input type="number">
// shape); '' means "not set" (no auto-deletion). `RETENTION_CATEGORIES` fixes the
// display order + human labels — kept here so the page and any future surface share
// one source. SPI/payroll entities are deliberately NOT a category (never
// auto-deleted); see packages/shared/src/schemas/privacy.ts.
const retentionDaysField = z
  .string()
  .regex(/^\d*$/, 'Enter a whole number of days, or leave blank');

export const privacyRetentionFormSchema = z.object({
  audit_log: retentionDaysField,
  notification: retentionDaysField,
  photo: retentionDaysField,
  document: retentionDaysField,
  completed_project: retentionDaysField,
  leave_request: retentionDaysField,
});

export const privacySettingsFormSchema = z.object({
  dpoName: z.string().max(200).optional(),
  dpoContact: z.string().max(200).optional(),
  retention: privacyRetentionFormSchema,
});
export type PrivacySettingsFormValues = z.infer<typeof privacySettingsFormSchema>;

export const RETENTION_CATEGORIES: ReadonlyArray<{ key: RetentionCategory; label: string }> = [
  { key: 'audit_log', label: 'Audit log' },
  { key: 'notification', label: 'Notifications' },
  { key: 'photo', label: 'Photos' },
  { key: 'document', label: 'Documents (non-sensitive)' },
  { key: 'completed_project', label: 'Completed projects' },
  { key: 'leave_request', label: 'Leave requests' },
];

// Confirms the fixed-field form above still covers every enum value (TS-time
// check only — an enum addition without a matching field here fails `tsc`).
const _retentionCategoryCoverage: Record<RetentionCategory, true> = {
  audit_log: true,
  notification: true,
  photo: true,
  document: true,
  completed_project: true,
  leave_request: true,
};
export const _assertRetentionCategoryCoverage = _retentionCategoryCoverage;

/** '' | undefined → undefined; otherwise a Date built from the input value. */
export function toDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === '') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Trim blank optional strings down to undefined so we never store "". */
export function blankToUndef(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}
