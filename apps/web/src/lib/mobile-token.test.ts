import { beforeAll, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { signMobileToken, verifyMobileToken } from './mobile-token';

const SECRET = 'test-secret-at-least-32-bytes-of-entropy-xxxxx';
const OTHER_SECRET = 'a-completely-different-secret-value-yyyyyyyyyyy';

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

describe('mobile-token', () => {
  it('round-trips a signed token back to the userId', async () => {
    const token = await signMobileToken('user-123');
    expect(await verifyMobileToken(token)).toBe('user-123');
  });

  it('rejects a token signed with a DIFFERENT secret → null', async () => {
    const foreign = await new SignJWT({ typ: 'mobile' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuedAt()
      .setExpirationTime('60d')
      .sign(new TextEncoder().encode(OTHER_SECRET));
    expect(await verifyMobileToken(foreign)).toBeNull();
  });

  it('rejects an expired token → null', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ typ: 'mobile' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuedAt(nowSec - 120)
      .setExpirationTime(nowSec - 60) // exp in the past
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyMobileToken(expired)).toBeNull();
  });

  it('rejects a token whose typ !== "mobile" → null', async () => {
    const wrongTyp = await new SignJWT({ typ: 'web' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuedAt()
      .setExpirationTime('60d')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyMobileToken(wrongTyp)).toBeNull();
  });

  it('rejects an unsigned alg:none token (algorithm-stripping) → null', async () => {
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ typ: 'mobile', sub: 'user-123' }));
    const unsigned = `${header}.${payload}.`;
    expect(await verifyMobileToken(unsigned)).toBeNull();
  });

  it('rejects an HS-tampered token (payload swapped after signing) → null', async () => {
    const token = await signMobileToken('user-123');
    const parts = token.split('.');
    const head = parts[0] ?? '';
    const sig = parts[2] ?? '';
    const forgedPayload = b64url(JSON.stringify({ typ: 'mobile', sub: 'attacker' }));
    const tampered = `${head}.${forgedPayload}.${sig}`;
    expect(await verifyMobileToken(tampered)).toBeNull();
  });

  it('returns null for a malformed token instead of throwing', async () => {
    expect(await verifyMobileToken('not-a-jwt')).toBeNull();
  });
});
