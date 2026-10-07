import fs from 'fs';
import { attachApifyComments, normalizeApifyTikTokItem, normalizeApifyTikTokItems } from '../lib/research/scraper/normalize/tiktok';
import { normalizeTikHubAweme, normalizeTikHubSearch } from '../lib/research/scraper/normalize/tikhub';
import { normalizeYouTubeFlatEntry } from '../lib/research/scraper/normalize/youtube';

const apifyPath = '/workspace/content-intel/samples/apify-tiktok-web-design.json';
const tikhubPath = '/workspace/content-intel/samples/tikhub-tiktok-web-design.json';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error('FAIL', message);
    process.exitCode = 1;
  } else {
    console.log('ok', message);
  }
}

const apifyRaw = JSON.parse(fs.readFileSync(apifyPath, 'utf8')) as unknown[];
const apify = normalizeApifyTikTokItems([
  ...apifyRaw,
  { id: 'bad', errorCode: 'unavailable', webVideoUrl: 'https://www.tiktok.com/@x/video/bad', text: 'skip me' },
  { 'authorMeta.name': 'flat_author', 'authorMeta.nickName': 'Flat', 'authorMeta.fans': '12', id: 'flat-1', webVideoUrl: 'https://www.tiktok.com/@flat_author/video/flat-1?lang=en', text: 'flat', playCount: '15', diggCount: 0 },
]);
assert(apify.length === apifyRaw.length + 1, 'apify sample normalizes and skips errorCode items');
const firstApify = apify[0];
assert(firstApify.platformVideoId === '7488747692458528046', 'apify id maps to platformVideoId');
assert(firstApify.authorHandle === 'rosievisionstudio', 'apify authorMeta.name maps to authorHandle');
assert(firstApify.authorName === 'Rosie Vision', 'apify authorMeta.nickName maps to authorName');
assert(firstApify.views === 737400, 'apify playCount maps to views');
assert(firstApify.likes === 53400, 'apify diggCount maps to likes');
assert(firstApify.durationSeconds === 17, 'apify videoMeta.duration maps to durationSeconds');
assert(firstApify.canonicalUrl === 'https://www.tiktok.com/@rosievisionstudio/video/7488747692458528046', 'canonical url drops the query');
assert(firstApify.embedUrl === 'https://www.tiktok.com/embed/v2/7488747692458528046', 'apify embed url');
assert(firstApify.videoUrl === null, 'empty mediaUrls stays null');
assert(!apify.some((video) => video.platformVideoId === 'bad'), 'errorCode item is skipped');
const flat = apify.find((video) => video.platformVideoId === 'flat-1');
assert(flat?.authorHandle === 'flat_author' && flat.views === 15 && flat.likes === 0, 'flat authorMeta keys and numeric strings work');
assert(flat?.canonicalUrl?.includes('?') === false, 'flat canonical url strips the query');
const englishFirst = normalizeApifyTikTokItem({
  id: 'sub-en',
  webVideoUrl: 'https://www.tiktok.com/@a/video/sub-en',
  videoMeta: {
    subtitleLinks: [
      { language: 'spa-ES', downloadLink: 'https://cdn.example/es.vtt' },
      { language: 'eng-US', downloadLink: 'https://cdn.example/en.vtt' },
    ],
  },
});
assert(englishFirst?.subtitleUrl === 'https://cdn.example/en.vtt', 'apify prefers eng-US downloadLink');
assert(englishFirst?.transcript === null, 'apify subtitle link is fetched later');
const firstTrack = normalizeApifyTikTokItem({
  id: 'sub-first',
  webVideoUrl: 'https://www.tiktok.com/@a/video/sub-first',
  videoMeta: {
    subtitleLinks: [
      { language: 'fra-FR', downloadLink: 'https://cdn.example/fr.vtt' },
      { language: 'deu-DE', downloadLink: 'https://cdn.example/de.vtt' },
    ],
  },
});
assert(firstTrack?.subtitleUrl === 'https://cdn.example/fr.vtt', 'apify falls back to the first subtitle link');

const commented = normalizeApifyTikTokItems([
  { id: '111', webVideoUrl: 'https://www.tiktok.com/@a/video/111', text: 'cap' },
  { id: '222', webVideoUrl: 'https://www.tiktok.com/@b/video/222?lang=en', text: 'other' },
]);
attachApifyComments(commented, [
  { text: 'nice', diggCount: 4, awemeId: '111', cid: 'c1', uniqueId: 'bob', createTimeISO: '2024-01-02T00:00:00.000Z', repliesToId: null },
  { text: 'nice', diggCount: 4, awemeId: '111', cid: 'c1', uniqueId: 'bob' },
  { text: 'other video', diggCount: 1, awemeId: '999', cid: 'c2' },
  { text: 'via url', diggCount: 9, videoWebUrl: 'https://www.tiktok.com/@b/video/222?lang=en', cid: 'c3', uniqueId: 'ann' },
  { text: 'reply', diggCount: 2, submittedVideoUrl: 'https://www.tiktok.com/@a/video/111', repliesToId: 'c1', uniqueId: 'cara' },
  { authorMeta: { name: 'video' }, text: 'not a comment', playCount: 10 },
]);
const firstComments = commented[0]?.collectedComments ?? [];
const secondComments = commented[1]?.collectedComments ?? [];
assert(firstComments.length === 2, 'comments map by aweme id and dedupe cid');
assert(firstComments[0]?.platformCommentId === 'c1' && firstComments[0]?.likes === 4 && firstComments[0]?.author === 'bob', 'comment cid, likes, and author');
assert(firstComments[0]?.createdAtPlatform === '2024-01-02T00:00:00.000Z', 'createTimeISO maps to createdAtPlatform');
assert(firstComments[1]?.text === 'reply' && firstComments[1]?.platformCommentId.startsWith('h:'), 'reply without cid still maps and gets a stable id');
assert(secondComments.length === 1 && secondComments[0]?.text === 'via url' && secondComments[0]?.likes === 9, 'comment maps by video url');
assert(!commented.some((video) => video.collectedComments?.some((comment) => comment.text === 'other video')), 'unmatched aweme id is dropped');
assert(!commented.some((video) => video.collectedComments?.some((comment) => comment.text === 'not a comment')), 'video-shaped rows are not stored as comments');

