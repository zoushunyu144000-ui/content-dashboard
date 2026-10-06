import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'im-v2';
export const ANALYSIS_VERSION = 'im-2';

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
          label: {
            type: 'string',
            minLength: 1,
            description: 'Broad Title Case name such as "Customer Acquisition" or "How-to". Never snake_case.',
          },
          summary: { type: 'string' },
          source_labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Input labels copied exactly. Every input label belongs to one group.',
          },
        },
      },
    },
  },
};

export const INSIGHT_MERGE_SYSTEM = `You group research labels into a few broad themes for a content desk.
Do not invent counts or percentages. Those are computed in code from the videos.

For each kind, output at most 8 groups.
pain_point and topic should land on 4 to 8 groups when the input has at least 4 distinct labels. Prefer broad themes over near-duplicates.
Examples of good pain_point or topic labels: "Customer Acquisition", "Website Conversion", "AI Tools Anxiety".
Never output snake_case. Title Case, short, something a person would say.

hook, structure, and emotion are already enums. Use one group per enum value that appears, with these display labels:
how_to → "How-to", before_after → "Before/After", mythbust → "Myth-bust".
Other enums use a short Title Case name: Question, Contrarian, Story, Stat, Confession, List, Shock, Curiosity, Fear, Aspiration, Frustration, Humor, Urgency, Trust, Surprise, Demo, Tutorial, Rant, Other.

Every input label must appear in exactly one group's source_labels, copied exactly from the input.
If a label fits no theme, put it in a group labeled "Other".
Do not add source_labels that were not in the input.
summary is one short sentence, or empty for Other.`;

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
  return JSON.stringify({
    max_groups_per_kind: 8,
    pain_point_and_topic: '4-8 broad Title Case groups',
    counts,
  });
}
