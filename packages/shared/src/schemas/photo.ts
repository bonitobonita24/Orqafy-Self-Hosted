import { z } from 'zod';
import { idSchema } from '../primitives';

/** A site photo captured against a task or milestone; bytes live in storage. */
export const photoSchema = z.object({
  id: idSchema,
  storageKey: z.string(),
  taskId: idSchema.optional(),
  milestoneId: idSchema.optional(),
  capturedBy: idSchema,
  capturedAt: z.date(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  createdAt: z.date(),
});
export type Photo = z.infer<typeof photoSchema>;
