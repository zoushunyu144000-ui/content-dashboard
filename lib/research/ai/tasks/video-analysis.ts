import type { JsonSchema } from '../schema';

export const PROMPT_VERSION = 'va-v1';
export const ANALYSIS_VERSION = 'va-1';

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
}

export function videoAnalysisUserPrompt(videos: VideoAnalysisInput[]): string {
  return JSON.stringify({
    videos: videos.map((video) => ({
      ...video,
      transcript: video.transcript ? video.transcript.slice(0, 1500) : null,
    })),
  });
}
