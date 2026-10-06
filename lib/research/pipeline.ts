import 'server-only';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env.server';
import { getAIProvider } from '@/lib/research/ai/provider';
import {
  INSIGHT_MERGE_SCHEMA,
  INSIGHT_MERGE_SYSTEM,
  PROMPT_VERSION as MERGE_PROMPT_VERSION,
  insightMergeUserPrompt,
  type InsightGroupDraft,
} from '@/lib/research/ai/tasks/insight-merge';
import {
  KEYWORD_SCHEMA,
  KEYWORD_SYSTEM,
  keywordUserPrompt,
  type KeywordDraft,
} from '@/lib/research/ai/tasks/keywords';
import {
  ANALYSIS_VERSION,
  PROMPT_VERSION,
  VIDEO_ANALYSIS_SCHEMA,
  VIDEO_ANALYSIS_SYSTEM,
  videoAnalysisUserPrompt,
  type VideoAnalysisDraft,
  type VideoAnalysisInput,
} from '@/lib/research/ai/tasks/video-analysis';
import { finalizeInsightGroups, groupShare, sourceKey } from '@/lib/research/insight-groups';
import { snakeLabel } from '@/lib/research/labels';
import { scoreVideos, type ScoreInput } from '@/lib/research/score';
import { InsufficientBalanceError, ScraperUnavailableError } from '@/lib/research/scraper/errors';
import {
  getScraperProvider,
  keywordLimit,
  providerChain,
  resultLimit,
  type ConcreteScraper,
} from '@/lib/research/scraper';
import type { NormalizedVideo, ScrapeHandle } from '@/lib/research/scraper/types';
import { vttToPlainText } from '@/lib/research/scraper/vtt';

type Sql = ReturnType<typeof getDb>;

interface RunRow {
  id: string;
  project_id: string;
  topic: string;
  status: string;
  attempts: number;
  max_attempts: number;
  config: RunConfig | null;
  scraper_provider: string | null;
  scraper_note: string | null;
  started_at: Date | string | null;
}

interface RunConfig {
  scraperProvider?: string;
  providerChain?: ConcreteScraper[];
  providerIndex?: number;
  scrapeStartedAt?: string;
}

interface TaskRow {
  id: string;
  keyword_id: string | null;
  scraper_provider: string;
  platform: string;
  query: string;
  status: string;
  external_run_id: string | null;
  dataset_id: string | null;
  error: string | null;
  raw_meta: Record<string, unknown> | null;
}

