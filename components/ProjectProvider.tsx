'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';

export interface ProjectOption {
  id: string;
  slug: string;
  name: string;
}

interface ProjectState {
  projects: ProjectOption[];
  project: ProjectOption | null;
  loading: boolean;
  error: string;
  setProjectId: (id: string) => void;
}

const STORAGE_KEY = 'ci.project';
const DEFAULT_SLUG = 'logos-web-studio';

const ProjectContext = createContext<ProjectState | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectIdState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<{ projects: ProjectOption[] }>('/api/projects')
      .then((data) => {
        if (cancelled) return;
        const list = data.projects || [];
        setProjects(list);
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('project');
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const logos =
          list.find((item) => item.slug === DEFAULT_SLUG) ||
          list.find((item) => item.name === 'LOGOS Web Studio') ||
          null;
        // URL wins. With no ?project=, Dashboard and Research start on LOGOS.
        // localStorage is the fallback when that project is missing, and it
        // remembers the last explicit choice for the next visit.
        const chosen =
          list.find((item) => item.id === fromUrl) ||
          logos ||
          list.find((item) => item.id === stored) ||
          list[0] ||
          null;
        if (!chosen) return;
        setProjectIdState(chosen.id);
        window.localStorage.setItem(STORAGE_KEY, chosen.id);
        if (fromUrl !== chosen.id) {
          params.set('project', chosen.id);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load projects');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    const params = new URLSearchParams(window.location.search);
    params.set('project', id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) || null,
    [projects, projectId],
  );

  const value = useMemo(
    () => ({ projects, project, loading, error, setProjectId }),
    [projects, project, loading, error, setProjectId],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectState {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error('useProject must be used inside ProjectProvider');
  }
  return value;
}
