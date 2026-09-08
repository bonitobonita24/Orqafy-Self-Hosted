import { z } from 'zod';
import { idSchema, emailSchema, nonEmptyString } from '../primitives';

/** A staff account within the one organisation. */
export const userSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  email: emailSchema,
  passwordHash: z.string(),
  roleId: idSchema, // reference to a role record (system PermissionGroup seed, Part 3)
  groupIds: z.array(idSchema).default([]),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof userSchema>;

/** User safe for API/UI exposure — never leaks the password hash. */
export const publicUserSchema = userSchema.omit({ passwordHash: true });
export type PublicUser = z.infer<typeof publicUserSchema>;
