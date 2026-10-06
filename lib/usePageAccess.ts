'use client';

import { useEffect, useState } from 'react';

export function usePageAccess() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'member'>('admin');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!res.ok) return;
        const data = await res.json() as { email?: string; role?: string };
        if (cancelled) return;
        const email = data.email || '';
        setUserEmail(email);
        setUserName(email.split('@')[0] || '');
        setRole(data.role === 'member' ? 'member' : 'admin');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed: true, loading, role, userName, userEmail };
}
