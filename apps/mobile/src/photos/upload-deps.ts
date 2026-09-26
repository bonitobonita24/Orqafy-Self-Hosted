// Device implementation of `PhotoUploadDeps` (D-28). NATIVE (expo-file-system,
// expo-secure-store via the token store): typecheck-only, loaded lazily by the
// outbox runtime's `drain` so the pure offline barrel never pulls native code.
import { File } from 'expo-file-system';

import { getToken } from '@/auth/token-store';
import { API_URL } from '@/config';
import type { FormDataLike, PhotoUploadDeps, UploadFetch } from '@/offline/photo';

export function createPhotoUploadDeps(): PhotoUploadDeps {
  return {
    apiUrl: API_URL,
    getToken,
    // RN's global fetch accepts RN FormData (file parts as { uri, name, type }).
    fetch: ((url, init) =>
      fetch(url, init as unknown as RequestInit)) as UploadFetch,
    createFormData: () => new FormData() as unknown as FormDataLike,
    // expo-file-system's new File API is synchronous; wrap to the async seam.
    fileExists: (uri) => Promise.resolve(new File(uri).exists),
    deleteFile: (uri) =>
      new Promise<void>((resolve) => {
        new File(uri).delete(); // throws -> rejects the promise
        resolve();
      }),
  };
}
