import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'va-v2';
export const ANALYSIS_VERSION = 'va-2';

const analysisItem: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'video_ref',
    'audience',
    'pain_point',
    'hook',
    'hook_type',
    'emotion',
    'topic',
    'content_structure',
    'viral_hypothesis',
    'reusable_pattern',
    'replicability',
    'hook_text',
    'summary',
    'relevance',
    'relevance_reason',
  ],
  properties: {
    video_ref: { type: 'string', minLength: 1 },
    audience: { type: 'string' },
    pain_point: { type: 'string', description: 'short snake_case label' },
    hook: { type: 'string' },
    hook_type: {
      type: 'string',
      enum: ['question', 'contrarian', 'story', 'stat', 'confession', 'how_to', 'list', 'shock', 'other'],
    },
    emotion: {
      type: 'string',
      enum: ['curiosity', 'fear', 'aspiration', 'frustration', 'humor', 'urgency', 'trust', 'surprise', 'other'],
    },
    topic: { type: 'string', description: 'short snake_case label' },
    content_structure: {
      type: 'string',
      enum: ['list', 'story', 'demo', 'mythbust', 'before_after', 'tutorial', 'rant', 'other'],
    },
    viral_hypothesis: { type: 'string' },
    reusable_pattern: { type: 'string' },
    replicability: { type: 'integer', minimum: 0, maximum: 100 },
    hook_text: { type: 'string' },
    summary: { type: 'string' },
    relevance: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: '0-100 fit to the run topic and project niche. Below 40 is off-topic.',
    },
    relevance_reason: { type: 'string', description: 'One short sentence.' },
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
pain_point and topic must be short snake_case labels (example: slow_website, client_pricing).
hook_type, emotion, and content_structure must use the enum values.
replicability is an integer from 0 to 100: how reusable the pattern is for the project's audience.
relevance is an integer from 0 to 100: how closely the video matches the run topic and the project niche. 0 is unrelated. 100 is exactly about that topic for that niche. Below 40 is off-topic.
relevance_reason is one short sentence explaining the relevance score.
Judge relevance only against the topic and niche in the input.
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
  pain_point: string;
  hook: string;
  hook_type: string;
  emotion: string;
  topic: string;
  content_structure: string;
  viral_hypothesis: string;
  reusable_pattern: string;
  replicability: number;
  hook_text: string;
  summary: string;
  relevance: number;
  relevance_reason: string;
}

export function videoAnalysisUserPrompt(input: {
  topic: string;
  niche: string | null;
  videos: VideoAnalysisInput[];
}): string {
  return JSON.stringify({
    topic: input.topic,
    niche: input.niche,
    videos: input.videos.map((video) => ({
      ...video,
      transcript: video.transcript ? video.transcript.slice(0, 1500) : null,
    })),
  });
}
