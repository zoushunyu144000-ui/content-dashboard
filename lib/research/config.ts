export interface ViralScoreWeights {
  engagement: number;
  outlier: number;
  freshness: number;
}

export interface ViralScoreConfig {
  weights: ViralScoreWeights;
  interactionWeights: { likes: number; comments: number; shares: number; saves: number };
  minViews: number;
  highPotentialScore: number;
  followerFloor: number;
  halfLifeHours: number;
  platformPercentileMin: number;
}

export const DEFAULT_VIRAL_SCORE_CONFIG: ViralScoreConfig = {
  weights: { engagement: 0.35, outlier: 0.45, freshness: 0.2 },
  interactionWeights: { likes: 1, comments: 2, shares: 4, saves: 4 },
  minViews: 1000,
  highPotentialScore: 80,
  followerFloor: 1000,
  halfLifeHours: 168,
  platformPercentileMin: 8,
};

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function resolveViralScoreConfig(override?: unknown): ViralScoreConfig {
  const config: ViralScoreConfig = {
    weights: { ...DEFAULT_VIRAL_SCORE_CONFIG.weights },
    interactionWeights: { ...DEFAULT_VIRAL_SCORE_CONFIG.interactionWeights },
    minViews: DEFAULT_VIRAL_SCORE_CONFIG.minViews,
    highPotentialScore: DEFAULT_VIRAL_SCORE_CONFIG.highPotentialScore,
    followerFloor: DEFAULT_VIRAL_SCORE_CONFIG.followerFloor,
    halfLifeHours: DEFAULT_VIRAL_SCORE_CONFIG.halfLifeHours,
    platformPercentileMin: DEFAULT_VIRAL_SCORE_CONFIG.platformPercentileMin,
  };
  if (!override || typeof override !== 'object') return config;
  const source = override as Record<string, unknown>;
  const weights = source.weights as Record<string, unknown> | undefined;
  if (weights) {
    const engagement = asNumber(weights.engagement);
    const outlier = asNumber(weights.outlier) ?? asNumber(weights.breakout);
    const freshness = asNumber(weights.freshness);
    if (engagement != null) config.weights.engagement = engagement;
    if (outlier != null) config.weights.outlier = outlier;
    if (freshness != null) config.weights.freshness = freshness;
  }
  const interactions = source.interactionWeights as Record<string, unknown> | undefined;
  if (interactions) {
    for (const key of ['likes', 'comments', 'shares', 'saves'] as const) {
      const value = asNumber(interactions[key]);
      if (value != null) config.interactionWeights[key] = value;
    }
  }
  const minViews = asNumber(source.minViews);
  const highPotentialScore = asNumber(source.highPotentialScore) ?? asNumber(source.highPotentialPercentile);
  const followerFloor = asNumber(source.followerFloor);
  const halfLifeHours = asNumber(source.halfLifeHours);
  const platformPercentileMin = asNumber(source.platformPercentileMin);
  if (minViews != null) config.minViews = minViews;
  if (highPotentialScore != null) config.highPotentialScore = highPotentialScore;
  if (followerFloor != null) config.followerFloor = followerFloor;
  if (halfLifeHours != null && halfLifeHours > 0) config.halfLifeHours = halfLifeHours;
  if (platformPercentileMin != null) config.platformPercentileMin = platformPercentileMin;
  return config;
}
