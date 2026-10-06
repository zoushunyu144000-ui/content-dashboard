import type { NormalizedVideo } from '../types';
import { pickSubtitle } from '../subtitles';
import { asNumber, asString, canonicalUrl, field, isoFromSeconds, isoFromUnknown } from './shared';

function subtitleFrom(item: Record<string, unknown>): { transcript: string | null; subtitleUrl: string | null } {
  const direct = asString(field(item, 'transcript')) || asString(field(item, 'subtitles'));
  if (direct && !/^https?:\/\//i.test(direct)) return { transcript: direct, subtitleUrl: null };
  const picked = pickSubtitle(field(item, 'videoMeta.subtitleLinks'));
  if (picked.transcript || picked.subtitleUrl) return picked;
  const transcription = asString(field(item, 'videoMeta.transcriptionLink'));
  if (transcription) return { transcript: null, subtitleUrl: transcription };
  if (direct) return { transcript: null, subtitleUrl: direct };
  return { transcript: null, subtitleUrl: null };
}

export function normalizeApifyTikTokItem(item: Record<string, unknown>): NormalizedVideo | null {
  const errorCode = field(item, 'errorCode');
  if (errorCode != null && errorCode !== 0 && errorCode !== '0' && errorCode !== '') return null;

  const platformVideoId = asString(field(item, 'id'));
  const url = asString(field(item, 'webVideoUrl'));
  if (!platformVideoId && !url) return null;

  const media = field(item, 'mediaUrls');
  const mediaUrl = Array.isArray(media) ? asString(media[0]) : null;
  const subtitles = subtitleFrom(item);
  const published =
    isoFromUnknown(field(item, 'createTimeISO')) || isoFromSeconds(field(item, 'createTime'));
  const duration = asNumber(field(item, 'videoMeta.duration'));

  return {
    platform: 'tiktok',
    platformVideoId,
    url,
    canonicalUrl: canonicalUrl(url),
    videoUrl: mediaUrl,
    videoUrlExpiresAt: null,
    embedUrl: platformVideoId ? `https://www.tiktok.com/embed/v2/${platformVideoId}` : null,
    thumbnailUrl: asString(field(item, 'videoMeta.coverUrl')) || asString(field(item, 'videoMeta.originalCoverUrl')),
    caption: asString(field(item, 'text')),
    authorHandle: asString(field(item, 'authorMeta.name')),
    authorName: asString(field(item, 'authorMeta.nickName')),
    authorFollowers: asNumber(field(item, 'authorMeta.fans')),
    views: asNumber(field(item, 'playCount')),
    likes: asNumber(field(item, 'diggCount')),
    comments: asNumber(field(item, 'commentCount')),
    shares: asNumber(field(item, 'shareCount')),
    saves: asNumber(field(item, 'collectCount')),
    durationSeconds: duration == null ? null : Math.round(duration),
    publishedAt: published,
    transcript: subtitles.transcript,
    subtitleUrl: subtitles.subtitleUrl,
    raw: item,
  };
}

export function normalizeApifyTikTokItems(payload: unknown): NormalizedVideo[] {
  const items = Array.isArray(payload) ? payload : [];
  const videos: NormalizedVideo[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const video = normalizeApifyTikTokItem(item as Record<string, unknown>);
    if (video) videos.push(video);
  }
  return videos;
}
