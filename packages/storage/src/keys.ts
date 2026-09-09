// Storage-key derivation for uploaded documents.
//
// The object key is the one value the upload path builds directly from an
// attacker-controlled filename, so it MUST be traversal-proof: no path
// separators, no `..`, no control characters, and never an empty or dot-only
// segment. Keys are namespaced under a random id so two uploads of the same
// filename never collide and the original name is preserved for download.

import { randomUUID } from 'node:crypto';

/** Max length of the human-readable name segment. */
const MAX_NAME_LEN = 128;

/** Used when the sanitised name reduces to nothing safe. */
const FALLBACK_NAME = 'file';

/** Drop C0 control chars (0x00–0x1F, incl. TAB/LF/CR) and DEL (0x7F). */
function stripControlChars(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) {
      out += ch;
    }
  }
  return out;
}

/**
 * Reduce an arbitrary user filename to a single safe path segment.
 * - keeps only the basename (defeats `../`, absolute paths, both separators)
 * - drops control characters (incl. TAB/LF/CR and DEL)
 * - collapses whitespace runs to a single `_`
 * - strips leading dots so the result can never be `.` / `..` / hidden-traversal
 * - caps the length
 * - falls back to {@link FALLBACK_NAME} if nothing safe survives
 */
export function sanitizeFilename(originalName: string): string {
  const basename = originalName.split(/[/\\]/).pop() ?? '';
  const cleaned = stripControlChars(basename)
    // defensively drop any residual separators
    .replace(/[/\\]/g, '')
    // collapse any whitespace run to a single underscore
    .replace(/\s+/g, '_')
    // strip leading dots — prevents `.`, `..`, and dot-hidden traversal
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_NAME_LEN);

  if (cleaned.length === 0 || cleaned === '.' || cleaned === '..') {
    return FALLBACK_NAME;
  }
  return cleaned;
}

/**
 * Build the storage key for a newly-uploaded document:
 * `documents/<random-id>/<sanitized-name>`.
 *
 * The random id namespaces every upload so identical filenames never overwrite
 * each other, and the sanitised name keeps the download filename recognisable.
 */
export function buildDocumentKey(originalName: string): string {
  const id = randomUUID();
  return `documents/${id}/${sanitizeFilename(originalName)}`;
}
