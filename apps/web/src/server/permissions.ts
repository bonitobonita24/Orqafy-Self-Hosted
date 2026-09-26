// RBAC resolution (D-17). A user's effective permissions =
//   (role group permissions) ∪ (custom group permissions)
//   then per-user overrides applied last (granted=true adds, granted=false revokes).
// Finance visibility et al. are permissions here, never role-hardwired (D-17).
import 'server-only';
import type { Permission } from '@orqafy/shared';
import { prisma } from '@orqafy/db';

/** Resolve the effective permission set for a user, fresh from the DB. */
export async function resolveUserPermissions(userId: string): Promise<Set<Permission>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, groups: true, overrides: true },
  });

  const effective = new Set<Permission>();
  if (user === null) return effective;

  for (const perm of user.role.permissions) effective.add(perm);
  for (const group of user.groups) {
    for (const perm of group.permissions) effective.add(perm);
  }
  for (const override of user.overrides) {
    const perm = override.permission;
    if (override.granted) effective.add(perm);
    else effective.delete(perm);
  }
  return effective;
}

/** True when every required permission is present in the set. */
export function hasAllPermissions(
  granted: ReadonlySet<Permission>,
  required: readonly Permission[],
): boolean {
  return required.every((p) => granted.has(p));
}
