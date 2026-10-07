/**
 * Fixed English keys for filtering. Chinese labels are the user-facing names.
 * Free-text analysis columns stay specific; these keys are the filter buckets.
 */

export const HOOK_TYPES = [
  'pattern_interrupt',
  'contrarian',
  'loss_aversion',
  'curiosity_gap',
  'question',
  'story',
  'social_proof',
  'before_after',
  'list',
  'direct_address',
  'demonstration',
  'challenge',
  'other',
] as const;

export const EMOTIONS = [
  'curiosity',
  'fear',
  'frustration',
  'aspiration',
  'humor',
  'surprise',
  'trust',
  'urgency',
  'relief',
  'inspiration',
  'other',
] as const;

export const CONTENT_STRUCTURES = [
  'problem_solution',
  'story_lesson',
  'list_tips',
  'before_after',
  'tutorial_steps',
  'myth_busting',
  'case_study',
  'reaction_commentary',
  'day_in_life',
  'comparison',
  'other',
] as const;

export const CONTENT_FORMATS = [
  'talking_head',
  'screen_recording',
  'voiceover_broll',
  'text_overlay',
  'skit',
  'interview',
  'slideshow',
  'vlog',
  'other',
] as const;

export const CTA_TYPES = [
  'none',
  'follow',
  'comment',
  'save',
  'share',
  'dm_consult',
  'link_in_bio',
  'buy',
  'other',
] as const;

export const AUDIENCE_CATEGORIES = [
  'small_business_owner',
  'marketer',
  'founder',
  'professional',
  'freelancer',
  'creator',
  'student',
  'job_seeker',
  'manager',
  'consumer',
  'local_service',
  'developer',
  'parent',
  'other',
] as const;

export const PAIN_POINT_CATEGORIES = [
  'no_customers',
  'low_conversion',
  'no_time',
  'cost_budget',
  'trust_credibility',
  'tech_complexity',
  'visibility_seo',
  'competition',
  'productivity_focus',
  'burnout',
  'personal_brand_growth',
  'unclear_positioning',
  'inconsistent_execution',
  'pricing',
  'other',
] as const;

export const TOPIC_CATEGORIES = [
  'customer_acquisition',
  'website_conversion',
  'offer_pricing',
  'content_strategy',
  'personal_brand',
  'productivity_system',
  'morning_routine',
  'marketing_channel',
  'sales_conversation',
  'case_breakdown',
  'tool_workflow',
  'mindset_belief',
  'local_business',
  'career_growth',
  'other',
] as const;

export const OPPORTUNITY_TYPES = [
  'trend_ride',
  'evergreen_search',
  'pain_point_deep_dive',
  'conversion_play',
  'contrarian_take',
  'format_remix',
] as const;

export const VALUE_TYPES = [
  'traffic',
  'save',
  'discussion',
  'trust',
  'conversion',
  'search_evergreen',
] as const;

export const VALUE_LEVELS = ['high', 'medium', 'low', 'none'] as const;

export type HookType = (typeof HOOK_TYPES)[number];
export type Emotion = (typeof EMOTIONS)[number];
export type ContentStructure = (typeof CONTENT_STRUCTURES)[number];
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type CtaType = (typeof CTA_TYPES)[number];
export type AudienceCategory = (typeof AUDIENCE_CATEGORIES)[number];
export type PainPointCategory = (typeof PAIN_POINT_CATEGORIES)[number];
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type ValueType = (typeof VALUE_TYPES)[number];
export type ValueLevel = (typeof VALUE_LEVELS)[number];

export type ValueTypeMap = Record<ValueType, ValueLevel>;

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  pattern_interrupt: '模式打断',
  contrarian: '反常识',
  loss_aversion: '损失厌恶',
  curiosity_gap: '好奇缺口',
  question: '提问',
  story: '故事',
  social_proof: '社会证明',
  before_after: '前后对比',
  list: '清单',
  direct_address: '直接对话',
  demonstration: '现场演示',
  challenge: '挑战',
  other: '其他',
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  curiosity: '好奇',
  fear: '恐惧',
  frustration: '挫败',
  aspiration: '向往',
  humor: '幽默',
  surprise: '惊喜',
  trust: '信任',
  urgency: '紧迫',
  relief: '释然',
  inspiration: '启发',
  other: '其他',
};

export const CONTENT_STRUCTURE_LABELS: Record<ContentStructure, string> = {
  problem_solution: '问题到解法',
  story_lesson: '故事与教训',
  list_tips: '清单建议',
  before_after: '前后对比',
  tutorial_steps: '分步教程',
  myth_busting: '破除迷思',
  case_study: '案例拆解',
  reaction_commentary: '反应点评',
  day_in_life: '一天实录',
  comparison: '对比',
  other: '其他',
};

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  talking_head: '口播出镜',
  screen_recording: '录屏',
  voiceover_broll: '旁白配画面',
  text_overlay: '文字叠层',
  skit: '短剧',
  interview: '访谈',
  slideshow: '图文轮播',
  vlog: '日常记录',
  other: '其他',
};

