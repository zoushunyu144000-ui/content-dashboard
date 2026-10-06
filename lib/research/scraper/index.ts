import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import { ApifyProvider } from './apify';
import { ScraperUnavailableError } from './errors';
import { TikHubProvider } from './tikhub';
import type { ScraperProvider } from './types';
import { YouTubeShortsProvider } from './youtube';

export type ScraperName = 'apify' | 'tikhub' | 'youtube' | 'auto';
export type ConcreteScraper = 'apify' | 'tikhub' | 'youtube';

export function normalizeProviderName(name: string | null | undefined): ScraperName {
  if (name === 'apify' || name === 'tikhub' || name === 'youtube' || name === 'auto') return name;
  return getServerEnv().scraperProvider;
}

export function providerChain(requested?: string | null): ConcreteScraper[] {
  const env = getServerEnv();
  const name = normalizeProviderName(requested || env.scraperProvider);
  let start: ConcreteScraper = name === 'auto' ? 'apify' : name;
  if (start === 'youtube' && !env.youtubeProviderEnabled) start = 'apify';
  const order: ConcreteScraper[] = ['apify', 'tikhub', 'youtube'];
  return order.slice(order.indexOf(start)).filter((provider) => {
    if (provider === 'youtube') return env.youtubeProviderEnabled;
    if (provider !== 'tikhub') return true;
    if (start === 'tikhub') return true;
    return env.tikhubAutoFallback;
  });
}

export function getScraperProvider(name?: string | null): ScraperProvider {
  const resolved = normalizeProviderName(name);
  const concrete: ConcreteScraper = resolved === 'auto' ? 'apify' : resolved;
  if (concrete === 'apify') return new ApifyProvider();
  if (concrete === 'tikhub') return new TikHubProvider();
  if (!getServerEnv().youtubeProviderEnabled) {
    throw new ScraperUnavailableError('YouTube Shorts is unavailable on this server');
  }
  return new YouTubeShortsProvider();
}

export function keywordLimit(provider: ConcreteScraper): number {
  const env = getServerEnv();
  if (provider === 'apify') return env.apifyMaxKeywordsPerRun;
  if (provider === 'tikhub') return env.tikhubMaxRequestsPerRun;
  return 5;
}

export function resultLimit(provider: ConcreteScraper, keywordIndex: number): number {
  const env = getServerEnv();
  if (provider === 'apify') {
    const used = keywordIndex * env.apifyResultsPerKeyword;
    const remaining = env.apifyMaxResultsPerRun - used;
    return Math.max(0, Math.min(env.apifyResultsPerKeyword, remaining));
  }
  if (provider === 'tikhub') return env.tikhubResultsPerRequest;
  return 20;
}
