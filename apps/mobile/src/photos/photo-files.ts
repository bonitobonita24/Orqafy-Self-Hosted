// Native helper: enumerate the durable photo dir for the outbox orphan sweep
// (D-28 hygiene, ORQ-28). NATIVE (expo-file-system): typecheck-only here — loaded
// lazily by the outbox runtime's `drain`, never by vitest or the pure offline
// barrel (mirrors ../photos/upload-deps.ts and ../photos/capture.ts).
//
// expo-file-system SDK 54: the package root exports the NEW object API
// (`Directory` / `File` / `Paths`). Listing + modification time back the pure
// `orphanPhotoFiles` diff in `@/offline` (which owns the reference/age logic).
import { Directory, File, Paths } from 'expo-file-system';

/** A durable photo file: its `file://` uri and last-modified epoch ms. */
export interface PhotoFileInfo {
  path: string;
  modifiedAt: number;
}

/**
 * List `<documents>/photos` as `{ path, modifiedAt }`. Files with an unknown
 * modification time are reported as `modifiedAt: 0` (epoch) so the age guard treats
 * them as old — an unreferenced, timestamp-less file is a safe delete candidate.
 * Returns `[]` on any error (dir absent, no access) — best-effort, never throws.
 */
export function listPhotoFiles(): PhotoFileInfo[] {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) return [];
    const out: PhotoFileInfo[] = [];
    for (const entry of dir.list()) {
      if (entry instanceof File) {
        out.push({ path: entry.uri, modifiedAt: entry.modificationTime ?? 0 });
      }
    }
    return out;
  } catch {
    return [];
  }
}
