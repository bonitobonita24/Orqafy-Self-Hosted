import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';
import { projectStatusEnum } from '../enums';

/** A project under a client; tasks roll their progress up to `progressPct`. */
export const projectSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  code: nonEmptyString,
  clientId: idSchema,
  status: projectStatusEnum,
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
  description: z.string().optional(),
  progressPct: z.number().int().min(0).max(100).default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof projectSchema>;
