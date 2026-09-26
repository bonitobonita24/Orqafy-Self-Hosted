// NATIVE binding of the pure UUID generator (./uuid) to expo-crypto's CSPRNG.
// Typecheck-only here — never imported by vitest.
//
// expo-crypto SDK 54: `randomUUID(): string` returns an RFC-4122 v4 UUID from
// the platform CSPRNG (docs: expo/expo sdk-54 docs/pages/.../sdk/crypto.mdx).
import * as Crypto from 'expo-crypto';

import { createUuidGenerator } from './uuid';

/** A fresh, unguessable RFC-4122 v4 UUID (lowercase). See ./uuid for why. */
export const newUuid: () => string = createUuidGenerator(Crypto.randomUUID);
