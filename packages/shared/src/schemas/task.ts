import { z } from 'zod';
import { idSchema, nonEmptyString, locationSchema } from '../primitives';
import { taskStatusEnum, taskPriorityEnum } from '../enums';

/**
 * A unit of work on a project. The geofence fields (D-19) make it a "site task":
 * an on-device dwell inside `location.radiusMeters` on/after `geofenceActiveFrom`
 * fires the assignee's local notification. All geofence fields are optional — a
 * task without them is an ordinary board task.
 */
export const taskSchema = z.object({
  id: idSchema,
  title: nonEmptyString,
  description: z.string().optional(),
  projectId: idSchema,
  assigneeId: idSchema.optional(),
  status: taskStatusEnum,
  priority: taskPriorityEnum.default('medium'),
  dueDate: z.date().optional(),
  boardColumn: z.string().optional(),
  location: locationSchema.optional(),
  geofenceActiveFrom: z.date().optional(),
  geofenceActiveUntil: z.date().optional(),
  createdBy: idSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Task = z.infer<typeof taskSchema>;
