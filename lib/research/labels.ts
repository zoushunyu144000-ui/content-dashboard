const SYNONYMS: Record<string, string> = {
  fear_of_missing_out: 'fomo',
  fear_missing_out: 'fomo',
  fomo_fear: 'fomo',
};

/** Enum and near-enum tokens that must not be shown as snake_case or "How To". */
const CANONICAL: Record<string, string> = {
  how_to: 'How-to',
  before_after: 'Before/After',
  mythbust: 'Myth-bust',
  myth_bust: 'Myth-bust',
  question: 'Question',
  contrarian: 'Contrarian',
  story: 'Story',
  stat: 'Stat',
  confession: 'Confession',
  list: 'List',
  shock: 'Shock',
  other: 'Other',
  curiosity: 'Curiosity',
  fear: 'Fear',
  aspiration: 'Aspiration',
  frustration: 'Frustration',
  humor: 'Humor',
  urgency: 'Urgency',
  trust: 'Trust',
  surprise: 'Surprise',
  demo: 'Demo',
  tutorial: 'Tutorial',
  rant: 'Rant',
};

const SMALL_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'for', 'to', 'in', 'on', 'vs', 'or']);

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

export function canonicalLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return CANONICAL[key] || null;
}

export function titleCaseLabel(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Other';
  const words = trimmed.split(' ');
  return words.map((word, index) => formatWord(word, index === 0)).join(' ');
}

function formatWord(word: string, isFirst: boolean): string {
  if (/^[A-Z0-9]{2,5}$/.test(word)) return word;
  if (word.includes('-') || word.includes('/')) {
    const parts = word.split(/([-/])/);
    return parts.map((part, index) => (part === '-' || part === '/' ? part : formatWord(part, isFirst && index === 0))).join('');
  }
  const lower = word.toLowerCase();
  if (!lower) return word;
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
