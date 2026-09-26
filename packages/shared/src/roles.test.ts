// ORQ-27 drift tripwire. The db seed (packages/db prisma/seed.ts) and the web
// first-run (apps/web setup.ts) BOTH consume this module for their default
// role→permission grants, so this test is what stops the two consumers from
// silently drifting apart again. (c) locks the intended grants verbatim.
import { describe, expect, it } from 'vitest';

import { permissionEnum, systemRoleEnum, type Permission, type SystemRole } from './enums';
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLE_ORDER,
  SYSTEM_ROLE_PERMISSIONS,
} from './roles';

/** The intended grants, spelled out so a change to either consumer's default
 *  must be a deliberate edit here (regression guard). */
const EXPECTED_GRANTS: Record<SystemRole, Permission[]> = {
  owner_admin: [...permissionEnum.options],
  project_manager: ['create_project', 'view_all_projects', 'manage_files', 'export_data', 'upload_photo'],
  field_staff: ['upload_photo'],
  accountant: ['view_finances', 'manage_finances', 'export_data', 'manage_files'],
  client: [],
};

describe('canonical system-role grants (ORQ-27)', () => {
  it('(a) has exactly the keys of systemRoleEnum — completeness, no extras', () => {
    expect(Object.keys(SYSTEM_ROLE_PERMISSIONS).sort()).toEqual([...systemRoleEnum.options].sort());
  });

  it('(b) every granted permission is a valid permissionEnum member', () => {
    const valid = new Set<string>(permissionEnum.options);
    for (const [role, perms] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(valid.has(p), `${role} → ${p}`).toBe(true);
      }
    }
  });

  it('(c) deep-equals the explicit expected grant map (drift lock)', () => {
    expect(SYSTEM_ROLE_PERMISSIONS).toEqual(EXPECTED_GRANTS);
  });

  it('(d) owner_admin holds every permission (ALL_PERMISSIONS)', () => {
    expect(ALL_PERMISSIONS).toEqual([...permissionEnum.options]);
    expect(SYSTEM_ROLE_PERMISSIONS.owner_admin).toEqual(ALL_PERMISSIONS);
  });

  it('(e) SYSTEM_ROLE_ORDER and SYSTEM_ROLE_LABEL cover exactly systemRoleEnum', () => {
    const roles = [...systemRoleEnum.options].sort();
    expect([...SYSTEM_ROLE_ORDER].sort()).toEqual(roles);
    expect(Object.keys(SYSTEM_ROLE_LABEL).sort()).toEqual(roles);
  });
});
