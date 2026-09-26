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

/**
 * True only for a key of the exact shape {@link buildDocumentKey} produces:
 * `documents/<uuid>/<single safe segment>`. `documents.create` uses this to
 * refuse a metadata row pointing at any other object (e.g. a site photo, which
 * would otherwise become downloadable through /api/media/[id]).
 */
export function isDocumentKey(key: string): boolean {
  const parts = key.split('/');
  if (parts.length !== 3) return false;
  const [ns, id, name] = parts as [string, string, string];
  return (
    ns === 'documents' &&
    UUID_RE.test(id) &&
    name.length > 0 &&
    !name.startsWith('.') &&
    !name.includes('\\') &&
    stripControlChars(name) === name
  );
}

// ─────────────────────────── Site photos (D-28) ───────────────────────────

/** Image extensions a site photo may be stored under (derived from MIME, never a filename). */
export const PHOTO_EXTENSIONS = ['jpg', 'png', 'heic'] as const;
export type PhotoExtension = (typeof PHOTO_EXTENSIONS)[number];

/** Canonical 8-4-4-4-12 hex UUID (any version); the whole string must match. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build the storage key for a site photo: `photos/<clientId>/photo.<ext>`.
 *
 * `clientId` is the idempotency key the mobile outbox mints, so it is
 * attacker-influenced: anything that is not a canonical UUID is REJECTED
 * (throws) — never sanitised — which makes traversal or namespace escape
 * impossible. The key is deterministic so a retried upload overwrites the same
 * object (idempotent).
 */
export function buildPhotoKey(clientId: string, ext: PhotoExtension): string {
  if (!UUID_RE.test(clientId)) {
    throw new Error('Invalid photo clientId: must be a UUID.');
  }
  if (!(PHOTO_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error('Invalid photo extension.');
  }
  return `photos/${clientId.toLowerCase()}/photo.${ext}`;
}

/**
 * True only when `key` is exactly the photo key for `clientId` under one of the
 * allowed extensions. Used to refuse a metadata commit that points at an object
 * the caller did not upload under its own clientId. Never throws.
 */
export function isValidPhotoKey(key: string, clientId: string): boolean {
  if (!UUID_RE.test(clientId)) return false;
  return PHOTO_EXTENSIONS.some((ext) => buildPhotoKey(clientId, ext) === key);
}
