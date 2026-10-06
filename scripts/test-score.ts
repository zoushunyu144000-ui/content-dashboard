import { scoreVideos, type ScoreInput } from '../lib/research/score';

const now = new Date('2026-10-07T00:00:00.000Z');

function video(partial: Partial<ScoreInput> & Pick<ScoreInput, 'id'>): ScoreInput {
  return {
    platform: 'tiktok',
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    authorFollowers: null,
    publishedAt: now.toISOString(),
    ...partial,
  };
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error('FAIL', message);
    process.exitCode = 1;
  } else {
    console.log('ok', message);
  }
}

const base = scoreVideos(
  [
    video({
      id: 'zeros',
      views: 1000,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      authorFollowers: 1000,
    }),
    video({
      id: 'strong',
      views: 10_000,
      likes: 500,
      comments: 50,
      shares: 20,
      saves: 10,
      authorFollowers: 1000,
    }),
    video({
      id: 'views-only',
      platform: 'youtube',
      views: 80_000,
      publishedAt: null,
    }),
  ],
  undefined,
  now,
);

const zeros = base.find((row) => row.id === 'zeros')!;
const strong = base.find((row) => row.id === 'strong')!;
const viewsOnly = base.find((row) => row.id === 'views-only')!;

assert(zeros.engagementScore === 0, 'explicit zeros keep an engagement component');
assert(zeros.scoreComponents.compressed.engagement === 0, 'explicit zero interactions compress to ln(1+0)');
assert(strong.viralScore > zeros.viralScore, 'higher raw ranks above zeros');
assert(viewsOnly.viralScore < zeros.viralScore, 'views-only ranks below real components');
assert(viewsOnly.engagementScore === null, 'views-only drops engagement');
assert(viewsOnly.outlierScore === null, 'views-only drops outlier');
assert(viewsOnly.freshnessScore === null, 'views-only drops freshness');
assert(viewsOnly.scoreComponents.viewsOnly === true, 'views-only flag is set');
assert(Number.isFinite(viewsOnly.viralScore), 'views-only still has a finite viral score');

const omitted = scoreVideos(
  [
    video({ id: 'null-share', views: 1000, likes: 10, comments: null, shares: null, saves: null, authorFollowers: 1000 }),
    video({ id: 'zero-share', views: 1000, likes: 10, comments: 0, shares: 0, saves: 0, authorFollowers: 1000 }),
  ],
  undefined,
  now,
);
assert(
  omitted[0].scoreComponents.engagementRate === omitted[1].scoreComponents.engagementRate,
  'null interactions and explicit zeros produce the same engagement sum',
);

const dropped = scoreVideos(
  [video({ id: 'no-interactions', views: 5000, authorFollowers: 2000 })],
  undefined,
  now,
)[0];
assert(dropped.engagementScore === null, 'all-null interactions drop engagement');
assert(dropped.scoreComponents.weightsUsed.engagement === 0, 'dropped engagement weight is zero');
assert(
  Math.abs(
    dropped.scoreComponents.weightsUsed.outlier + dropped.scoreComponents.weightsUsed.freshness - 1,
  ) < 1e-9,
  'remaining weights renormalize to 1',
);

const floor = scoreVideos(
  [video({ id: 'floor', views: 1000, likes: 1, authorFollowers: 0 })],
  undefined,
  now,
)[0];
assert(floor.scoreComponents.outlierRatio === 1, 'follower count 0 uses the follower floor');

const noFollowers = scoreVideos(
  [video({ id: 'no-followers', views: 1000, likes: 1, authorFollowers: null })],
  undefined,
  now,
)[0];
assert(noFollowers.outlierScore === null, 'null followers drop outlier');

const noDate = scoreVideos(
  [video({ id: 'no-date', views: 1000, likes: 1, authorFollowers: 1000, publishedAt: null })],
  undefined,
  now,
)[0];
assert(noDate.freshnessScore === null, 'null published_at drops freshness');

const single = scoreVideos(
  [video({ id: 'solo', views: 500, likes: 1, authorFollowers: 1000 })],
  undefined,
  now,
)[0];
assert(single.viralScore === 100, 'a single video takes the top percentile');
assert(single.isHighPotential === false, 'views under 1000 are not high potential');

const youtube = Array.from({ length: 8 }, (_, index) =>
  video({
    id: `yt-${index}`,
    platform: 'youtube',
    views: index + 1,
    publishedAt: null,
  }),
);
const mixed = scoreVideos(
  [
    ...youtube,
    video({ id: 'tk-a', views: 50_000, likes: 2000, comments: 100, shares: 40, saves: 20, authorFollowers: 1000 }),
    video({ id: 'tk-b', views: 40_000, likes: 1500, comments: 80, shares: 30, saves: 10, authorFollowers: 1000 }),
  ],
  undefined,
  now,
);
const topYt = mixed.find((row) => row.id === 'yt-7')!;
assert(topYt.scoreComponents.platformPercentile === 1, 'platform percentile applies once a platform has 8 videos');
assert(topYt.viralScore === 100, 'viral score uses the higher of global and platform percentiles');
assert(topYt.scoreComponents.globalPercentile != null && topYt.scoreComponents.globalPercentile < 1, 'global percentile is lower than the platform percentile');

console.log(
  JSON.stringify(
    {
      zeros: zeros.viralScore,
      strong: strong.viralScore,
      viewsOnly: viewsOnly.viralScore,
      droppedWeights: dropped.scoreComponents.weightsUsed,
      topYt: topYt.viralScore,
    },
    null,
    2,
  ),
);

if (process.exitCode) {
  console.error('score tests failed');
} else {
  console.log('score tests passed');
}
