// RBAC resolution (D-17). A user's effective permissions =
//   (role group permissions) ∪ (custom group permissions)
//   then per-user overrides applied last (granted=true adds, granted=false revokes).
// Finance visibility et al. are permissions here, never role-hardwired (D-17).
import 'server-only';
import type { Permission, PermissionGroup, UserPermissionOverride } from '@orqafy/db';
import { prisma } from '@orqafy/db';

/** Minimal client shape `resolveUserPermissions` needs — satisfied by `prisma` or `ctx.prisma`. */
export interface PermissionsDb {
  user: {
    findUnique(args: {
      where: { id: string };
      include: { role: true; groups: true; overrides: true };
    }): Promise<{
      role: PermissionGroup;
      groups: PermissionGroup[];
      overrides: UserPermissionOverride[];
    } | null>;
  };
}

/**
 * Pure resolution step: role ∪ groups, then per-user overrides applied last
 * (granted=true adds, granted=false revokes). Takes an already-fetched user —
 * no DB access — so callers that already hold `{ role, groups, overrides }`
 * (e.g. a last-admin guard checking several users) never re-query for it.
 */
export function computeEffectivePermissions(user: {
  role: PermissionGroup;
  groups: PermissionGroup[];
  overrides: UserPermissionOverride[];
}): Set<Permission> {
  const effective = new Set<Permission>();
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

/**
 * Resolve the effective permission set for a user, fresh from the DB.
 * `db` defaults to the global `prisma` import; pass `ctx.prisma` to run
 * against a per-request/test-mockable client instead.
 */
export async function resolveUserPermissions(
  userId: string,
  db: PermissionsDb = prisma,
): Promise<Set<Permission>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: true, groups: true, overrides: true },
  });
  if (user === null) return new Set<Permission>();
  return computeEffectivePermissions(user);
}

/** True when every required permission is present in the set. */
export function hasAllPermissions(
  granted: ReadonlySet<Permission>,
  required: readonly Permission[],
): boolean {
  return required.every((p) => granted.has(p));
}