const fixedNow = new Date('2026-10-07T00:00:00.000Z');
const tikhubRaw = JSON.parse(fs.readFileSync(tikhubPath, 'utf8'));
const tikhub = normalizeTikHubSearch(tikhubRaw, fixedNow);
assert(tikhub.length === 20, 'tikhub sample yields 20 videos');
const firstTik = tikhub[0];
assert(firstTik.platformVideoId === '7686491874919566625', 'tikhub aweme_id');
assert(firstTik.authorHandle === 'neuwebstudio', 'tikhub unique_id');
assert(firstTik.authorName === 'Neu Web Studio', 'tikhub nickname');
assert(firstTik.authorFollowers === 174172, 'tikhub follower_count');
assert(firstTik.views === 5683 && firstTik.likes === 318 && firstTik.comments === 3 && firstTik.shares === 13 && firstTik.saves === 191, 'tikhub statistics');
assert(firstTik.durationSeconds === 9, 'tikhub duration milliseconds convert to seconds');
assert(firstTik.url === 'https://www.tiktok.com/@neuwebstudio/video/7686491874919566625', 'tikhub canonical watch url');
assert(firstTik.embedUrl === 'https://www.tiktok.com/embed/v2/7686491874919566625', 'tikhub embed url');
assert(firstTik.videoUrl?.includes('tiktokcdn') === true, 'tikhub play url is a tiktokcdn address');
assert(!firstTik.videoUrl?.includes('api16-normal'), 'tikhub skips the non-cdn play url');
assert(firstTik.videoUrlExpiresAt === new Date(fixedNow.getTime() + 5 * 60 * 60 * 1000).toISOString(), 'signed play url expires in 5 hours');
assert(firstTik.publishedAt === new Date(1789650855 * 1000).toISOString(), 'tikhub create_time');
assert(firstTik.transcript === null, 'transcript is left for a later WebVTT fetch');
const withCaptions = tikhub.filter((video) => video.subtitleUrl).length;
assert(withCaptions === 9, 'nine TikHub items expose a caption url');
const englishCaption = normalizeTikHubAweme({
  aweme_id: '111',
  author: { unique_id: 'a' },
  video: {
    cla_info: {
      caption_infos: [
        { lang: 'spa-ES', url: 'https://cdn.example/es.vtt' },
        { lang: 'eng-US', url: 'https://cdn.example/en.vtt' },
      ],
    },
  },
}, fixedNow);
assert(englishCaption?.subtitleUrl === 'https://cdn.example/en.vtt', 'tikhub prefers eng-US caption url');
assert(englishCaption?.transcript === null, 'tikhub transcript stays null until the WebVTT download');
const firstCaption = normalizeTikHubAweme({
  aweme_id: '222',
  video: {
    cla_info: {
      caption_infos: [
        { lang: 'fra-FR', url: 'https://cdn.example/fr.vtt' },
        { language_code: 'deu-DE', url: 'https://cdn.example/de.vtt' },
      ],
    },
  },
}, fixedNow);
assert(firstCaption?.subtitleUrl === 'https://cdn.example/fr.vtt', 'tikhub falls back to the first caption url');

const short = normalizeYouTubeFlatEntry({ id: 'abc123xyz01', title: 'Short', duration: 45, view_count: 1200, channel: 'Desk' });
assert(short?.url === 'https://www.youtube.com/shorts/abc123xyz01', 'duration <= 60 uses shorts url');
assert(short?.likes === null && short?.authorFollowers === null && short?.publishedAt === null, 'youtube flat metrics that are unknown stay null');
assert(short?.views === 1200, 'youtube flat view_count is kept');
assert(short?.embedUrl === 'https://www.youtube.com/embed/abc123xyz01', 'youtube embed url');
assert(short?.thumbnailUrl === 'https://i.ytimg.com/vi/abc123xyz01/hqdefault.jpg', 'youtube thumbnail');
const watch = normalizeYouTubeFlatEntry({ id: 'abc123xyz01', duration: 90, view_count: 10 });
assert(watch?.url === 'https://www.youtube.com/watch?v=abc123xyz01', 'duration over 60 uses watch url');
assert(normalizeYouTubeFlatEntry({ title: 'missing id' }) === null, 'youtube entry without an id is skipped');

console.log(
  JSON.stringify(
    {
      apify: apify.length,
      tikhub: tikhub.length,
      captions: withCaptions,
      firstApify: firstApify.platformVideoId,
      firstTikhub: firstTik.platformVideoId,
    },
    null,
    2,
  ),
);

if (process.exitCode) console.error('normalize tests failed');
else console.log('normalize tests passed');
