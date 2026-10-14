import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, post, setAuthToken, setUnauthorizedHandler } from './api';
import { tokenStorage } from './tokenStorage';
import type { AuthResponse, Me } from './types';

type Status = 'loading' | 'offline' | 'signedOut' | 'signedIn';

type AuthValue = {
  status: Status;
  me: Me | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setMe: (me: Me) => void;
  retry: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMeState] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await tokenStorage.clear();
    queryClient.clear();
    setMeState(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore the saved session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStorage.get();
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setAuthToken(token);
      try {
        const current = await api<Me>('/me');
        if (cancelled) return;
        setMeState(current);
        setStatus('signedIn');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          await signOut();
        } else {
          setError(e instanceof Error ? e.message : 'Unable to connect.');
          setStatus('offline');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, signOut]);

  const finish = useCallback(
    async (res: AuthResponse) => {
      setAuthToken(res.access_token);
      await tokenStorage.set(res.access_token);
      queryClient.clear();
      setMeState(res.me);
      setStatus('signedIn');
    },
    [queryClient],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      error,
      signIn: async (email, password) => finish(await post<AuthResponse>('/auth/login', { email, password })),
      register: async (full_name, email, password) =>
        finish(await post<AuthResponse>('/auth/register', { full_name, email, password })),
      signOut,
      setMe: (next) => {
        setMeState(next);
        setStatus('signedIn');
      },
      retry: () => {
        setError(null);
        setStatus('loading');
        setAttempt((n) => n + 1);
      },
    }),
    [status, me, error, finish, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
