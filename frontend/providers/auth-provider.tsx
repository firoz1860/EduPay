'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, tokenStore, ApiError } from '@/lib/api';
import type { AuthUser, UserRole } from '@/types';

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (input: RegisterInput) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_KEY = 'edupay_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      // Optimistically hydrate from cache for instant UI, then verify with the server.
      try {
        const cached = localStorage.getItem(USER_KEY);
        if (cached) setUser(JSON.parse(cached));
      } catch {
        /* ignore */
      }

      if (!tokenStore.access) {
        if (active) setLoading(false);
        return;
      }

      try {
        const { data } = await api.get<{ user: AuthUser }>('/auth/me');
        if (active) {
          setUser(data.user);
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } catch {
            /* ignore */
          }
        }
      } catch {
        // token invalid/expired — clear and require login
        tokenStore.clear();
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      tokenStore.set(data.accessToken, data.refreshToken);
      setUser(data.user);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } catch {
        /* ignore */
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/register', input);
      tokenStore.set(data.accessToken, data.refreshToken);
      setUser(data.user);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } catch {
        /* ignore */
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed. Please try again.';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
