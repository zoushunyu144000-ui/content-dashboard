import type { NormalizedVideo } from '../types';
import { asNumber, asString } from './shared';

export interface YouTubeFlatEntry {
  id?: unknown;
  title?: unknown;
  duration?: unknown;
  view_count?: unknown;
  channel?: unknown;
  url?: unknown;
}

export function normalizeYouTubeFlatEntry(entry: YouTubeFlatEntry): NormalizedVideo | null {
  const id = asString(entry.id);
  if (!id) return null;
  const duration = asNumber(entry.duration);
  const shorts = duration == null || duration <= 60;
  const url = shorts ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  return {
    platform: 'youtube',
    platformVideoId: id,
    url,
    canonicalUrl: url,
    videoUrl: null,
    videoUrlExpiresAt: null,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    caption: asString(entry.title),
    authorHandle: null,
    authorName: asString(entry.channel),
    authorFollowers: null,
    views: asNumber(entry.view_count),
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    durationSeconds: duration == null ? null : Math.round(duration),
    publishedAt: null,
    transcript: null,
    subtitleUrl: null,
    raw: entry,
  };
}

export function normalizeYouTubeFlatPlaylist(payload: unknown): NormalizedVideo[] {
  const entries = payload && typeof payload === 'object' ? (payload as { entries?: unknown }).entries : null;
  if (!Array.isArray(entries)) return [];
  const videos: NormalizedVideo[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const video = normalizeYouTubeFlatEntry(entry as YouTubeFlatEntry);
    if (video) videos.push(video);
  }
  return videos;
}
