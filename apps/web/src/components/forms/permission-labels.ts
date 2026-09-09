// Human-readable labels for the 10 permission atoms (permissionEnum). Shared by
// the custom-group builder and the per-user override editor (D-17) so the two
// surfaces never drift. Keyed by the canonical underscore `Permission` values.
import type { Permission } from '@orqafy/shared';

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: 'Manage users',
  configure_server: 'Configure server',
  create_project: 'Create projects',
  view_finances: 'View finances',
  manage_finances: 'Manage finances',
  approve_leave: 'Approve leave',
  manage_files: 'Manage files',
  view_all_projects: 'View all projects',
  export_data: 'Export data',
  view_audit_log: 'View audit log',
};

/**
 * Label for a permission key. Accepts a plain string (the API's
 * `roles.permissions` returns `string[]`) and falls back to the raw key so a
 * newly-added atom without a label still renders legibly.
 */
export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission as Permission] ?? permission;
}
