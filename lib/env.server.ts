import 'server-only';

function str(name: string): string | undefined {
  const value = process.env[name];
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function int(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function flag(name: string): boolean {
  const value = str(name);
  return value === '1' || value === 'true';
}

export type ScraperName = 'apify' | 'tikhub' | 'youtube' | 'auto';

export function getServerEnv() {
  const scraper = str('SCRAPER_PROVIDER') || 'apify';
  return {
    databaseUrl: str('DATABASE_URL'),
    adminEmail: str('ADMIN_EMAIL')?.toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD?.trim() || undefined,
    adminResetPassword: flag('ADMIN_RESET_PASSWORD'),
    sessionSecret: str('SESSION_SECRET'),
    workerSecret: str('WORKER_SECRET'),
    aiBaseUrl: str('AI_BASE_URL'),
    aiApiKey: str('AI_API_KEY'),
    aiModel: str('AI_MODEL'),
    aiProvider: str('AI_PROVIDER') || 'openai-compatible',
    aiBatchSize: Math.max(1, int('AI_BATCH_SIZE', 8)),
    aiAnalysisLimit: Math.max(1, int('AI_ANALYSIS_LIMIT', 30)),
    scraperProvider: (['apify', 'tikhub', 'youtube', 'auto'].includes(scraper) ? scraper : 'apify') as ScraperName,
    apifyToken: str('APIFY_TOKEN'),
    apifyTiktokActor: str('APIFY_TIKTOK_ACTOR') || 'clockworks/tiktok-scraper',
    apifyMaxResultsPerRun: Math.max(1, int('APIFY_MAX_RESULTS_PER_RUN', 30)),
    apifyResultsPerKeyword: Math.max(1, int('APIFY_RESULTS_PER_KEYWORD', 10)),
    apifyMaxKeywordsPerRun: Math.max(1, int('APIFY_MAX_KEYWORDS_PER_RUN', 3)),
    tikhubApiKey: str('TIKHUB_API_KEY'),
    tikhubBaseUrl: (str('TIKHUB_BASE_URL') || 'https://api.tikhub.io').replace(/\/$/, ''),
    tikhubMaxRequestsPerRun: Math.max(1, int('TIKHUB_MAX_REQUESTS_PER_RUN', 2)),
    tikhubResultsPerRequest: Math.max(1, int('TIKHUB_RESULTS_PER_REQUEST', 20)),
    tikhubRegion: str('TIKHUB_REGION') || 'US',
    tikhubAutoFallback: flag('TIKHUB_AUTO_FALLBACK'),
    youtubeProviderEnabled: flag('YOUTUBE_PROVIDER_ENABLED'),
  };
}
