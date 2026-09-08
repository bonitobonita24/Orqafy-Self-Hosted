import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';

/** The single installing firm (D-5: single-company install, no tenant_id). */
export const organizationSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  address: z.string().optional(),
  logoKey: z.string().optional(), // storage key for the logo object (not the bytes)
  dpoName: z.string().optional(),
  dpoContact: z.string().optional(),
  // { entityOrCategory: days } retention configuration (DPA mechanism).
  retentionSettings: z.record(z.string(), z.number().int().nonnegative()).optional(),
  timezone: z.string().default('UTC'),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Organization = z.infer<typeof organizationSchema>;
