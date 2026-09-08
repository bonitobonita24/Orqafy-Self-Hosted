import { z } from 'zod';
import { idSchema } from '../primitives';

/** A user's per-type, per-year leave accounting. */
export const leaveBalanceSchema = z.object({
  id: idSchema,
  userId: idSchema,
  leaveTypeId: idSchema,
  year: z.number().int(),
  entitled: z.number().nonnegative(),
  used: z.number().nonnegative(),
  remaining: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
