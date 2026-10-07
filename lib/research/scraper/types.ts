export interface NormalizedComment {
  platformCommentId: string;
  text: string;
  likes: number | null;
  author: string | null;
  createdAtPlatform: string | null;
  raw: unknown;
}

export interface NormalizedVideo {
  platform: string;
  platformVideoId: string | null;
  url: string | null;
  canonicalUrl: string | null;
  videoUrl: string | null;
  videoUrlExpiresAt: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  authorHandle: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  transcript: string | null;
  subtitleUrl: string | null;
  raw: unknown;
  collectedComments?: NormalizedComment[];
}

const commentFetchErrors = new WeakMap<NormalizedVideo[], string>();

export function noteCommentFetchError(videos: NormalizedVideo[], message: string): void {
  const trimmed = message.trim().slice(0, 500);
  if (trimmed) commentFetchErrors.set(videos, trimmed);
}

export function readCommentFetchError(videos: NormalizedVideo[]): string | null {
  return commentFetchErrors.get(videos) ?? null;
}

export interface ScrapeStartInput {
  keyword: string;
  platform: string;
  limit: number;
}

export interface ScrapeHandle {
  externalRunId: string;
  datasetId: string | null;
  status: 'running' | 'succeeded' | 'failed';
  error?: string | null;
  rawMeta?: Record<string, unknown> | null;
}

export interface ScraperProvider {
  id: 'apify' | 'tikhub' | 'youtube';
  start(input: ScrapeStartInput): Promise<ScrapeHandle>;
  poll(handle: ScrapeHandle): Promise<ScrapeHandle>;
  fetchNormalized(handle: ScrapeHandle): Promise<NormalizedVideo[]>;
}
