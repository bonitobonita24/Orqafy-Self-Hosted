import { z } from 'zod';
import { idSchema } from '../primitives';
import { notificationTypeEnum } from '../enums';

/** A per-user notification; `payload` shape is per-type (structured record). */
export const notificationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  type: notificationTypeEnum,
  payload: z.record(z.string(), z.unknown()).default({}),
  isRead: z.boolean().default(false),
  createdAt: z.date(),
});
export type Notification = z.infer<typeof notificationSchema>;