export const CTA_TYPE_LABELS: Record<CtaType, string> = {
  none: '无',
  follow: '关注',
  comment: '评论',
  save: '收藏',
  share: '分享',
  dm_consult: '私信咨询',
  link_in_bio: '主页链接',
  buy: '购买',
  other: '其他',
};

export const AUDIENCE_CATEGORY_LABELS: Record<AudienceCategory, string> = {
  small_business_owner: '中小企业主',
  marketer: '营销人员',
  founder: '创业者',
  professional: '专业人士',
  freelancer: '自由职业者',
  creator: '创作者',
  student: '学生',
  job_seeker: '求职者',
  manager: '管理者',
  consumer: '普通消费者',
  local_service: '本地服务从业者',
  developer: '开发者',
  parent: '家长',
  other: '其他',
};

export const PAIN_POINT_CATEGORY_LABELS: Record<PainPointCategory, string> = {
  no_customers: '没有客户',
  low_conversion: '转化低',
  no_time: '没时间',
  cost_budget: '成本与预算',
  trust_credibility: '信任与可信度',
  tech_complexity: '技术太复杂',
  visibility_seo: '曝光与搜索',
  competition: '竞争',
  productivity_focus: '效率与专注',
  burnout: '倦怠',
  personal_brand_growth: '个人品牌增长',
  unclear_positioning: '定位不清',
  inconsistent_execution: '执行不稳定',
  pricing: '定价',
  other: '其他',
};

export const TOPIC_CATEGORY_LABELS: Record<TopicCategory, string> = {
  customer_acquisition: '获客',
  website_conversion: '网站转化',
  offer_pricing: '报价与定价',
  content_strategy: '内容策略',
  personal_brand: '个人品牌',
  productivity_system: '效率系统',
  morning_routine: '早晨例程',
  marketing_channel: '营销渠道',
  sales_conversation: '销售对话',
  case_breakdown: '案例拆解',
  tool_workflow: '工具与流程',
  mindset_belief: '心态与信念',
  local_business: '本地生意',
  career_growth: '职业成长',
  other: '其他',
};

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  trend_ride: '追趋势',
  evergreen_search: '长青搜索',
  pain_point_deep_dive: '痛点深挖',
  conversion_play: '转化打法',
  contrarian_take: '反常识观点',
  format_remix: '形式改编',
};

export const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  traffic: '流量',
  save: '收藏',
  discussion: '讨论',
  trust: '信任',
  conversion: '转化',
  search_evergreen: '搜索长青',
};

export const VALUE_LEVEL_LABELS: Record<ValueLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
  none: '无',
};

export const ANALYSIS_ENUM_COLUMNS = [
  'hook_type',
  'emotion',
  'content_structure',
  'content_format',
  'cta_type',
  'audience_category',
  'pain_point_category',
  'topic_category',
] as const;

export type AnalysisEnumColumn = (typeof ANALYSIS_ENUM_COLUMNS)[number];

const ENUM_LABELS: Record<AnalysisEnumColumn, Record<string, string>> = {
  hook_type: HOOK_TYPE_LABELS,
  emotion: EMOTION_LABELS,
  content_structure: CONTENT_STRUCTURE_LABELS,
  content_format: CONTENT_FORMAT_LABELS,
  cta_type: CTA_TYPE_LABELS,
  audience_category: AUDIENCE_CATEGORY_LABELS,
  pain_point_category: PAIN_POINT_CATEGORY_LABELS,
  topic_category: TOPIC_CATEGORY_LABELS,
};

export function taxonomyLabel(column: AnalysisEnumColumn, key: string): string | null {
  return ENUM_LABELS[column][key] ?? null;
}

/** Map model output onto a fixed key. Unknown non-empty values become `other` when that key exists. */
export function coerceTaxonomyKey<T extends string>(value: unknown, keys: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s/|-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!key) return null;
  if ((keys as readonly string[]).includes(key)) return key as T;
  const other = keys.find((item) => item === 'other');
  return (other as T | undefined) ?? null;
}

export function normalizeValueTypes(value: unknown): ValueTypeMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const out = {} as ValueTypeMap;
  for (const key of VALUE_TYPES) {
    const raw = typeof source[key] === 'string' ? source[key].trim().toLowerCase() : '';
    out[key] = (VALUE_LEVELS as readonly string[]).includes(raw) ? (raw as ValueLevel) : 'none';
  }
  return out;
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, 40);
    if (!tag || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}
