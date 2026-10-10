// Pure gate for the admin "erase user" AlertDialog (DPA W8): the destructive
// action only enables once the admin has typed the target's email EXACTLY.
// Trims surrounding whitespace only (a trailing space from autocomplete/paste
// shouldn't block the match) — case is NOT normalized, since stored emails
// are already canonicalized lowercase on create (`users.ts#create`).

/** Whether `typedEmail` exactly matches `targetEmail` (trimmed, case-sensitive). */
export function canConfirmErase(typedEmail: string, targetEmail: string): boolean {
  return typedEmail.trim() === targetEmail;
}
