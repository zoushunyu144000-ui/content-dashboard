import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { providerCacheKey, readProviderCache, writeProviderCache } from './cache';
import { ScraperUnavailableError } from './errors';
import { normalizeApifyTikTokItems } from './normalize/tiktok';
import type { NormalizedVideo, ScrapeHandle, ScrapeStartInput, ScraperProvider } from './types';

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
    return normalizeApifyTikTokItems(items);
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
}
