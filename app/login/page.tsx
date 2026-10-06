'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { t } from '@/lib/i18n';

function safeNext(value: string | null): string {
  if (!value) return '/';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  if (/[\s\\]/.test(trimmed) || trimmed.includes('://')) return '/';
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return '/';
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('://')) {
    return '/';
  }
  return trimmed;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : t('login.error'));
        setLoading(false);
        return;
      }
      const next = safeNext(new URLSearchParams(window.location.search).get('next'));
      window.location.href = next;
    } catch {
      setError(t('login.error'));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8">
          <h1 className="font-heading text-xl">{BRAND.name}</h1>
          <p className="mt-2 text-sm text-muted">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={handleLogin} className="panel space-y-3 p-5">
          <input
            type="email"
            name="email"
            autoComplete="username"
            placeholder={t('login.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="field"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder={t('login.password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="field"
          />
          {error ? <p className="text-sm text-red">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
