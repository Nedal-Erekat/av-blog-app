'use client';

import type { LoginInput, RegisterInput } from '@av-blog/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';
import type { PublicUser } from '@/lib/types';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ user: PublicUser }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiClient.post<{ user: PublicUser }>('/api/auth/login', input);
    setUser(res.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await apiClient.post<{ user: PublicUser }>('/api/auth/register', input);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await apiClient.post('/api/auth/logout');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
