import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';
import { milestoneStatusEnum, signOffStatusEnum } from '../enums';

/** A project checkpoint; client sign-off is a v2 flow (signOff* fields). */
export const milestoneSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: nonEmptyString,
  targetDate: z.date().optional(),
  status: milestoneStatusEnum.default('pending'),
  signOffStatus: signOffStatusEnum.default('pending'),
  signedOffBy: idSchema.optional(),
  signedOffAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Milestone = z.infer<typeof milestoneSchema>;
