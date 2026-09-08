import { z } from 'zod';
import { idSchema } from '../primitives';
import { leaveRequestStatusEnum } from '../enums';

/**
 * A staff leave application (D-21). `reason` is optional and must not require
 * health detail (SPI minimisation, PH DPA).
 */
export const leaveRequestSchema = z.object({
  id: idSchema,
  userId: idSchema,
  leaveTypeId: idSchema,
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string().optional(),
  status: leaveRequestStatusEnum.default('pending'),
  approvedBy: idSchema.optional(),
  approvedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
