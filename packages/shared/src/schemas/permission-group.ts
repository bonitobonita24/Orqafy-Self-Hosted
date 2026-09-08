import { z } from 'zod';
import { idSchema, nonEmptyString } from '../primitives';
import { permissionEnum } from '../enums';

/**
 * A named bundle of permissions. Predefined roles seed `isSystem` groups;
 * the operator composes custom groups from the same permission set.
 */
export const permissionGroupSchema = z.object({
  id: idSchema,
  name: nonEmptyString,
  permissions: z.array(permissionEnum).default([]),
  isSystem: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PermissionGroup = z.infer<typeof permissionGroupSchema>;
