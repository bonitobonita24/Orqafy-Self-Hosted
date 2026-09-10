// Auth flows for the mobile app (chunk 3b).
//
// `login` hits the chunk-3a bearer endpoint (POST {API_URL}/api/mobile/login),
// stores the returned token in SecureStore, and returns the safe user. All
// network/JSON handling is defensive: a 401 is a typed credential failure, any
// other fault collapses to a generic AuthError so callers never see a raw fetch
// rejection. NATIVE via token-store — typecheck-only here.
import { MOBILE_LOGIN_URL } from '@/config';

import { clearToken, saveToken } from './token-store';

/** The safe, non-sensitive user identity carried by the session. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/** Typed auth failure — distinguishes bad credentials from transport faults. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Server response shape for a successful login (chunk 3a). */
interface LoginResponse {
  token: string;
  user: AuthUser;
}

/**
 * Authenticate and persist the session token.
 * @throws {AuthError} `'Invalid credentials'` on 401, `'Login failed'` otherwise.
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(MOBILE_LOGIN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new AuthError('Login failed');
  }

  if (res.status === 401) {
    throw new AuthError('Invalid credentials');
  }
  if (!res.ok) {
    throw new AuthError('Login failed');
  }

  let data: LoginResponse;
  try {
    data = (await res.json()) as LoginResponse;
  } catch {
    throw new AuthError('Login failed');
  }

  if (typeof data.token !== 'string' || data.token.length === 0) {
    throw new AuthError('Login failed');
  }

  await saveToken(data.token);
  return data.user;
}

/** Clear the persisted session token. */
export async function logout(): Promise<void> {
  await clearToken();
}
