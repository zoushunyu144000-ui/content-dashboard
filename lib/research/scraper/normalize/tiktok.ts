import { createHash } from 'crypto';
import type { NormalizedComment, NormalizedVideo } from '../types';
import { pickSubtitle } from '../subtitles';
import { asNumber, asString, canonicalUrl, field, isoFromSeconds, isoFromUnknown } from './shared';

const INT4_MAX = 2147483647;

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

export function attachApifyComments(videos: NormalizedVideo[], payloads: unknown[]): void {
  const byId = new Map<string, NormalizedVideo>();
  const byUrl = new Map<string, NormalizedVideo>();
  for (const video of videos) {
    if (video.platformVideoId) byId.set(video.platformVideoId, video);
    for (const candidate of [video.canonicalUrl, video.url]) {
      const canon = canonicalUrl(candidate);
      if (canon) byUrl.set(canon, video);
      const id = tiktokVideoId(candidate);
      if (id && !byId.has(id)) byId.set(id, video);
    }
  }

  const seen = new Set<string>();
  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
    const item = payload as Record<string, unknown>;
    const comment = toComment(item);
    if (!comment) continue;
    const video = matchCommentVideo(item, byId, byUrl);
    if (!video) continue;
    const owner = video.platformVideoId || video.canonicalUrl || video.url || '';
    const key = `${owner}:${comment.platformCommentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!video.collectedComments) video.collectedComments = [];
    video.collectedComments.push(comment);
  }
}

function matchCommentVideo(
  item: Record<string, unknown>,
  byId: Map<string, NormalizedVideo>,
  byUrl: Map<string, NormalizedVideo>,
): NormalizedVideo | undefined {
  const aweme = firstId(item, ['awemeId', 'aweme_id', 'videoId', 'video_id']);
  if (aweme && byId.has(aweme)) return byId.get(aweme);
  const urls = urlCandidates(item);
  for (const url of urls) {
    const id = tiktokVideoId(url);
    if (id && byId.has(id)) return byId.get(id);
  }
  for (const url of urls) {
    const canon = canonicalUrl(url);
    if (canon && byUrl.has(canon)) return byUrl.get(canon);
  }
  return undefined;
}

function toComment(item: Record<string, unknown>): NormalizedComment | null {
  const cid = firstId(item, ['cid', 'commentId', 'comment_id']);
  if (!cid && field(item, 'authorMeta') != null) return null;
  const text = firstText(item, ['text', 'comment', 'content', 'commentText']);
  if (!text) return null;
  const aweme = firstId(item, ['awemeId', 'aweme_id', 'videoId', 'video_id']);
  const author = firstText(item, [
    'uniqueId',
    'unique_id',
    'user.uniqueId',
    'user.unique_id',
    'nickname',
    'user.nickname',
  ]);
  const created =
    isoFromUnknown(field(item, 'createTimeISO')) ||
    isoFromUnknown(field(item, 'create_time_iso')) ||
    isoFromSeconds(field(item, 'createTime')) ||
    isoFromSeconds(field(item, 'create_time'));
  return {
    platformCommentId: cid || commentHash(item, text, aweme, author, created),
    text: text.slice(0, 2000),
    likes: likesOf(
      asNumber(field(item, 'diggCount')) ?? asNumber(field(item, 'digg_count')) ?? asNumber(field(item, 'likes')),
    ),
    author: author ? author.slice(0, 200) : null,
    createdAtPlatform: created,
    raw: item,
  };
}

function urlCandidates(item: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const path of ['videoWebUrl', 'video_web_url', 'submittedVideoUrl', 'submitted_video_url', 'webVideoUrl']) {
    const text = asString(field(item, path));
    if (text) urls.push(text);
  }
  return urls;
}

function firstText(item: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const text = asString(field(item, path));
    if (text) return text;
  }
  return null;
}

function firstId(item: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const value = field(item, path);
    const text = asString(value);
    if (text) return text;
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  }
  return null;
}

function tiktokVideoId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

function likesOf(value: number | null): number | null {
  if (value == null) return null;
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return null;
  if (rounded < 0) return 0;
  if (rounded > INT4_MAX) return INT4_MAX;
  return rounded;
}

function commentHash(
  item: Record<string, unknown>,
  text: string,
  aweme: string | null,
  author: string | null,
  created: string | null,
): string {
  const reply = firstId(item, ['repliesToId', 'replies_to_id']) || '';
  const basis = [aweme || '', reply, author || '', created || '', text].join('|');
  return `h:${createHash('sha1').update(basis).digest('hex').slice(0, 24)}`;
}
