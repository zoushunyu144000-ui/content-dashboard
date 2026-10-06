import type { NormalizedVideo } from '../types';
import { asNumber, asString, canonicalUrl, isoFromSeconds } from './shared';

function firstUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const list = (value as { url_list?: unknown }).url_list;
  if (!Array.isArray(list)) return null;
  for (const entry of list) {
    const url = asString(entry);
    if (url) return url;
  }
  return null;
}

function playUrl(video: Record<string, unknown> | null): string | null {
  const playAddr = video?.play_addr;
  if (!playAddr || typeof playAddr !== 'object') return null;
  const list = (playAddr as { url_list?: unknown }).url_list;
  if (!Array.isArray(list)) return null;
  for (const entry of list) {
    const url = asString(entry);
    if (!url) continue;
    try {
      if (new URL(url).host.includes('tiktokcdn')) return url;
    } catch {
      if (url.includes('tiktokcdn')) return url;
    }
  }
  return null;
}

function awemeList(payload: unknown): Record<string, unknown>[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  const search = Array.isArray(data.search_item_list) ? data.search_item_list : [];
  const fromSearch = search
    .map((item) => (item && typeof item === 'object' ? (item as { aweme_info?: unknown }).aweme_info : null))
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  if (fromSearch.length > 0) return fromSearch;
  const aweme = Array.isArray(data.aweme_list) ? data.aweme_list : [];
  return aweme.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

export function normalizeTikHubAweme(item: Record<string, unknown>, now = new Date()): NormalizedVideo | null {
  const platformVideoId = asString(item.aweme_id);
  if (!platformVideoId) return null;
  const author = item.author && typeof item.author === 'object' ? (item.author as Record<string, unknown>) : {};
  const stats = item.statistics && typeof item.statistics === 'object' ? (item.statistics as Record<string, unknown>) : {};
  const video = item.video && typeof item.video === 'object' ? (item.video as Record<string, unknown>) : null;
  const handle = asString(author.unique_id);
  const url = handle
    ? `https://www.tiktok.com/@${handle}/video/${platformVideoId}`
    : `https://www.tiktok.com/video/${platformVideoId}`;
  const durationMs = asNumber(video?.duration);
  const play = playUrl(video);
  const cla = video?.cla_info && typeof video.cla_info === 'object' ? (video.cla_info as Record<string, unknown>) : null;
  const captions = Array.isArray(cla?.caption_infos) ? cla.caption_infos : [];
  const firstCaption = captions.find((entry) => entry && typeof entry === 'object') as { url?: unknown } | undefined;
  const subtitleUrl = asString(firstCaption?.url);
  const expires = play ? new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString() : null;

  return {
    platform: 'tiktok',
    platformVideoId,
    url,
    canonicalUrl: canonicalUrl(url),
    videoUrl: play,
    videoUrlExpiresAt: expires,
    embedUrl: `https://www.tiktok.com/embed/v2/${platformVideoId}`,
    thumbnailUrl: firstUrl(video?.cover) || firstUrl(video?.origin_cover),
    caption: asString(item.desc),
    authorHandle: handle,
    authorName: asString(author.nickname),
    authorFollowers: asNumber(author.follower_count),
    views: asNumber(stats.play_count),
    likes: asNumber(stats.digg_count),
    comments: asNumber(stats.comment_count),
    shares: asNumber(stats.share_count),
    saves: asNumber(stats.collect_count),
    durationSeconds: durationMs == null ? null : Math.round(durationMs / 1000),
    publishedAt: isoFromSeconds(item.create_time),
    transcript: null,
    subtitleUrl,
    raw: item,
  };
}

export function normalizeTikHubSearch(payload: unknown, now = new Date()): NormalizedVideo[] {
  const videos: NormalizedVideo[] = [];
  for (const item of awemeList(payload)) {
    const video = normalizeTikHubAweme(item, now);
    if (video) videos.push(video);
  }
  return videos;
}
