// UUID minting for outbox clientIds and local photo filenames. PURE module.
//
// `expo-crypto` is not a dependency, so prefer `globalThis.crypto.randomUUID()`
// when the runtime exposes it and fall back to a Math.random RFC-4122 v4
// generator (Hermes may lack `crypto`). The value is an idempotency key / file
// name, not a secret, so the fallback's lack of cryptographic strength is fine.
// Both paths yield a v4-shaped UUID that the server's zod `.uuid()` accepts.

/** A fresh RFC-4122 v4 UUID. */
export function newUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
