'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Could not sign in');
      setLoading(false);
      return;
    }
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    window.location.href = next;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt={BRAND.name} className="h-12 w-auto mb-4" />
          <h1 className="font-heading text-xl" style={{ color: 'var(--text-primary)' }}>{BRAND.name}</h1>
          <p className="mt-2 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            Sign in to continue
          </p>
        </div>
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            {error ? (
              <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
