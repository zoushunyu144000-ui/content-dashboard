import { DEFAULT_VIRAL_SCORE_CONFIG, resolveViralScoreConfig, type ViralScoreConfig } from './config';

export interface ScoreInput {
  id: string;
  platform: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  authorFollowers: number | null;
  publishedAt: string | Date | null;
}

export interface ScoreComponents {
  engagementRate: number | null;
  outlierRatio: number | null;
  freshness: number | null;
  compressed: { engagement: number | null; outlier: number | null; freshness: number | null };
  weightsUsed: { engagement: number; outlier: number; freshness: number };
  raw: number;
  /** Views-only rows use a tiny raw value so they still rank by views and stay below real components. */
  viewsOnly: boolean;
  globalPercentile: number;
  platformPercentile: number | null;
}

export interface ScoreResult {
  id: string;
  /** 0–100 percentile of the compressed component, or null when that component was dropped. */
  engagementScore: number | null;
  outlierScore: number | null;
  freshnessScore: number | null;
  viralScore: number;
  isHighPotential: boolean;
  scoreComponents: ScoreComponents;
}

interface Parts {
  engagement: number | null;
  outlier: number | null;
  freshness: number | null;
  engagementRate: number | null;
  outlierRatio: number | null;
  freshnessRaw: number | null;
  weightsUsed: { engagement: number; outlier: number; freshness: number };
  raw: number;
  viewsOnly: boolean;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Mid-rank percentile in [0, 1]. A single value is 1 so a one-video run can still score.
 * Ties share the average of the ranks they occupy.
 */
export function percentile(value: number, values: number[]): number {
  const n = values.length;
  if (n <= 1) return 1;
  let below = 0;
  let ties = 0;
  for (const other of values) {
    if (other < value) below += 1;
    else if (other === value) ties += 1;
  }
  return (below + (ties - 1) / 2) / (n - 1);
}

function freshnessValue(publishedAt: string | Date | null, now: Date, halfLifeHours: number): number | null {
  if (!publishedAt) return null;
  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  const ageHours = Math.max(0, (now.getTime() - published.getTime()) / 3_600_000);
  return Math.exp((-Math.LN2 * ageHours) / halfLifeHours);
}

function partsFor(video: ScoreInput, config: ViralScoreConfig, now: Date): Parts {
  const views = finite(video.views);
  const likes = finite(video.likes);
  const comments = finite(video.comments);
  const shares = finite(video.shares);
  const saves = finite(video.saves);
  const followers = finite(video.authorFollowers);
  const anyInteraction = [likes, comments, shares, saves].some((value) => value != null);

  let engagementRate: number | null = null;
  let engagement: number | null = null;
  // Missing interactions are omitted from the sum. If every interaction is null, drop the
  // component instead of treating the rate as zero. Explicit zeros stay in the sum.
  if (views != null && anyInteraction) {
    const w = config.interactionWeights;
    let sum = 0;
    if (likes != null) sum += w.likes * likes;
    if (comments != null) sum += w.comments * comments;
    if (shares != null) sum += w.shares * shares;
    if (saves != null) sum += w.saves * saves;
    engagementRate = sum / Math.max(views, 1);
    engagement = Math.log(1 + engagementRate * 1000);
  }

  let outlierRatio: number | null = null;
  let outlier: number | null = null;
  if (views != null && followers != null) {
    outlierRatio = views / Math.max(followers, config.followerFloor);
    outlier = Math.log(1 + outlierRatio);
  }

  const freshnessRaw = freshnessValue(video.publishedAt, now, config.halfLifeHours);

  const base = config.weights;
  const weightSum =
    (engagement != null ? base.engagement : 0) +
    (outlier != null ? base.outlier : 0) +
    (freshnessRaw != null ? base.freshness : 0);
  const weightsUsed = {
    engagement: engagement != null && weightSum > 0 ? base.engagement / weightSum : 0,
    outlier: outlier != null && weightSum > 0 ? base.outlier / weightSum : 0,
    freshness: freshnessRaw != null && weightSum > 0 ? base.freshness / weightSum : 0,
  };

  let raw =
    weightsUsed.engagement * (engagement ?? 0) +
    weightsUsed.outlier * (outlier ?? 0) +
    weightsUsed.freshness * (freshnessRaw ?? 0);
  let viewsOnly = false;
  if (weightSum === 0) {
    viewsOnly = views != null;
    // ln(views) alone is much larger than a weighted component sum, so scale it down.
    raw = views != null ? Math.log(1 + views) * 1e-6 : 0;
  }

  return {
    engagement,
    outlier,
    freshness: freshnessRaw,
    engagementRate,
    outlierRatio,
    freshnessRaw,
    weightsUsed,
    raw,
    viewsOnly,
  };
}

function componentScores(values: Array<number | null>): Array<number | null> {
  const present = values.filter((value): value is number => value != null);
  return values.map((value) => (value == null ? null : Math.round(100 * percentile(value, present))));
}

export function scoreVideos(
  videos: ScoreInput[],
  override?: unknown,
  now: Date = new Date(),
): ScoreResult[] {
  const config = resolveViralScoreConfig(override ?? DEFAULT_VIRAL_SCORE_CONFIG);
  const parts = videos.map((video) => partsFor(video, config, now));
  const engagementScores = componentScores(parts.map((part) => part.engagement));
  const outlierScores = componentScores(parts.map((part) => part.outlier));
  const freshnessScores = componentScores(parts.map((part) => part.freshness));
  const raws = parts.map((part) => part.raw);

  const byPlatform = new Map<string, number[]>();
  videos.forEach((video, index) => {
    const list = byPlatform.get(video.platform) || [];
    list.push(raws[index]);
    byPlatform.set(video.platform, list);
  });

  return videos.map((video, index) => {
    const part = parts[index];
    const globalPercentile = percentile(part.raw, raws);
    const platformRaws = byPlatform.get(video.platform) || [];
    const platformPercentile =
      platformRaws.length >= config.platformPercentileMin ? percentile(part.raw, platformRaws) : null;
    const viralScore = Math.round(100 * Math.max(globalPercentile, platformPercentile ?? 0));
    const views = finite(video.views);
    return {
      id: video.id,
      engagementScore: engagementScores[index],
      outlierScore: outlierScores[index],
      freshnessScore: freshnessScores[index],
      viralScore,
      isHighPotential: viralScore >= config.highPotentialScore && views != null && views >= config.minViews,
      scoreComponents: {
        engagementRate: part.engagementRate,
        outlierRatio: part.outlierRatio,
        freshness: part.freshnessRaw,
        compressed: {
          engagement: part.engagement,
          outlier: part.outlier,
          freshness: part.freshness,
        },
        weightsUsed: part.weightsUsed,
        raw: part.raw,
        viewsOnly: part.viewsOnly,
        globalPercentile,
        platformPercentile,
      },
    };
  });
}
