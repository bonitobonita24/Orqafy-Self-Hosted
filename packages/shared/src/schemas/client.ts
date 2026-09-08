import { z } from 'zod';
import { idSchema, emailSchema, nonEmptyString } from '../primitives';

/** An external client the firm runs projects for. */
export const clientSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  contactPerson: z.string().optional(),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Client = z.infer<typeof clientSchema>;
