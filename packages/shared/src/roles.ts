// Canonical role→permission grants (D-17) — the SINGLE source of truth consumed
// by BOTH the web first-run (apps/web setup.ts, via apps/web server/roles.ts)
// AND the db seed (packages/db prisma/seed.ts). Before ORQ-27 each side carried
// its own copy and they drifted (project_manager / accountant); this module ends
// that split. These are operator-CUSTOMISABLE starting grants — an install can
// re-grant afterwards. Finance visibility is a PERMISSION (view_finances /
// manage_finances), never role-wired beyond these sensible defaults.
import type { Permission, SystemRole } from './enums';
import { permissionEnum } from './enums';

/** Every assignable permission — the owner_admin (full) grant set. */
export const ALL_PERMISSIONS: Permission[] = [...permissionEnum.options];

/** Default permission grants per predefined role (operator-customisable after). */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  owner_admin: [...ALL_PERMISSIONS],
  project_manager: ['create_project', 'view_all_projects', 'manage_files', 'export_data', 'upload_photo'],
  // D-28: field staff may attach photos to tasks ASSIGNED to them (enforced per call).
  field_staff: ['upload_photo'],
  accountant: ['view_finances', 'manage_finances', 'export_data', 'manage_files'],
  client: [],
};

/** Human-facing labels for the predefined roles. */
export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = {
  owner_admin: 'Owner / Admin',
  project_manager: 'Project Manager',
  field_staff: 'Field Staff',
  accountant: 'Accountant',
  client: 'Client',
};

/** Canonical seed/display order for the predefined roles. */
export const SYSTEM_ROLE_ORDER: SystemRole[] = [
  'owner_admin',
  'project_manager',
  'field_staff',
  'accountant',
  'client',
];
