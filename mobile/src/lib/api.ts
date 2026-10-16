import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors: [{ loc, msg }, ...]
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = first.loc?.[first.loc.length - 1];
    const msg = (first.msg ?? 'is invalid').replace(/^Value error, /, '');
    return field && typeof field === 'string' ? `${field.replace(/_/g, ' ')}: ${msg}` : msg;
  }
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Request failed. Please try again.';
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // FormData (file uploads) sets its own multipart Content-Type and boundary.
  const form = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : form ? (options.body as FormData) : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Is the API running?`);
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && authToken && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, errorMessage(res.status, body));
  }
  return body as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T = void>(path: string) => api<T>(path, { method: 'DELETE' });
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', body: form });
