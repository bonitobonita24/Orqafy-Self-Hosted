// App-wide auth state (chunk 3b).
//
// Exposes the signed-in user, a loading flag for the initial token-hydrate, the
// current tRPC client (authed when a token is present), and sign-in/out actions.
// The client is REBUILT (never mutated) on every token change because
// `createOrqafyClient` captures its headers at creation — see api/client.ts.
//
// Dependency-light by design (React only). Login-screen UI is chunk 5; this only
// makes `useAuth` available app-wide.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { OrqafyApiClient } from '@orqafy/api-client';

import { createAuthedClient } from '@/api/client';
import { clearToken, getToken } from '@/auth/token-store';
import { login as loginRequest, logout as logoutRequest, type AuthUser } from '@/auth/auth';

interface AuthContextValue {
  /** The signed-in user, or `null` when signed out. */
  user: AuthUser | null;
  /** True until the initial persisted-token hydrate completes. */
  loading: boolean;
  /** Authenticate, persist the token, and rebuild the client. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Clear the token and rebuild an unauthenticated client. */
  signOut: () => Promise<void>;
  /** The current tRPC client (carries the bearer header when authed). */
  client: OrqafyApiClient;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Start unauthenticated; the mount effect upgrades this if a token exists.
  const [client, setClient] = useState<OrqafyApiClient>(() => createAuthedClient(null));

  // On mount: read the stored token; if present, build an authed client and
  // confirm it by hydrating the user via auth.me. A failure (e.g. expired token)
  // clears the token and falls back to signed-out.
  useEffect(() => {
    let active = true;

    const hydrate = async (): Promise<void> => {
      const token = await getToken();
      if (token === null) {
        return;
      }
      const authed = createAuthedClient(token);
      try {
        const me = await authed.auth.me.query();
        if (!active) {
          return;
        }
        setClient(authed);
        setUser({ id: me.id, name: me.name ?? '', email: me.email ?? '' });
      } catch {
        await clearToken();
        if (!active) {
          return;
        }
        setUser(null);
      }
    };

    void hydrate().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const nextUser = await loginRequest(email, password);
    const token = await getToken();
    setClient(createAuthedClient(token));
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await logoutRequest();
    setClient(createAuthedClient(null));
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signOut, client }),
    [user, loading, signIn, signOut, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
