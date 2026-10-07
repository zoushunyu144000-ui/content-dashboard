'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/components/ProjectProvider';
import { api } from '@/lib/client/api';
import { t } from '@/lib/i18n';
import AnalysisDrawer from './AnalysisDrawer';
import LibraryCard from './LibraryCard';
import LibraryFilters from './LibraryFilters';
import {
  EMPTY_FACETS,
  LIBRARY_FILTER_PARAMS,
  buildLibraryUrl,
  filterValues,
  normalizeFacets,
  readFilterQuery,
  type LibraryFacets,
  type LibraryFilterParam,
  type LibraryVideo,
} from './shared';

export default function LibraryHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const filterQuery = readFilterQuery(searchParams);
  const videoId = searchParams.get('video') || '';
  const nicheId = project?.id || '';
  const values = useMemo(() => filterValues(filterQuery), [filterQuery]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [facets, setFacets] = useState<LibraryFacets>(EMPTY_FACETS);
  const [pinned, setPinned] = useState<LibraryVideo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [trackedVideoId, setTrackedVideoId] = useState(videoId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const lookedUp = useRef('');

  if (trackedVideoId !== videoId) {
    setTrackedVideoId(videoId);
    setLookupState('idle');
    lookedUp.current = '';
  }

  const updateParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const onFilterChange = useCallback((key: LibraryFilterParam, value: string) => {
    updateParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }, [updateParams]);

  const onClear = useCallback(() => {
    updateParams((params) => {
      for (const key of LIBRARY_FILTER_PARAMS) params.delete(key);
    });
  }, [updateParams]);

  const openVideo = useCallback((id: string) => {
    updateParams((params) => params.set('video', id));
  }, [updateParams]);

  const closeDrawer = useCallback(() => {
    updateParams((params) => params.delete('video'));
  }, [updateParams]);

  useEffect(() => {
    setPinned(null);
    setFacets(EMPTY_FACETS);
    lookedUp.current = '';
    setLookupState('idle');
  }, [nicheId]);

  useEffect(() => {
    setVideos([]);
  }, [filterQuery, nicheId]);

  useEffect(() => {
    if (!project) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const listUrl = buildLibraryUrl(project.id, filterQuery);
    const facetUrl = `/api/library/facets?niche=${encodeURIComponent(project.id)}`;
    Promise.all([
      api<{ videos?: LibraryVideo[] }>(listUrl),
      api<Partial<LibraryFacets>>(facetUrl).catch(() => null),
    ])
      .then(([list, nextFacets]) => {
        if (cancelled) return;
        setVideos(Array.isArray(list.videos) ? list.videos : []);
        if (nextFacets) setFacets(normalizeFacets(nextFacets));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '无法加载爆款库');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, projectLoading, filterQuery, reloadToken]);

  useEffect(() => {
    if (!videoId) return;
    const found = videos.find((item) => item.id === videoId);
    if (found) setPinned(found);
  }, [videos, videoId]);

  useEffect(() => {
    if (!videoId || !project || loading) return;
    if (videos.some((item) => item.id === videoId)) {
      setLookupState('done');
      return;
    }
    if (!filterQuery) {
      setLookupState('done');
      return;
    }
    const token = `${project.id}:${videoId}`;
    if (lookedUp.current === token) return;
    let cancelled = false;
    setLookupState('loading');
    api<{ videos?: LibraryVideo[] }>(`/api/library?niche=${encodeURIComponent(project.id)}&limit=100`)
      .then((data) => {
        if (cancelled) return;
        lookedUp.current = token;
        const rows = Array.isArray(data.videos) ? data.videos : [];
        const found = rows.find((item) => item.id === videoId) || null;
        if (found) setPinned(found);
        setLookupState('done');
      })
      .catch(() => {
        if (!cancelled) setLookupState('done');
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, project, loading, videos, filterQuery]);

  const inList = videos.find((item) => item.id === videoId) || null;
  const drawerVideo = inList || (pinned && pinned.id === videoId ? pinned : null);
  const drawerLoading = Boolean(videoId) && !drawerVideo && (loading || lookupState !== 'done' || projectLoading);
  const drawerMissing = Boolean(videoId) && !drawerVideo && !drawerLoading && !projectLoading;

  function handleAnalyzed(next: LibraryVideo) {
    setPinned(next);
    setVideos((current) => current.map((item) => (item.id === next.id ? next : item)));
    setReloadToken((count) => count + 1);
  }

  const feedHref = useMemo(() => {
    const params = new URLSearchParams();
    const projectId = project?.id || searchParams.get('project');
    if (projectId) params.set('project', projectId);
    const run = searchParams.get('run');
    if (run) params.set('run', run);
    const query = params.toString();
    return query ? `/feed?${query}` : '/feed';
  }, [project?.id, searchParams]);

  const activeFilters = LIBRARY_FILTER_PARAMS.some((key) => values[key]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">爆款库</h1>
          <p className="mt-1 text-sm text-muted">{project?.name || (projectLoading ? t('project.loading') : t('project.choose'))}</p>
        </div>
        <Link href={feedHref} className="btn-ghost">旧信息流</Link>
      </div>

      {projectError || error ? (
        <div className="error-banner mt-4" role="alert">
          <p>{projectError ? (projectError || t('project.loadError')) : '无法加载爆款库'}</p>
          {!projectError && error && error !== '无法加载爆款库' ? <p className="mt-1 text-xs">{error}</p> : null}
          {!projectError ? (
            <button type="button" className="btn-ghost mt-2" onClick={() => setReloadToken((count) => count + 1)}>
              {t('ai.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {project ? (
        <div className="mt-4">
          <LibraryFilters values={values} facets={facets} onChange={onFilterChange} onClear={onClear} />
        </div>
      ) : null}

      {projectLoading || (loading && videos.length === 0 && !error) ? (
        <p className="mt-6 text-sm text-muted">正在加载爆款库…</p>
      ) : null}

      {!projectLoading && !project && !projectError ? (
        <p className="mt-6 text-sm text-muted">{t('project.none')}</p>
      ) : null}

      {project && !loading && !error && videos.length === 0 ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">没有符合条件的视频</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            {activeFilters ? '试试放宽筛选，或清除当前条件。' : '这个项目还没有进入爆款库的视频。'}
          </p>
          {activeFilters ? (
            <button type="button" className="btn-ghost mt-3" onClick={onClear}>清除筛选</button>
          ) : null}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="mt-4">
          <p className="mb-3 text-xs text-muted">
            {videos.length} 个视频{loading ? ' · 正在更新…' : ''}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <li key={video.id}>
                <LibraryCard
                  video={video}
                  playing={playingId === video.id}
                  onPlay={setPlayingId}
                  onStop={() => setPlayingId(null)}
                  onOpen={openVideo}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {videoId ? (
        <AnalysisDrawer
          video={drawerVideo}
          nicheId={nicheId}
          loading={drawerLoading}
          missing={drawerMissing}
          onClose={closeDrawer}
          onAnalyzed={handleAnalyzed}
        />
      ) : null}
    </div>
  );
}
