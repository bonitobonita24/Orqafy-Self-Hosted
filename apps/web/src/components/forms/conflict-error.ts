// ORQ-33: friendly mapping for a `documents.create` CONFLICT.
//
// Since ORQ-26 the server `documents.create` mutation throws a tRPC error with
// code 'CONFLICT' when a storageKey is already committed (and on a racing Prisma
// P2002 for the same key). The raw server text is terse and non-actionable, so
// the Files upload form remaps a CONFLICT to clear guidance and lets the user
// re-upload a fresh file. Kept as a pure seam (no React) so it is unit-testable
// without rendering the dialog. Every OTHER error falls back to the form's
// existing generic handling.

/** User-facing guidance shown after a document-create CONFLICT. */
export const FILE_CONFLICT_MESSAGE =
  'This file was already uploaded. Please choose the file again to retry.';

/**
 * True when `error` is a tRPC CONFLICT (an already-committed storageKey). Reads
 * the tRPC client error shape `error.data.code`; tolerant of null/undefined and
 * of non-error values (returns false), so callers can pass a caught `unknown`.
 */
export function isConflictError(error: unknown): boolean {
  const code = (error as { data?: { code?: string | null } | null } | null | undefined)?.data
    ?.code;
  return code === 'CONFLICT';
}

/**
 * Friendly, actionable message for a document-create error, or null to signal
 * the caller should keep its generic handling. Only CONFLICT is remapped.
 */
export function conflictMessage(error: unknown): string | null {
  return isConflictError(error) ? FILE_CONFLICT_MESSAGE : null;
}
