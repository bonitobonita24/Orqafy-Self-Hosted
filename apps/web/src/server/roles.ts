// System-role seed identities (D-17). Predefined roles are seeded as `isSystem`
// PermissionGroups keyed by `systemKey`. engineer & architect both collapse into
// project_manager (D-17). Finance visibility is a PERMISSION, never role-wired —
// these are only the sensible starting grants the operator can then customise.
//
// ORQ-27: these grants are now the ONE canonical source in @orqafy/shared,
// consumed by both this web first-run path (setup.ts) AND the db seed. This file
// only re-exports them so existing `./roles` imports keep working — never keep a
// duplicate literal copy here (that copy was the seed↔first-run drift).
export {
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLE_ORDER,
  ALL_PERMISSIONS,
} from '@orqafy/shared';
