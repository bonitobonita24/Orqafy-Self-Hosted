// System-role seed identities (D-17). Predefined roles are seeded as `isSystem`
// PermissionGroups keyed by `systemKey`. engineer & architect both collapse into
// project_manager (D-17). Finance visibility is a PERMISSION, never role-wired —
// these are only the sensible starting grants the operator can then customise.
import type { Permission, SystemRole } from '@orqafy/shared';

export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = {
  owner_admin: 'Owner / Admin',
  project_manager: 'Project Manager',
  field_staff: 'Field Staff',
  accountant: 'Accountant',
  client: 'Client',
};

const ALL_PERMISSIONS: Permission[] = [
  'manage_users',
  'configure_server',
  'create_project',
  'view_finances',
  'manage_finances',
  'approve_leave',
  'manage_files',
  'view_all_projects',
  'export_data',
  'view_audit_log',
  'upload_photo',
];

/** Default permission grants per predefined role (operator-customisable after). */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  owner_admin: [...ALL_PERMISSIONS],
  project_manager: ['create_project', 'view_all_projects', 'manage_files', 'export_data', 'upload_photo'],
  // D-28: field staff may attach photos to tasks ASSIGNED to them (enforced per call).
  field_staff: ['upload_photo'],
  accountant: ['view_finances', 'manage_finances', 'export_data', 'manage_files'],
  client: [],
};

export const SYSTEM_ROLE_ORDER: SystemRole[] = [
  'owner_admin',
  'project_manager',
  'field_staff',
  'accountant',
  'client',
];
