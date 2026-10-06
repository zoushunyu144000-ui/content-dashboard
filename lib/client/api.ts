import { t } from '@/lib/i18n';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 401 && typeof window !== 'undefined') {
    // Never bounce from the login page itself (that caused an infinite
    // /login?next=/login?next=... loop when a layout-level call got 401).
    if (window.location.pathname !== '/login') {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
    throw new ApiError(t('api.signInRequired'), 401);
  }
  const data = await response.json().catch(() => ({} as { error?: unknown }));
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : t('api.requestFailed', { status: response.status });
    throw new ApiError(message, response.status);
  }
  return data as T;
}
