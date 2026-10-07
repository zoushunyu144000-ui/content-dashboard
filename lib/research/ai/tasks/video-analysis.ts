import type { JsonSchema } from '../schema';
import {
  AUDIENCE_CATEGORIES,
  CONTENT_FORMATS,
  CONTENT_STRUCTURES,
  CTA_TYPES,
  EMOTIONS,
  HOOK_TYPES,
  PAIN_POINT_CATEGORIES,
  TOPIC_CATEGORIES,
  VALUE_LEVELS,
  VALUE_TYPES,
  type ValueTypeMap,
} from '@/lib/research/taxonomy';

export const PROMPT_VERSION = 'va-v3';
export const ANALYSIS_VERSION = 'v2';

const levelSchema: JsonSchema = { type: 'string', enum: VALUE_LEVELS };

const valueTypeProperties: Record<string, JsonSchema> = {};
for (const key of VALUE_TYPES) valueTypeProperties[key] = levelSchema;

const analysisItem: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'video_ref',
    'audience',
    'audience_category',
    'pain_point',
    'pain_point_category',
    'hook',
    'hook_type',
    'emotion',
    'topic',
    'topic_category',
    'content_structure',
    'content_format',
    'cta_type',
    'why_it_works',
    'what_not_to_copy',
    'viral_hypothesis',
    'reusable_pattern',
    'replicability_score',
    'hook_text',
    'summary',
    'relevance',
    'relevance_reason',
    'value_types',
    'tags',
  ],
  properties: {
    video_ref: { type: 'string', minLength: 1 },
    audience: { type: 'string', minLength: 1, description: 'Specific Simplified Chinese audience, not the enum key.' },
    audience_category: { type: 'string', enum: AUDIENCE_CATEGORIES },
    pain_point: { type: 'string', minLength: 1, description: 'Specific Simplified Chinese pain, not the enum key.' },
    pain_point_category: { type: 'string', enum: PAIN_POINT_CATEGORIES },
    hook: { type: 'string', minLength: 1, description: 'Simplified Chinese description of the hook.' },
    hook_type: { type: 'string', enum: HOOK_TYPES },
    emotion: { type: 'string', enum: EMOTIONS },
    topic: { type: 'string', minLength: 1, description: 'Specific Simplified Chinese topic, not the enum key.' },
    topic_category: { type: 'string', enum: TOPIC_CATEGORIES },
    content_structure: { type: 'string', enum: CONTENT_STRUCTURES },
    content_format: { type: 'string', enum: CONTENT_FORMATS },
    cta_type: { type: 'string', enum: CTA_TYPES },
    why_it_works: {
      type: 'string',
      minLength: 1,
      description: 'Simplified Chinese. Name the opening move, the belief it hits, why the viewer stays, and the commercial relevance.',
    },
    what_not_to_copy: { type: 'string', minLength: 1, description: 'Simplified Chinese. What would fail if copied blindly.' },
    viral_hypothesis: { type: 'string', minLength: 1 },
    reusable_pattern: { type: 'string', minLength: 1 },
    replicability_score: { type: 'integer', minimum: 0, maximum: 100 },
    hook_text: { type: 'string', description: 'Opening line if present, otherwise a close paraphrase. Simplified Chinese when the source is Chinese.' },
    summary: { type: 'string', minLength: 1 },
    relevance: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: '0-100 fit to the run topic and project niche. Below 40 is off-topic.',
    },
    relevance_reason: { type: 'string', description: 'One short Simplified Chinese sentence.' },
    value_types: {
      type: 'object',
      additionalProperties: false,
      required: [...VALUE_TYPES],
      properties: valueTypeProperties,
    },
    tags: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string', minLength: 1 },
      description: 'Short specific tags. Simplified Chinese unless the term is a product or search keyword.',
    },
  },
};

export const VIDEO_ANALYSIS_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['analyses'],
  properties: {
    analyses: {
      type: 'array',
      minItems: 1,
      items: analysisItem,
    },
  },
};

export const VIDEO_ANALYSIS_SYSTEM = `You analyze short-form videos for a content research desk.
Use only the caption, author, metrics, and transcript provided. Do not invent metrics.

Write audience, pain_point, hook, topic, why_it_works, what_not_to_copy, viral_hypothesis, reusable_pattern, hook_text, summary, and relevance_reason in specific Simplified Chinese.
Do not use snake_case for those free-text fields.
Ban empty praise such as "标题吸引人", "内容有价值", "引起共鸣", "视觉吸引" or "节奏好". Say what actually happens, referencing concrete details of THIS video (caption words, transcript lines, metrics).
Quality bar for why_it_works (example of the required level of judgment): "前两秒直接否定目标观众原有认知，通过认知冲突制造停留；随后马上给出一个真实经营场景，让小生意老板产生自我代入，因此既有播放潜力，又有较强商业相关性。"

why_it_works must explain the mechanism: what the opening does, which belief or pain it hits, why a viewer stays, and why that matters commercially for this niche.
what_not_to_copy must name the part that would fail if another account copied the surface (a stunt, a personal flex, a claim without proof, a format that only works for that creator).

These fields must be one of the English keys, exactly:
hook_type: ${HOOK_TYPES.join(', ')}
emotion: ${EMOTIONS.join(', ')}
content_structure: ${CONTENT_STRUCTURES.join(', ')}
content_format: ${CONTENT_FORMATS.join(', ')}
cta_type: ${CTA_TYPES.join(', ')}
audience_category: ${AUDIENCE_CATEGORIES.join(', ')}
pain_point_category: ${PAIN_POINT_CATEGORIES.join(', ')}
topic_category: ${TOPIC_CATEGORIES.join(', ')}

value_types uses traffic, save, discussion, trust, conversion, search_evergreen. Each level is high, medium, low, or none.
Separate "lots of views but no customers" (traffic high, conversion none) from "ordinary views but easy to inquire" (traffic medium, conversion high).
replicability_score is an integer from 0 to 100: how reusable the pattern is for the project's audience.
relevance is an integer from 0 to 100 against the topic and niche in the input. Below 40 is off-topic.
Return one analysis per input video_ref.`;

export interface VideoAnalysisInput {
  video_ref: string;
  caption: string | null;
  author_handle: string | null;
  author_name: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  transcript: string | null;
}

export interface VideoAnalysisDraft {
  video_ref: string;
  audience: string;
  audience_category: string;
  pain_point: string;
  pain_point_category: string;
  hook: string;
  hook_type: string;
  emotion: string;
  topic: string;
  topic_category: string;
  content_structure: string;
  content_format: string;
  cta_type: string;
  why_it_works: string;
  what_not_to_copy: string;
  viral_hypothesis: string;
  reusable_pattern: string;
  replicability_score: number;
  hook_text: string;
  summary: string;
  relevance: number;
  relevance_reason: string;
  value_types: ValueTypeMap;
  tags: string[];
}

export function videoAnalysisUserPrompt(input: {
  topic: string;
  niche: string | null;
  audience: string | null;
  business: string | null;
  videos: VideoAnalysisInput[];
}): string {
  return JSON.stringify({
    topic: input.topic,
    niche: input.niche,
    audience: input.audience,
    business: input.business,
    videos: input.videos.map((video) => ({
      ...video,
      transcript: video.transcript ? video.transcript.slice(0, 1500) : null,
    })),
  });
}
