'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { ProjectProvider } from './ProjectProvider';
import { usePageAccess } from '@/lib/usePageAccess';
import { BRAND } from '@/lib/brand';
import { t } from '@/lib/i18n';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isFeed = pathname === '/feed';
  const { userEmail, authMode } = usePageAccess();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isLoginPage) return <>{children}</>;

  return (
    <ProjectProvider>
      {isFeed ? (
        <button
          type="button"
          className="menu-button fixed left-3 top-3 z-[70]"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={open}
        >
          {open ? t('nav.close') : t('nav.menu')}
        </button>
      ) : (
        <header className="shell-top md:hidden">
          <button
            type="button"
            className="menu-button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={open}
          >
            {open ? t('nav.close') : t('nav.menu')}
          </button>
          <span className="truncate text-[13px] font-medium">{BRAND.name}</span>
        </header>
      )}
      {open ? (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <Suspense fallback={null}>
        <Sidebar userEmail={userEmail} authMode={authMode} open={open} overlay={isFeed} onNavigate={() => setOpen(false)} />
      </Suspense>
      {!isFeed ? (
        <div className="shell-offset">
          <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-4 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      ) : (
        <main className="h-dvh overflow-hidden">{children}</main>
      )}
    </ProjectProvider>
  );
}