const SCRAPE_TIMEOUT_MS = 15 * 60 * 1000;
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export async function tickOnce(workerId: string): Promise<{ didWork: boolean; runId: string | null; status: string | null }> {
  const sql = getDb();
  const claimed = await sql<RunRow[]>`
    update research_runs
    set locked_at = now(), locked_by = ${workerId}
    where id = (
      select id from research_runs
      where status not in ('completed', 'failed', 'cancelled')
        and (run_after is null or run_after <= now())
        and (locked_at is null or locked_at < now() - interval '120 seconds')
      order by created_at
      limit 1
      for update skip locked
    )
    returning *
  `;
  const run = claimed[0];
  if (!run) return { didWork: false, runId: null, status: null };
  if (!run.started_at) {
    await sql`update research_runs set started_at = now() where id = ${run.id} and started_at is null`;
  }
  try {
    const status = await advance(sql, run);
    return { didWork: true, runId: run.id, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Research step failed';
    console.error('[research] step failed', run.id, message);
    const status = await backoff(sql, run, message);
    return { didWork: true, runId: run.id, status };
  }
}

async function advance(sql: Sql, run: RunRow): Promise<string> {
  switch (run.status) {
    case 'created':
    case 'keyword_expansion':
      return expandKeywords(sql, run);
    case 'scraping':
      return scrape(sql, run);
    case 'normalizing':
      return normalize(sql, run);
    case 'scoring':
      return scoreRun(sql, run);
    case 'analyzing':
      return analyze(sql, run);
    case 'clustering':
      return cluster(sql, run);
    case 'generating_insights':
      return writeInsights(sql, run);
    default:
      if (TERMINAL.has(run.status)) return run.status;
      throw new Error(`Unknown research status ${run.status}`);
  }
}

async function backoff(sql: Sql, run: RunRow, message: string): Promise<string> {
  const attempts = Number(run.attempts || 0) + 1;
  const maxAttempts = Number(run.max_attempts || 3);
  await event(sql, run.id, run.status, message);
  if (attempts >= maxAttempts) {
    await sql`
      update research_runs
      set status = 'failed',
          current_step = 'failed',
          error_message = ${message},
          attempts = ${attempts},
          completed_at = now(),
          locked_at = null,
          locked_by = null
      where id = ${run.id}
    `;
    return 'failed';
  }
  await sql`
    update research_runs
    set attempts = ${attempts},
        error_message = ${message},
        run_after = now() + ${attempts * 15} * interval '1 second',
        locked_at = null,
        locked_by = null
    where id = ${run.id}
  `;
  return run.status;
}

async function event(sql: Sql, runId: string, phase: string, message: string): Promise<void> {
  await sql`
    insert into research_run_events (run_id, phase, message)
    values (${runId}, ${phase}, ${message.slice(0, 2000)})
  `;
}

function configOf(run: RunRow): RunConfig {
  return run.config && typeof run.config === 'object' ? { ...run.config } : {};
}

async function expandKeywords(sql: Sql, run: RunRow): Promise<string> {
  await sql`
    update research_runs
    set status = 'keyword_expansion', current_step = 'keyword_expansion', progress = 10
    where id = ${run.id}
  `;
  const projects = await sql<
    { name: string; niche: string | null; audience: string | null; default_language: string; platforms: string[] }[]
  >`
    select name, niche, audience, default_language, platforms
    from projects where id = ${run.project_id} limit 1
  `;
  const project = projects[0];
  if (!project) throw new Error('Project was not found for this research run');

  let drafts: KeywordDraft[] = [];
  let source: 'ai' | 'user' = 'ai';
  try {
    const ai = getAIProvider();
    const result = await ai.completeJson<{ keywords: KeywordDraft[] }>({
      task: 'keywords',
      system: KEYWORD_SYSTEM,
      user: keywordUserPrompt({
        name: project.name,
        niche: project.niche,
        audience: project.audience,
        language: project.default_language || 'en',
        topic: run.topic,
        platforms: project.platforms?.length ? project.platforms : ['tiktok'],
      }),
      schemaName: 'keywords',
      schema: KEYWORD_SCHEMA,
      maxTokens: 4000,
      timeoutMs: 90_000,
    });
    drafts = result.data.keywords;
    await event(sql, run.id, 'keyword_expansion', `Expanded ${drafts.length} keywords with ${result.model}`);
  } catch (err) {
    source = 'user';
    const message = err instanceof Error ? err.message : 'keyword expansion failed';
    drafts = [{ term: run.topic, platform: 'tiktok', intent: 'trend', language: project.default_language || 'en' }];
    await event(sql, run.id, 'keyword_expansion', `Keyword expansion failed (${message}). Using the topic itself.`);
  }

  for (const draft of drafts) {
    const term = draft.term.trim().slice(0, 180);
    if (!term) continue;
    const platform = draft.platform === 'youtube' ? 'youtube' : 'tiktok';
    const intent = ['pain', 'trend', 'competitor', 'how_to'].includes(draft.intent) ? draft.intent : 'trend';
    await sql`
      insert into research_keywords (run_id, term, platform, intent, language, source)
      values (${run.id}, ${term}, ${platform}, ${intent}, ${draft.language || project.default_language || 'en'}, ${source})
      on conflict (run_id, platform, term) do nothing
    `;
  }

  await sql`
    update research_runs
    set status = 'scraping', current_step = 'scraping', progress = 25,
        error_message = null, run_after = null, locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  return 'scraping';
}

async function scrape(sql: Sql, run: RunRow): Promise<string> {
  const config = configOf(run);
  if (!config.providerChain || config.providerChain.length === 0) {
    config.providerChain = providerChain(config.scraperProvider);
    config.providerIndex = 0;
    config.scrapeStartedAt = new Date().toISOString();
  }
  const index = config.providerIndex ?? 0;
  const providerName = config.providerChain[index];
  if (!providerName) return failRun(sql, run, 'No scraper provider is available');

  const started = new Date(config.scrapeStartedAt || Date.now()).getTime();
  if (Date.now() - started > SCRAPE_TIMEOUT_MS) {
    const won = await sql<{ n: number }[]>`
      select count(*)::int as n from scrape_tasks
      where run_id = ${run.id} and status = 'succeeded'
    `;
    if (Number(won[0]?.n || 0) > 0) return moveToNormalizing(sql, run, config);
    return failRun(sql, run, 'Scraping exceeded 15 minutes');
  }

  await sql`
    update research_runs
    set status = 'scraping', current_step = 'scraping', progress = 35,
        scraper_provider = ${providerName}, config = ${sql.json(config as never)}
    where id = ${run.id}
  `;

  let tasks = await loadTasks(sql, run.id, providerName);
  if (tasks.length === 0) {
    await createTasks(sql, run.id, providerName);
    await event(sql, run.id, 'scraping', `Started ${providerName} scrape tasks`);
    tasks = await loadTasks(sql, run.id, providerName);
  }
  if (tasks.length === 0) return fallback(sql, run, config, `${providerName} had no keywords to search`);

  const provider = getScraperProvider(providerName);
  for (const task of tasks) {
    if (task.status !== 'running' || !task.external_run_id) continue;
    try {
      const polled = await provider.poll(toHandle(task));
      await saveHandle(sql, task, polled);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await markTask(sql, task.id, 'failed', err.message);
        return fallback(sql, run, config, err.message);
      }
      throw err;
    }
  }

  tasks = await loadTasks(sql, run.id, providerName);
  const pending = tasks.find((task) => task.status === 'pending');
  if (pending) {
    const limit = Number(pending.raw_meta?.limit || resultLimit(providerName, 0));
    try {
      const handle = await provider.start({ keyword: pending.query, platform: pending.platform, limit });
      await saveHandle(sql, pending, handle, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'scraper start failed';
      await markTask(sql, pending.id, 'failed', message);
      if (err instanceof InsufficientBalanceError || err instanceof ScraperUnavailableError) {
        return fallback(sql, run, config, message);
      }
      throw err;
    }
  }

  tasks = await loadTasks(sql, run.id, providerName);
  if (tasks.some((task) => task.status === 'pending' || task.status === 'running')) {
    await sql`
      update research_runs
      set run_after = now() + interval '15 seconds',
          config = ${sql.json(config as never)},
          locked_at = null,
          locked_by = null
      where id = ${run.id}
    `;
    return 'scraping';
  }
  if (tasks.some((task) => task.status === 'succeeded')) return moveToNormalizing(sql, run, config);
  const reason = tasks.map((task) => task.error).filter(Boolean).join('; ') || `${providerName} returned no videos`;
  return fallback(sql, run, config, reason);
}

async function createTasks(sql: Sql, runId: string, providerName: ConcreteScraper): Promise<void> {
  const keywords = await sql<{ id: string; term: string; platform: string }[]>`
    select id, term, platform from research_keywords where run_id = ${runId} order by term
  `;
  const platform = providerName === 'youtube' ? 'youtube' : 'tiktok';
  const preferred = keywords.filter((keyword) => keyword.platform === platform);
  const chosen = (preferred.length > 0 ? preferred : keywords).slice(0, keywordLimit(providerName));
  for (let index = 0; index < chosen.length; index += 1) {
    const limit = resultLimit(providerName, index);
    if (limit <= 0) break;
    const keyword = chosen[index];
    await sql`
      insert into scrape_tasks (
        run_id, keyword_id, scraper_provider, actor, platform, query, status, raw_meta
      ) values (
        ${runId}, ${keyword.id}, ${providerName}, ${providerName === 'apify' ? getServerEnv().apifyTiktokActor : null},
        ${platform}, ${keyword.term}, 'pending', ${sql.json({ limit } as never)}
      )
    `;
  }
}

async function loadTasks(sql: Sql, runId: string, providerName: string): Promise<TaskRow[]> {
  return sql<TaskRow[]>`
    select id, keyword_id, scraper_provider, platform, query, status, external_run_id, dataset_id, error, raw_meta
    from scrape_tasks
    where run_id = ${runId} and scraper_provider = ${providerName}
    order by created_at
  `;
}

function toHandle(task: TaskRow): ScrapeHandle {
  return {
    externalRunId: task.external_run_id || '',
    datasetId: task.dataset_id,
    status: task.status === 'succeeded' || task.status === 'failed' ? task.status : 'running',
    error: task.error,
    rawMeta: task.raw_meta || {},
  };
}

async function saveHandle(sql: Sql, task: TaskRow, handle: ScrapeHandle, started = false): Promise<void> {
  const rawMeta = { ...(task.raw_meta || {}), ...(handle.rawMeta || {}) };
  const finished = handle.status === 'succeeded' || handle.status === 'failed';
  await sql`
    update scrape_tasks
    set status = ${handle.status},
        external_run_id = ${handle.externalRunId || null},
        dataset_id = ${handle.datasetId},
        error = ${handle.error || null},
        raw_meta = ${sql.json(rawMeta as never)},
        started_at = case when ${started} then coalesce(started_at, now()) else started_at end,
        finished_at = case when ${finished} then coalesce(finished_at, now()) else finished_at end,
        attempt = attempt + case when ${started} then 1 else 0 end
    where id = ${task.id}
  `;
}

async function markTask(sql: Sql, taskId: string, status: string, error: string): Promise<void> {
  await sql`
    update scrape_tasks
    set status = ${status}, error = ${error}, finished_at = now()
    where id = ${taskId}
  `;
}

async function fallback(sql: Sql, run: RunRow, config: RunConfig, reason: string): Promise<string> {
  const current = config.providerChain?.[config.providerIndex ?? 0] || run.scraper_provider || 'scraper';
  const note = `${current} failed: ${reason}`.slice(0, 500);
  const combined = [run.scraper_note, note].filter(Boolean).join(' | ').slice(0, 2000);
  await event(sql, run.id, 'scraping', note);
  const nextIndex = (config.providerIndex ?? 0) + 1;
  const next = config.providerChain?.[nextIndex];
  if (!next) return failRun(sql, run, combined, combined);
  config.providerIndex = nextIndex;
  run.scraper_note = combined;
  await sql`
    update research_runs
    set status = 'scraping',
        current_step = 'scraping',
        scraper_provider = ${next},
        scraper_note = ${combined},
        config = ${sql.json(config as never)},
        error_message = null,
        run_after = null,
        locked_at = null,
        locked_by = null
    where id = ${run.id}
  `;
  return 'scraping';
}

async function moveToNormalizing(sql: Sql, run: RunRow, config: RunConfig): Promise<string> {
  await sql`
    update research_runs
    set status = 'normalizing', current_step = 'normalizing', progress = 50,
        config = ${sql.json(config as never)},
        run_after = null, locked_at = null, locked_by = null, error_message = null
    where id = ${run.id}
  `;
  return 'normalizing';
}

async function failRun(sql: Sql, run: RunRow, message: string, note?: string): Promise<string> {
  await event(sql, run.id, 'failed', message);
  await sql`
    update research_runs
    set status = 'failed', current_step = 'failed', error_message = ${message.slice(0, 2000)},
        scraper_note = coalesce(${note || null}, scraper_note),
        completed_at = now(), locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  return 'failed';
}

async function normalize(sql: Sql, run: RunRow): Promise<string> {
  const tasks = await sql<TaskRow[]>`
    select id, keyword_id, scraper_provider, platform, query, status, external_run_id, dataset_id, error, raw_meta
    from scrape_tasks
    where run_id = ${run.id} and status = 'succeeded'
    order by created_at
  `;
  for (const task of tasks) {
    if (task.raw_meta?.normalized === true) continue;
    if (!isConcrete(task.scraper_provider)) continue;
    const provider = getScraperProvider(task.scraper_provider);
    const videos = await provider.fetchNormalized(toHandle(task));
    // Scoring (and therefore viral rank) runs after this step, so the
    // "top viral AI_ANALYSIS_LIMIT" slice is not knowable yet. Download every
    // subtitle URL instead. Failures stay null and are ignored.
    await fillTranscripts(videos);
    for (const video of videos) {
      const videoId = await upsertVideo(sql, video);
      if (!videoId) continue;
      await sql`
        insert into research_run_videos (run_id, video_id, keyword_id, scrape_task_id)
        values (${run.id}, ${videoId}, ${task.keyword_id}, ${task.id})
        on conflict (run_id, video_id) do nothing
      `;
    }
    const rawMeta = { ...(task.raw_meta || {}), normalized: true, videoCount: videos.length };
    await sql`update scrape_tasks set raw_meta = ${sql.json(rawMeta as never)} where id = ${task.id}`;
  }

  const counts = await sql<{ n: number }[]>`
    select count(*)::int as n from research_run_videos where run_id = ${run.id}
  `;
  if (Number(counts[0]?.n || 0) === 0) {
    return fallback(sql, run, configOf(run), 'normalizer produced no videos');
  }
  await sql`
    update research_runs
    set status = 'scoring', current_step = 'scoring', progress = 65,
        run_after = null, locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  return 'scoring';
}

const TRANSCRIPT_CONCURRENCY = 4;
const TRANSCRIPT_TIMEOUT_MS = 8000;

async function fillTranscripts(videos: NormalizedVideo[]): Promise<void> {
  const pending = videos.filter((video) => !video.transcript && video.subtitleUrl);
  await mapPool(pending, TRANSCRIPT_CONCURRENCY, async (video) => {
    const url = video.subtitleUrl;
    if (!url) return;
    video.transcript = await fetchTranscript(url);
  });
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const runners = Math.min(concurrency, items.length);
  async function run(): Promise<void> {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: runners }, () => run()));
}

async function fetchTranscript(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIPT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const text = vttToPlainText(await response.text());
    return text ? text.slice(0, 8000) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function upsertVideo(sql: Sql, video: NormalizedVideo): Promise<string | null> {
  const raw = sql.json((video.raw ?? {}) as never);
  if (video.platformVideoId) {
    const rows = await sql<{ id: string }[]>`
      insert into videos (
        platform, platform_video_id, url, canonical_url, video_url, video_url_expires_at, embed_url,
        thumbnail_url, caption, author_handle, author_name, author_followers, views, likes, comments,
        shares, saves, duration_seconds, published_at, transcript, raw
      ) values (
        ${video.platform}, ${video.platformVideoId}, ${video.url}, ${video.canonicalUrl}, ${video.videoUrl},
        ${video.videoUrlExpiresAt}, ${video.embedUrl}, ${video.thumbnailUrl}, ${video.caption},
        ${video.authorHandle}, ${video.authorName}, ${video.authorFollowers}, ${video.views}, ${video.likes},
        ${video.comments}, ${video.shares}, ${video.saves}, ${video.durationSeconds}, ${video.publishedAt},
        ${video.transcript}, ${raw}
      )
      on conflict (platform, platform_video_id) where platform_video_id is not null
      do update set
        url = coalesce(excluded.url, videos.url),
        canonical_url = coalesce(excluded.canonical_url, videos.canonical_url),
        video_url = coalesce(excluded.video_url, videos.video_url),
        video_url_expires_at = coalesce(excluded.video_url_expires_at, videos.video_url_expires_at),
        embed_url = coalesce(excluded.embed_url, videos.embed_url),
        thumbnail_url = coalesce(excluded.thumbnail_url, videos.thumbnail_url),
        caption = coalesce(excluded.caption, videos.caption),
        author_handle = coalesce(excluded.author_handle, videos.author_handle),
        author_name = coalesce(excluded.author_name, videos.author_name),
        author_followers = coalesce(excluded.author_followers, videos.author_followers),
        views = coalesce(excluded.views, videos.views),
        likes = coalesce(excluded.likes, videos.likes),
        comments = coalesce(excluded.comments, videos.comments),
        shares = coalesce(excluded.shares, videos.shares),
        saves = coalesce(excluded.saves, videos.saves),
        duration_seconds = coalesce(excluded.duration_seconds, videos.duration_seconds),
        published_at = coalesce(excluded.published_at, videos.published_at),
        transcript = coalesce(excluded.transcript, videos.transcript),
        raw = excluded.raw,
        last_seen_at = now()
      returning id
    `;
    return rows[0]?.id || null;
  }
  if (!video.canonicalUrl) return null;
  const existing = await sql<{ id: string }[]>`
    select id from videos
    where platform = ${video.platform} and platform_video_id is null and canonical_url = ${video.canonicalUrl}
    limit 1
  `;
  if (!existing[0]) {
    const inserted = await sql<{ id: string }[]>`
      insert into videos (
        platform, platform_video_id, url, canonical_url, video_url, video_url_expires_at, embed_url,
        thumbnail_url, caption, author_handle, author_name, author_followers, views, likes, comments,
        shares, saves, duration_seconds, published_at, transcript, raw
      ) values (
        ${video.platform}, null, ${video.url}, ${video.canonicalUrl}, ${video.videoUrl}, ${video.videoUrlExpiresAt},
        ${video.embedUrl}, ${video.thumbnailUrl}, ${video.caption}, ${video.authorHandle}, ${video.authorName},
        ${video.authorFollowers}, ${video.views}, ${video.likes}, ${video.comments}, ${video.shares}, ${video.saves},
        ${video.durationSeconds}, ${video.publishedAt}, ${video.transcript}, ${raw}
      )
      returning id
    `;
    return inserted[0]?.id || null;
  }
  await sql`
    update videos set
      url = coalesce(${video.url}, url),
      video_url = coalesce(${video.videoUrl}, video_url),
      video_url_expires_at = coalesce(${video.videoUrlExpiresAt}, video_url_expires_at),
      embed_url = coalesce(${video.embedUrl}, embed_url),
      thumbnail_url = coalesce(${video.thumbnailUrl}, thumbnail_url),
      caption = coalesce(${video.caption}, caption),
      author_handle = coalesce(${video.authorHandle}, author_handle),
      author_name = coalesce(${video.authorName}, author_name),
      author_followers = coalesce(${video.authorFollowers}, author_followers),
      views = coalesce(${video.views}, views),
      likes = coalesce(${video.likes}, likes),
      comments = coalesce(${video.comments}, comments),
      shares = coalesce(${video.shares}, shares),
      saves = coalesce(${video.saves}, saves),
      duration_seconds = coalesce(${video.durationSeconds}, duration_seconds),
      published_at = coalesce(${video.publishedAt}, published_at),
      transcript = coalesce(${video.transcript}, transcript),
      raw = ${raw},
      last_seen_at = now()
    where id = ${existing[0].id}
  `;
  return existing[0].id;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function scoreRun(sql: Sql, run: RunRow): Promise<string> {
  const rows = await sql<
    {
      video_id: string;
      platform: string;
      views: unknown;
      likes: unknown;
      comments: unknown;
      shares: unknown;
      saves: unknown;
      author_followers: unknown;
      published_at: Date | string | null;
    }[]
  >`
    select v.id as video_id, v.platform, v.views, v.likes, v.comments, v.shares, v.saves,
           v.author_followers, v.published_at
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    where rv.run_id = ${run.id}
  `;
  const projects = await sql<{ viral_score_config: unknown }[]>`
    select viral_score_config from projects where id = ${run.project_id} limit 1
  `;
  const inputs: ScoreInput[] = rows.map((row) => ({
    id: row.video_id,
    platform: row.platform,
    views: num(row.views),
    likes: num(row.likes),
    comments: num(row.comments),
    shares: num(row.shares),
    saves: num(row.saves),
    authorFollowers: num(row.author_followers),
    publishedAt: row.published_at,
  }));
  const scored = [...scoreVideos(inputs, projects[0]?.viral_score_config)].sort(
    (left, right) => right.viralScore - left.viralScore,
  );
  for (let index = 0; index < scored.length; index += 1) {
    const row = scored[index];
    await sql`
      update research_run_videos
      set engagement_score = ${row.engagementScore},
          outlier_score = ${row.outlierScore},
          freshness_score = ${row.freshnessScore},
          viral_score = ${row.viralScore},
          is_high_potential = ${row.isHighPotential},
          score_components = ${sql.json(row.scoreComponents as never)},
          rank = ${index + 1}
      where run_id = ${run.id} and video_id = ${row.id}
    `;
  }
  await event(sql, run.id, 'scoring', `Scored ${scored.length} videos`);
  await sql`
    update research_runs
    set status = 'analyzing', current_step = 'analyzing', progress = 75,
        run_after = null, locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  return 'analyzing';
}

async function analyze(sql: Sql, run: RunRow): Promise<string> {
  const env = getServerEnv();
  const pending = await sql<
    {
      id: string;
      caption: string | null;
      author_handle: string | null;
      author_name: string | null;
      views: unknown;
      likes: unknown;
      comments: unknown;
      shares: unknown;
      saves: unknown;
      transcript: string | null;
    }[]
  >`
    with ranked as (
      select v.id, v.caption, v.author_handle, v.author_name, v.views, v.likes, v.comments, v.shares, v.saves, v.transcript,
             row_number() over (order by rv.viral_score desc nulls last) as rn
      from research_run_videos rv
      join videos v on v.id = rv.video_id
      where rv.run_id = ${run.id}
    )
    select id, caption, author_handle, author_name, views, likes, comments, shares, saves, transcript
    from ranked
    where rn <= ${env.aiAnalysisLimit}
      and not exists (
        select 1 from video_analyses a
        where a.run_id = ${run.id}
          and a.video_id = ranked.id
          and a.prompt_version = ${PROMPT_VERSION}
          and a.status in ('complete', 'failed')
      )
    order by rn
    limit ${env.aiBatchSize}
  `;
  if (pending.length === 0) {
    await sql`
      update research_runs
      set status = 'clustering', current_step = 'clustering', progress = 88,
          run_after = null, locked_at = null, locked_by = null
      where id = ${run.id}
    `;
    return 'clustering';
  }

  const inputs: VideoAnalysisInput[] = pending.map((row) => ({
    video_ref: row.id,
    caption: row.caption,
    author_handle: row.author_handle,
    author_name: row.author_name,
    views: num(row.views),
    likes: num(row.likes),
    comments: num(row.comments),
    shares: num(row.shares),
    saves: num(row.saves),
    transcript: row.transcript ? row.transcript.slice(0, 1500) : null,
  }));
  const ai = getAIProvider();
  const result = await ai.completeJson<{ analyses: VideoAnalysisDraft[] }>({
    task: 'video_analysis',
    system: VIDEO_ANALYSIS_SYSTEM,
    user: videoAnalysisUserPrompt(inputs),
    schemaName: 'video_analyses',
    schema: VIDEO_ANALYSIS_SCHEMA,
    maxTokens: 8000,
    timeoutMs: 180_000,
  });
  const byRef = new Map(result.data.analyses.map((item) => [item.video_ref, item]));
  for (const row of pending) {
    const analysis = byRef.get(row.id);
    if (!analysis) {
      await insertAnalysis(sql, run.id, row.id, null, result.model, 'failed', 'Model omitted this video');
      continue;
    }
    await insertAnalysis(sql, run.id, row.id, analysis, result.model, 'complete', null);
  }
  await event(sql, run.id, 'analyzing', `Analyzed ${pending.length} videos with ${result.model}`);
  await sql`
    update research_runs
    set progress = 80, run_after = null, locked_at = null, locked_by = null, error_message = null
    where id = ${run.id}
  `;
  return 'analyzing';
}

async function insertAnalysis(
  sql: Sql,
  runId: string,
  videoId: string,
  analysis: VideoAnalysisDraft | null,
  model: string,
  status: 'complete' | 'failed',
  error: string | null,
): Promise<void> {
  const replicability =
    analysis && Number.isInteger(analysis.replicability)
      ? Math.min(100, Math.max(0, analysis.replicability))
      : null;
  await sql`
    insert into video_analyses (
      run_id, video_id, audience, pain_point, hook, hook_type, emotion, topic, content_structure,
      viral_hypothesis, reusable_pattern, replicability, hook_text, summary, model, prompt_version,
      analysis_version, raw_json, status, error
    ) values (
      ${runId}, ${videoId}, ${analysis?.audience || null}, ${snakeLabel(analysis?.pain_point)},
      ${analysis?.hook || null}, ${analysis?.hook_type || null}, ${analysis?.emotion || null},
      ${snakeLabel(analysis?.topic)}, ${analysis?.content_structure || null}, ${analysis?.viral_hypothesis || null},
      ${analysis?.reusable_pattern || null}, ${replicability}, ${analysis?.hook_text || null},
      ${analysis?.summary || null}, ${model}, ${PROMPT_VERSION}, ${ANALYSIS_VERSION},
      ${analysis ? sql.json(analysis as never) : null}, ${status}, ${error}
    )
    on conflict (run_id, video_id, prompt_version) do nothing
  `;
}

async function cluster(sql: Sql, run: RunRow): Promise<string> {
  const analyses = await sql<
    { video_id: string; pain_point: string | null; hook_type: string | null; emotion: string | null; topic: string | null; content_structure: string | null }[]
  >`
    select video_id, pain_point, hook_type, emotion, topic, content_structure
    from video_analyses
    where run_id = ${run.id} and status = 'complete' and prompt_version = ${PROMPT_VERSION}
  `;
  const buckets = new Map<string, { kind: InsightGroupDraft['kind']; label: string; videos: Set<string> }>();
  const add = (kind: InsightGroupDraft['kind'], label: string | null, videoId: string) => {
    const normalized = sourceKey(kind, label);
    if (!normalized) return;
    const key = `${kind}:${normalized}`;
    const bucket = buckets.get(key) || { kind, label: normalized, videos: new Set<string>() };
    bucket.videos.add(videoId);
    buckets.set(key, bucket);
  };
  for (const row of analyses) {
    add('pain_point', row.pain_point, row.video_id);
    add('hook', row.hook_type, row.video_id);
    add('structure', row.content_structure, row.video_id);
    add('emotion', row.emotion, row.video_id);
    add('topic', row.topic, row.video_id);
  }

  let groups: InsightGroupDraft[] = [];
  let method: 'hybrid' | 'tag_count' = 'tag_count';
  if (buckets.size > 0) {
    try {
      const ai = getAIProvider();
      const result = await ai.completeJson<{ groups: InsightGroupDraft[] }>({
        task: 'insight_merge',
        system: INSIGHT_MERGE_SYSTEM,
        user: insightMergeUserPrompt(
          Array.from(buckets.values()).map((bucket) => ({ kind: bucket.kind, label: bucket.label, count: bucket.videos.size })),
        ),
        schemaName: 'insight_merge',
        schema: INSIGHT_MERGE_SCHEMA,
        maxTokens: 4000,
        timeoutMs: 90_000,
      });
      groups = result.data.groups;
      method = 'hybrid';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'insight merge failed';
      await event(sql, run.id, 'clustering', `Insight merge failed (${message}). Using tag counts.`);
      groups = [];
      method = 'tag_count';
    }
  }

  const finalized = finalizeInsightGroups(
    Array.from(buckets.values()).map((bucket) => ({ kind: bucket.kind, label: bucket.label, count: bucket.videos.size })),
    method === 'hybrid' ? groups : null,
  );
  if (!finalized.usedModel) method = 'tag_count';

  await sql`delete from insight_clusters where run_id = ${run.id}`;
  const analyzed = analyses.length;
  for (const group of finalized.groups) {
    const videos = new Set<string>();
    for (const source of group.source_labels) {
      const bucket = buckets.get(`${group.kind}:${source}`);
      if (!bucket) continue;
      bucket.videos.forEach((id) => videos.add(id));
    }
    if (videos.size === 0) continue;
    const percent = groupShare(videos.size, analyzed);
    const inserted = await sql<{ id: string }[]>`
      insert into insight_clusters (run_id, kind, label, summary, video_count, percent, method, source_labels)
      values (
        ${run.id}, ${group.kind}, ${group.label}, ${group.summary || null}, ${videos.size}, ${percent}, ${method},
        ${sql.array(group.source_labels)}
      )
      on conflict (run_id, kind, label) do update set
        summary = excluded.summary,
        video_count = excluded.video_count,
        percent = excluded.percent,
        method = excluded.method,
        source_labels = excluded.source_labels
      returning id
    `;
    const clusterId = inserted[0]?.id;
    if (!clusterId) continue;
    for (const videoId of Array.from(videos)) {
      await sql`
        insert into insight_cluster_videos (cluster_id, video_id)
        values (${clusterId}, ${videoId})
        on conflict do nothing
      `;
    }
  }
  await event(
    sql,
    run.id,
    'clustering',
    `Insight merge ${MERGE_PROMPT_VERSION} (${method}) mapped ${buckets.size} labels into ${finalized.groups.length} groups`,
  );

  await sql`
    update research_runs
    set status = 'generating_insights', current_step = 'generating_insights', progress = 95,
        run_after = null, locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  return 'generating_insights';
}

async function writeInsights(sql: Sql, run: RunRow): Promise<string> {
  const clusters = await sql<
    { id: string; kind: string; label: string; video_count: number; percent: unknown }[]
  >`
    select id, kind, label, video_count, percent
    from insight_clusters
    where run_id = ${run.id}
    order by video_count desc, label
  `;
  const links = await sql<{ cluster_id: string; video_id: string }[]>`
    select cv.cluster_id, cv.video_id
    from insight_cluster_videos cv
    join insight_clusters c on c.id = cv.cluster_id
    where c.run_id = ${run.id}
  `;
  const pack = (kind: string) =>
    clusters
      .filter((cluster) => cluster.kind === kind)
      .map((cluster) => ({
        label: cluster.label,
        count: Number(cluster.video_count) || 0,
        percent: num(cluster.percent) ?? 0,
        example_video_ids: links
          .filter((link) => link.cluster_id === cluster.id)
          .slice(0, 3)
          .map((link) => link.video_id),
      }));
  const insights = {
    prompt_version: MERGE_PROMPT_VERSION,
    top_pain_points: pack('pain_point'),
    top_hooks: pack('hook'),
    top_content_structures: pack('structure'),
    top_emotions: pack('emotion'),
    emerging_topics: pack('topic'),
  };
  await sql`
    update research_runs
    set status = 'completed', current_step = 'completed', progress = 100,
        insights = ${sql.json(insights as never)}, completed_at = now(),
        error_message = null, run_after = null, locked_at = null, locked_by = null
    where id = ${run.id}
  `;
  await event(sql, run.id, 'completed', 'Research run completed');
  return 'completed';
}

function isConcrete(value: string): value is ConcreteScraper {
  return value === 'apify' || value === 'tikhub' || value === 'youtube';
}
