'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import { t } from '@/lib/i18n';
import ProjectSwitcher from './ProjectSwitcher';
import { useProject } from './ProjectProvider';

interface NavItem {
  href: string;
  labelKey?: 'nav.dashboard' | 'nav.research' | 'nav.feed' | 'nav.insights';
  label?: string;
}

const NAV: Array<{ labelKey: '' | 'nav.intelligence'; items: NavItem[] }> = [
  {
    labelKey: '',
    items: [
      { href: '/', labelKey: 'nav.dashboard' },
      { href: '/library', label: '爆款库' },
    ],
  },
  {
    labelKey: 'nav.intelligence' as const,
    items: [
      { href: '/research', labelKey: 'nav.research' as const },
      { href: '/feed', labelKey: 'nav.feed' as const },
      { href: '/insights', labelKey: 'nav.insights' as const },
    ],
  },
];

interface SidebarProps {
  userEmail?: string;
  authMode?: 'open' | 'password';
  open?: boolean;
  overlay?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ userEmail = '', authMode = 'open', open = false, overlay = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { project } = useProject();

  if (pathname === '/login') return null;

  function hrefFor(path: string): string {
    const params = new URLSearchParams();
    const projectId = project?.id || search.get('project');
    if (projectId) params.set('project', projectId);
    const run = search.get('run');
    if (run && path !== '/') params.set('run', run);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const position = overlay
    ? (open ? 'translate-x-0' : '-translate-x-full')
    : `${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`;

  return (
    <nav className={`sidebar fixed inset-y-0 left-0 z-50 flex w-[240px] max-w-[85vw] flex-col border-r transition-transform duration-200 ${position}`}>
      <div className="px-5 pb-3 pt-5">
        <div className="text-[13px] font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
          {BRAND.name}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('brand.subtitle')}</div>
      </div>
      <div className="px-3 pb-4">
        <ProjectSwitcher />
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3">
        {NAV.map((section) => (
          <div key={section.labelKey || 'root'}>
            {section.labelKey ? (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">
                {t(section.labelKey)}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={hrefFor(item.href)}
                    onClick={onNavigate}
                    className={`rounded-lg px-3 py-2 text-[13px] font-medium ${active ? 'nav-active' : 'nav-idle'}`}
                  >
                    {item.label || (item.labelKey ? t(item.labelKey) : item.href)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }} title={userEmail}>
          {userEmail || t('nav.signedIn')}
        </div>
        {authMode === 'password' ? (
          <button type="button" onClick={handleLogout} className="mt-2 text-[12px] text-muted hover:text-cream">
            {t('nav.signOut')}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
