'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { usePageAccess } from '@/lib/usePageAccess';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { role, userName, userEmail } = usePageAccess();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        className="md:hidden fixed top-3 left-3 z-[60] rounded-lg px-3 py-2 text-xs font-semibold"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        Menu
      </button>
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <Sidebar role={role} userName={userName} userEmail={userEmail} open={open} onNavigate={() => setOpen(false)} />
      <main className="min-h-screen p-4 pt-16 md:ml-[250px] md:p-8 relative z-[1]">
        {children}
      </main>
    </>
  );
}
