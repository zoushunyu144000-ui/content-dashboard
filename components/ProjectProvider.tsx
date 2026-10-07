'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { t } from '@/lib/i18n';

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
  refresh: () => Promise<ProjectOption[]>;
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
    const loadRunProject = async (): Promise<string | null> => {
      const runId = new URLSearchParams(window.location.search).get('run');
      if (!runId) return null;
      try {
        const data = await api<{ run: { project_id?: string } }>(`/api/research/runs/${encodeURIComponent(runId)}`);
        return data.run?.project_id || null;
      } catch {
        return null;
      }
    };
    Promise.all([api<{ projects: ProjectOption[] }>('/api/projects'), loadRunProject()])
      .then(([data, runProjectId]) => {
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
        // A ?run= link always opens that run's project. Otherwise ?project= wins,
        // then the last explicit choice (localStorage), then LOGOS by default.
        const chosen =
          list.find((item) => item.id === runProjectId) ||
          list.find((item) => item.id === fromUrl) ||
          list.find((item) => item.id === stored) ||
          logos ||
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
        if (!cancelled) setError(err.message || t('project.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const refresh = useCallback(async () => {
    const data = await api<{ projects: ProjectOption[] }>('/api/projects');
    const list = data.projects || [];
    setProjects(list);
    return list;
  }, []);

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
    () => ({ projects, project, loading, error, setProjectId, refresh }),
    [projects, project, loading, error, setProjectId, refresh],
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
