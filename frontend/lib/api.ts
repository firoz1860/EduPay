/**
 * Centralized API client. Every network call in the app goes through here.
 * - Base URL comes from NEXT_PUBLIC_API_URL (never hardcoded).
 * - Attaches the JWT access token; transparently refreshes once on 401.
 * - Normalizes the backend response envelope and throws a typed ApiError.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');

const ACCESS_KEY = 'edupay_access_token';
const REFRESH_KEY = 'edupay_refresh_token';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PageMeta;
  summary?: Record<string, number>;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get access() {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  get refresh() {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* ignore storage errors */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('edupay_user');
    } catch {
      /* ignore */
    }
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  _retried?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  try {
    const res = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
    tokenStore.set(body.data.accessToken, body.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Please check your connection.');
  }

  // Transparent single refresh on unauthorized.
  if (res.status === 401 && !options._retried && tokenStore.refresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, { ...options, _retried: true });
    tokenStore.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
  }

  let body: ApiEnvelope<T> | { success: false; error: { code: string; message: string; details?: unknown } };
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Unexpected server response (${res.status})`);
  }

  if (!res.ok || (body as { success: boolean }).success === false) {
    const err = (body as { error?: { code: string; message: string; details?: unknown } }).error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Request failed', err?.details);
  }

  return body as ApiEnvelope<T>;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiRequest<T>(path, { query }),
  post: <T>(path: string, body?: unknown, opts?: { idempotencyKey?: string }) =>
    apiRequest<T>(path, { method: 'POST', body, idempotencyKey: opts?.idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/** Generate a client-side idempotency key for money-moving requests. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
