import { asString } from './normalize/shared';

export interface PickedSubtitle {
  transcript: string | null;
  subtitleUrl: string | null;
}

interface Candidate {
  language: string | null;
  url: string | null;
  text: string | null;
}

function languageOf(record: Record<string, unknown>): string | null {
  return asString(record.language) || asString(record.lang) || asString(record.language_code);
}

function urlOf(record: Record<string, unknown>): string | null {
  return asString(record.downloadLink) || asString(record.url);
}

export function isEngUs(language: string | null | undefined): boolean {
  if (!language) return false;
  return language.trim().toLowerCase().replace(/_/g, '-') === 'eng-us';
}

/** Prefer an eng-US track. Otherwise keep the first link that has text or a URL. */
export function pickSubtitle(links: unknown): PickedSubtitle {
  if (!Array.isArray(links)) return { transcript: null, subtitleUrl: null };
  const parsed: Candidate[] = [];
  for (const link of links) {
    if (typeof link === 'string') {
      const url = asString(link);
      if (url) parsed.push({ language: null, url, text: null });
      continue;
    }
    if (!link || typeof link !== 'object') continue;
    const record = link as Record<string, unknown>;
    parsed.push({
      language: languageOf(record),
      url: urlOf(record),
      text: asString(record.text) || asString(record.transcript),
    });
  }
  const usable = parsed.filter((item) => item.url || item.text);
  if (usable.length === 0) return { transcript: null, subtitleUrl: null };
  const chosen = usable.find((item) => isEngUs(item.language)) || usable[0];
  if (chosen.text && !/^https?:\/\//i.test(chosen.text)) {
    return { transcript: chosen.text, subtitleUrl: chosen.url };
  }
  return { transcript: null, subtitleUrl: chosen.url };
}
