import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { providerCacheKey, readProviderCache, writeProviderCache } from './cache';
import { ScraperUnavailableError } from './errors';
import { attachApifyComments, normalizeApifyTikTokItems } from './normalize/tiktok';
import {
  noteCommentFetchError,
  type NormalizedVideo,
  type ScrapeHandle,
  type ScrapeStartInput,
  type ScraperProvider,
} from './types';

const FAILED = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT']);

export class ApifyProvider implements ScraperProvider {
  id = 'apify' as const;

  async start(input: ScrapeStartInput): Promise<ScrapeHandle> {
    const env = getServerEnv();
    if (!env.apifyToken) throw new ScraperUnavailableError('APIFY_TOKEN is not configured');
    const actor = env.apifyTiktokActor.replace(/\//g, '~');
    const limit = Math.max(1, input.limit);
    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?maxItems=${limit}&timeout=300`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.apifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchQueries: [input.keyword],
          searchSection: '/video',
          resultsPerPage: limit,
          commentsPerPost: env.apifyCommentsPerPost,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
          shouldDownloadAvatars: false,
          shouldDownloadMusicCovers: false,
          shouldDownloadSlideshowImages: false,
          proxyCountryCode: 'None',
        }),
      },
    );
    if (!response.ok) throw new ScraperUnavailableError(`Apify start failed (${response.status})`);
    const payload = (await response.json()) as { data?: { id?: string; defaultDatasetId?: string; status?: string } };
    const runId = payload.data?.id;
    if (!runId) throw new ScraperUnavailableError('Apify did not return a run id');
    return {
      externalRunId: runId,
      datasetId: payload.data?.defaultDatasetId || null,
      status: 'running',
      rawMeta: { apifyStatus: payload.data?.status || 'READY' },
    };
  }

  async poll(handle: ScrapeHandle): Promise<ScrapeHandle> {
    const env = getServerEnv();
    if (!env.apifyToken) throw new ScraperUnavailableError('APIFY_TOKEN is not configured');
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(handle.externalRunId)}`, {
      headers: { Authorization: `Bearer ${env.apifyToken}` },
    });
    if (!response.ok) throw new ScraperUnavailableError(`Apify poll failed (${response.status})`);
    const payload = (await response.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const apifyStatus = payload.data?.status || 'RUNNING';
    const datasetId = payload.data?.defaultDatasetId || handle.datasetId;
    if (apifyStatus === 'SUCCEEDED') {
      return { ...handle, datasetId, status: 'succeeded', rawMeta: { ...(handle.rawMeta || {}), apifyStatus } };
    }
    if (FAILED.has(apifyStatus)) {
      return {
        ...handle,
        datasetId,
        status: 'failed',
        error: `Apify run ${apifyStatus}`,
        rawMeta: { ...(handle.rawMeta || {}), apifyStatus },
      };
    }
    return { ...handle, datasetId, status: 'running', rawMeta: { ...(handle.rawMeta || {}), apifyStatus } };
  }

  async fetchNormalized(handle: ScrapeHandle): Promise<NormalizedVideo[]> {
    if (!handle.datasetId) return [];
    const env = getServerEnv();
    if (!env.apifyToken) throw new ScraperUnavailableError('APIFY_TOKEN is not configured');
    const endpoint = `/v2/datasets/${handle.datasetId}/items`;
    const key = providerCacheKey('apify', endpoint, { clean: true });
    const cached = await readProviderCache(key);
    const items = cached ?? (await this.fetchItems(handle.datasetId, env.apifyToken, key));
    const videos = normalizeApifyTikTokItems(items);
    if (env.apifyCommentsPerPost > 0) {
      const { payloads, error } = await this.fetchCommentPayloads(items, env.apifyToken);
      attachApifyComments(videos, payloads);
      if (error) noteCommentFetchError(videos, error);
    }
    return videos;
  }

  private async fetchItems(datasetId: string, token: string, key: string): Promise<unknown> {
    const response = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new ScraperUnavailableError(`Apify dataset fetch failed (${response.status})`);
    const items = await response.json();
    await writeProviderCache(key, 'apify', { datasetId, clean: true }, items);
    return items;
  }

  private async fetchCommentPayloads(
    items: unknown,
    token: string,
  ): Promise<{ payloads: unknown[]; error: string | null }> {
    const payloads: unknown[] = [];
    const errors: string[] = [];
    for (const target of commentDatasetTargets(asItems(items))) {
      try {
        const key = providerCacheKey('apify', target.endpoint, { format: 'json', clean: 1 });
        let cached: unknown = null;
        try {
          cached = await readProviderCache(key);
        } catch (err) {
          console.error('[apify] comment cache read failed', err);
        }
        const body = cached ?? (await this.fetchCommentUrl(target.url, token, key));
        payloads.push(...asItems(body));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'comment dataset fetch failed');
      }
    }
    return { payloads, error: errors.length ? errors.join('; ').slice(0, 500) : null };
  }

  private async fetchCommentUrl(url: string, token: string, key: string): Promise<unknown> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Apify comments dataset failed (${response.status})`);
    const items = await response.json();
    try {
      await writeProviderCache(key, 'apify', { url, format: 'json', clean: 1 }, items);
    } catch (err) {
      console.error('[apify] comment cache write failed', err);
    }
    return items;
  }
}

function asItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  return [];
}

function commentDatasetTargets(items: unknown[]): { url: string; endpoint: string }[] {
  const seen = new Set<string>();
  const targets: { url: string; endpoint: string }[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const rawValue = record.commentsDatasetUrl ?? record.commentsDatasetURL;
    if (typeof rawValue !== 'string') continue;
    const raw = rawValue.trim();
    if (!raw) continue;
    const url = commentsJsonUrl(raw);
    if (!url) continue;
    const id = datasetIdFrom(raw);
    const dedupe = id || url;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    targets.push({
      url,
      endpoint: id ? `/v2/datasets/${id}/items` : url,
    });
  }
  return targets;
}

function commentsJsonUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.searchParams.set('format', 'json');
    url.searchParams.set('clean', '1');
    return url.toString();
  } catch {
    const id = datasetIdFrom(raw);
    if (!id) return null;
    return `https://api.apify.com/v2/datasets/${encodeURIComponent(id)}/items?format=json&clean=1`;
  }
}

function datasetIdFrom(raw: string): string | null {
  const match = raw.match(/datasets\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
