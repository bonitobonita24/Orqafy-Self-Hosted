// UUID minting for outbox clientIds and local photo filenames. PURE module.
//
// SECURITY: an outbox clientId is a capability key, not just an idempotency
// token. The server's photo-overwrite protection (F1, D-28) treats a known
// clientId as the right to re-submit that photo row, so ids MUST be
// unguessable. The generator therefore takes an injected CSPRNG source
// (expo-crypto `randomUUID`, wired in ./uuid-native) and has NO weak fallback:
// with no source it throws rather than silently degrading.
//
// The native import lives in ./uuid-native so this module stays importable by
// vitest (same split as runtime.ts's lazy native imports).

/** A CSPRNG-backed RFC-4122 v4 UUID source (e.g. expo-crypto `randomUUID`). */
export type UuidSource = () => string;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Build a UUID generator over a CSPRNG source. Output is normalized to
 * lowercase (iOS NSUUID yields uppercase) and must match RFC-4122 v4, which the
 * server's zod `.uuid()` accepts. Throws if no source is provided.
 */
export function createUuidGenerator(source: UuidSource | undefined): () => string {
  if (typeof source !== 'function') {
    throw new Error('No CSPRNG UUID source available; refusing to mint a guessable clientId');
  }
  return () => {
    const id = source().toLowerCase();
    if (!UUID_V4.test(id)) {
      throw new Error('CSPRNG source did not return an RFC-4122 v4 UUID');
    }
    return id;
  };
}
