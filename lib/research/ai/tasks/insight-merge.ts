import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'im-v1';
export const ANALYSIS_VERSION = 'im-1';

export const INSIGHT_MERGE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label', 'summary', 'source_labels'],
        properties: {
          kind: { type: 'string', enum: ['pain_point', 'hook', 'structure', 'emotion', 'topic'] },
          label: { type: 'string', minLength: 1 },
          summary: { type: 'string' },
          source_labels: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export const INSIGHT_MERGE_SYSTEM = `You merge synonymous research labels inside the same kind.
Do not invent counts. Counts are computed in SQL from the videos.
Only group labels that clearly mean the same thing. Leave distinct labels unmerged by giving each its own group.
source_labels must be labels from the input, copied exactly.`;

export interface InsightCount {
  kind: 'pain_point' | 'hook' | 'structure' | 'emotion' | 'topic';
  label: string;
  count: number;
}

export interface InsightGroupDraft {
  kind: InsightCount['kind'];
  label: string;
  summary: string;
  source_labels: string[];
}

export function insightMergeUserPrompt(counts: InsightCount[]): string {
  return JSON.stringify({ counts });
}
