const SYNONYMS: Record<string, string> = {
  fear_of_missing_out: 'fomo',
  fear_missing_out: 'fomo',
  fomo_fear: 'fomo',
};

export function snakeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const snake = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!snake) return null;
  return SYNONYMS[snake] || snake;
}
