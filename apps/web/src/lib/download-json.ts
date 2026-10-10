// Client-side "download this JSON" helper (DPA W9 — self-service data export).
// Split into pure logic (filename + serialization, unit-testable without a
// DOM) and a DOM-touching trigger (Blob + object URL + synthetic <a> click).
// Reused by the account-menu "Download my data" action and, per the task
// brief, intended for the future admin user-actions export too.

/** `<prefix>-YYYY-MM-DD.json` — zero-padded, UTC-stable (no locale drift). */
export function buildExportFilename(prefix: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${prefix}-${yyyy}-${mm}-${dd}.json`;
}

/** Pretty-printed JSON — `JSON.stringify` already ISO-serializes `Date`s. */
export function toPrettyJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Triggers a browser download of `data` as a pretty-printed JSON file.
 * DOM-only (Blob/URL/anchor) — not exercised by the node-environment test
 * suite; `buildExportFilename`/`toPrettyJson` above carry the unit coverage.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([toPrettyJson(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
