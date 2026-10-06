/** Videos scored under this are off-topic. Null means an older analysis that was not scored. */
export const RELEVANCE_MIN = 40;

export function isOffTopic(relevance: number | string | null | undefined): boolean {
  if (relevance == null || relevance === '') return false;
  const parsed = typeof relevance === 'number' ? relevance : Number(relevance);
  if (!Number.isFinite(parsed)) return false;
  return parsed < RELEVANCE_MIN;
}
