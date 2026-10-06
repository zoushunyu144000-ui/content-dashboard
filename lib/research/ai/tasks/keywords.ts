import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'kw-v1';
export const ANALYSIS_VERSION = 'kw-1';

export const KEYWORD_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keywords'],
  properties: {
    keywords: {
      type: 'array',
      minItems: 6,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'platform', 'intent', 'language'],
        properties: {
          term: { type: 'string', minLength: 1 },
          platform: { type: 'string', enum: ['tiktok', 'youtube'] },
          intent: { type: 'string', enum: ['pain', 'trend', 'competitor', 'how_to'] },
          language: { type: 'string', minLength: 1 },
        },
      },
    },
  },
};

export const KEYWORD_SYSTEM = `You expand a research topic into search keywords for short-form video.
Return 6 to 10 keywords a real viewer would type. Mix pain, trend, competitor, and how_to intents.
Use the project's language. Do not invent platforms outside tiktok and youtube.`;

export interface KeywordDraft {
  term: string;
  platform: 'tiktok' | 'youtube';
  intent: 'pain' | 'trend' | 'competitor' | 'how_to';
  language: string;
}

export function keywordUserPrompt(input: {
  name: string;
  niche: string | null;
  audience: string | null;
  language: string;
  topic: string;
  platforms: string[];
}): string {
  return JSON.stringify({
    project: {
      name: input.name,
      niche: input.niche,
      audience: input.audience,
      language: input.language,
    },
    topic: input.topic,
    platforms: input.platforms,
  });
}
