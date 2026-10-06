import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'ci-v1';
export const ANALYSIS_VERSION = 'ci-1';

export const CONTENT_IDEA_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      minItems: 10,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'hook', 'angle', 'structure', 'reason'],
        properties: {
          topic: { type: 'string', minLength: 1 },
          hook: { type: 'string', minLength: 1 },
          angle: { type: 'string', minLength: 1 },
          structure: { type: 'string', minLength: 1 },
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
  },
};

export const CONTENT_IDEA_SYSTEM = `You write exactly 10 short-form video ideas for the project.
Each idea needs a topic, an opening hook, an angle, a structure, and a reason tied to the research.
Use the pain points, hooks, and patterns that actually showed up. Do not add an eleventh idea.`;

export interface ContentIdeaDraft {
  topic: string;
  hook: string;
  angle: string;
  structure: string;
  reason: string;
}

export function contentIdeaUserPrompt(input: {
  project: { name: string; niche: string | null; audience: string | null; voice: string | null };
  topic: string;
  insights: unknown;
  topVideos: unknown;
}): string {
  return JSON.stringify(input);
}
