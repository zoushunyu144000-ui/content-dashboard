import 'server-only';
import { getDb } from '@/lib/db';
import { getAIProvider } from '@/lib/research/ai/provider';
import {
  PROMPT_VERSION,
  VIDEO_ANALYSIS_SCHEMA,
  VIDEO_ANALYSIS_SYSTEM,
  videoAnalysisUserPrompt,
  type VideoAnalysisDraft,
  type VideoAnalysisInput,
} from '@/lib/research/ai/tasks/video-analysis';
import { insertAnalysis } from '@/lib/research/pipeline';

export interface ReanalyzeStatus {
  running: boolean;
  done: number;
  failed: number;
  total: number;
  startedAt: string | null;
}

export interface AnalyzeBatchResult {
  complete: number;
  failed: number;
}

interface VideoRow {
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
}

interface NicheProfile {
  name: string;
  niche: string | null;
  audience: string | null;
  target_audience: string | null;
  core_business: string | null;
}

interface ReanalyzeJob {
  nicheId: string;
  videoIds: string[];
}

const globalState = globalThis as unknown as { __contentIntelReanalyze?: ReanalyzeStatus };

function status(): ReanalyzeStatus {
  if (!globalState.__contentIntelReanalyze) {
    globalState.__contentIntelReanalyze = {
      running: false,
      done: 0,
      failed: 0,
      total: 0,
      startedAt: null,
    };
  }
  return globalState.__contentIntelReanalyze;
}

export function getReanalyzeStatus(): ReanalyzeStatus {
  return { ...status() };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : 'AI analysis failed';
  return message.slice(0, 2000);
}

function chunk(ids: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += size) batches.push(ids.slice(index, index + size));
  return batches;
}

async function markFailed(nicheId: string, videoIds: string[], message: string): Promise<void> {
  const sql = getDb();
  for (const videoId of videoIds) {
    await insertAnalysis(sql, null, nicheId, videoId, null, '', 'failed', message);
  }
}

export async function analyzeVideoBatch(nicheId: string, videoIds: string[]): Promise<AnalyzeBatchResult> {
  const ids = Array.from(new Set(videoIds.filter(Boolean)));
  if (ids.length === 0) return { complete: 0, failed: 0 };

  const sql = getDb();
  const videos = await sql<VideoRow[]>`
    select id, caption, author_handle, author_name, views, likes, comments, shares, saves, transcript
    from videos
    where id in ${sql(ids)}
  `;
  if (videos.length === 0) return { complete: 0, failed: 0 };

  const projects = await sql<NicheProfile[]>`
    select name, niche, audience, target_audience, core_business
    from projects
    where id = ${nicheId}
    limit 1
  `;
  const profile = projects[0];
  if (!profile) {
    const message = 'Niche was not found';
    try {
      await markFailed(nicheId, videos.map((video) => video.id), message);
    } catch (insertErr) {
      console.error('[reanalyze] failed to record analysis error', insertErr);
    }
    throw new Error(message);
  }

  const inputs: VideoAnalysisInput[] = videos.map((video) => ({
    video_ref: video.id,
    caption: video.caption,
    author_handle: video.author_handle,
    author_name: video.author_name,
    views: num(video.views),
    likes: num(video.likes),
    comments: num(video.comments),
    shares: num(video.shares),
    saves: num(video.saves),
    transcript: video.transcript ? video.transcript.slice(0, 1500) : null,
  }));

  const ai = getAIProvider();
  let result: { data: { analyses: VideoAnalysisDraft[] }; model: string };
  try {
    result = await ai.completeJson<{ analyses: VideoAnalysisDraft[] }>({
      task: 'video_analysis',
      system: VIDEO_ANALYSIS_SYSTEM,
      user: videoAnalysisUserPrompt({
        topic: profile.name,
        niche: profile.niche,
        audience: profile.target_audience || profile.audience,
        business: profile.core_business,
        videos: inputs,
      }),
      schemaName: 'video_analyses',
      schema: VIDEO_ANALYSIS_SCHEMA,
      maxTokens: 16000,
      timeoutMs: 180_000,
      promptVersion: PROMPT_VERSION,
      inputSource: {
        run_id: null,
        niche_id: nicheId,
        window: 'reanalyze',
        video_id: videos.length === 1 ? videos[0].id : undefined,
        video_ids: videos.map((video) => video.id),
      },
    });
  } catch (err) {
    const message = errorMessage(err);
    try {
      await markFailed(nicheId, videos.map((video) => video.id), message);
    } catch (insertErr) {
      console.error('[reanalyze] failed to record analysis error', insertErr);
    }
    throw err;
  }

  const byRef = new Map(result.data.analyses.map((item) => [item.video_ref, item]));
  let complete = 0;
  let failed = 0;
  for (const video of videos) {
    const analysis = byRef.get(video.id);
    if (!analysis) {
      await insertAnalysis(sql, null, nicheId, video.id, null, result.model, 'failed', 'Model omitted this video');
      failed += 1;
      continue;
    }
    await insertAnalysis(sql, null, nicheId, video.id, analysis, result.model, 'complete', null);
    complete += 1;
  }
  return { complete, failed };
}

async function pendingVideoIds(nicheId: string): Promise<string[]> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    select rv.video_id as id
    from research_run_videos rv
    join research_runs r on r.id = rv.run_id
    where r.project_id = ${nicheId}
      and not exists (
        select 1 from video_analyses a
        where a.video_id = rv.video_id
          and a.is_latest = true
          and a.status = 'complete'
          and a.prompt_version = ${PROMPT_VERSION}
      )
    group by rv.video_id
    order by rv.video_id
  `;
  return rows.map((row) => row.id);
}

async function nicheIds(nicheId: string | null): Promise<string[]> {
  if (nicheId) return [nicheId];
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    select id from projects where archived_at is null order by name
  `;
  return rows.map((row) => row.id);
}

async function runPool(jobs: ReanalyzeJob[], concurrency: number, current: ReanalyzeStatus): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (index < jobs.length) {
      const job = jobs[index];
      index += 1;
      try {
        const result = await analyzeVideoBatch(job.nicheId, job.videoIds);
        current.done += result.complete;
        current.failed += result.failed;
      } catch (err) {
        console.error('[reanalyze] batch failed', err);
        current.failed += job.videoIds.length;
      }
    }
  });
  await Promise.all(workers);
}

export async function reanalyzeNiche(
  nicheId: string | null,
  options: { concurrency?: number; batch?: number } = {},
): Promise<void> {
  const current = status();
  if (current.running) return;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const batchSize = Math.max(1, options.batch ?? 8);
  current.running = true;
  current.done = 0;
  current.failed = 0;
  current.total = 0;
  current.startedAt = new Date().toISOString();
  try {
    const jobs: ReanalyzeJob[] = [];
    for (const id of await nicheIds(nicheId)) {
      const pending = await pendingVideoIds(id);
      for (const videoIds of chunk(pending, batchSize)) jobs.push({ nicheId: id, videoIds });
    }
    current.total = jobs.reduce((sum, job) => sum + job.videoIds.length, 0);
    await runPool(jobs, concurrency, current);
  } finally {
    current.running = false;
  }
}
