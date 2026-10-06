import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { providerCacheKey, readProviderCache, writeProviderCache } from './cache';
import { InsufficientBalanceError, ScraperUnavailableError } from './errors';
import { normalizeTikHubSearch } from './normalize/tikhub';
import type { NormalizedVideo, ScrapeHandle, ScrapeStartInput, ScraperProvider } from './types';

const ENDPOINT = '/api/v1/tiktok/app/v3/fetch_video_search_result';

function balanceError(status: number, text: string): boolean {
  if (status === 402) return true;
  return /insufficient|not enough|balance|quota exceeded|余额不足|余额不够/i.test(text);
}

export class TikHubProvider implements ScraperProvider {
  id = 'tikhub' as const;

  async start(input: ScrapeStartInput): Promise<ScrapeHandle> {
    const env = getServerEnv();
    if (!env.tikhubApiKey) throw new ScraperUnavailableError('TIKHUB_API_KEY is not configured');
    const params = {
      keyword: input.keyword,
      offset: 0,
      count: input.limit,
      sort_type: 0,
      publish_time: 0,
      region: env.tikhubRegion,
    };
    const key = providerCacheKey('tikhub', ENDPOINT, params);
    const cached = await readProviderCache(key);
    const payload = cached ?? (await this.fetchOnce(env.tikhubBaseUrl, env.tikhubApiKey, params, key));
    return {
      externalRunId: key,
      datasetId: null,
      status: 'succeeded',
      rawMeta: { payload, cacheKey: key },
    };
  }

  async poll(handle: ScrapeHandle): Promise<ScrapeHandle> {
    return { ...handle, status: handle.status === 'failed' ? 'failed' : 'succeeded' };
  }

  async fetchNormalized(handle: ScrapeHandle): Promise<NormalizedVideo[]> {
    const payload = handle.rawMeta?.payload;
    return normalizeTikHubSearch(payload);
  }

  private async fetchOnce(
    baseUrl: string,
    apiKey: string,
    params: Record<string, string | number>,
    key: string,
  ): Promise<unknown> {
    const url = new URL(`${baseUrl}${ENDPOINT}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const text = await response.text();
    if (balanceError(response.status, text)) {
      throw new InsufficientBalanceError(`TikHub balance is insufficient (${response.status})`);
    }
    if (!response.ok) throw new ScraperUnavailableError(`TikHub request failed (${response.status})`);
    let payload: { code?: number; message?: string; message_zh?: string };
    try {
      payload = JSON.parse(text) as { code?: number; message?: string; message_zh?: string };
    } catch {
      throw new ScraperUnavailableError('TikHub returned invalid JSON');
    }
    const message = `${payload.message || ''} ${payload.message_zh || ''}`;
    if (payload.code != null && payload.code !== 200 && balanceError(response.status, message)) {
      throw new InsufficientBalanceError('TikHub balance is insufficient');
    }
    await writeProviderCache(key, 'tikhub', { endpoint: ENDPOINT, ...params }, payload);
    return payload;
  }
}
