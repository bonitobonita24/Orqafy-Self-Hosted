import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';

/** A configurable leave category (vacation/sick/emergency/…). */
export const leaveTypeSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  defaultDaysPerYear: z.number().int().nonnegative().default(0),
  isPaid: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type LeaveType = z.infer<typeof leaveTypeSchema>;
