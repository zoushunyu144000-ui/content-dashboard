import 'server-only';
import { getDb } from '@/lib/db';
import { PAIN_POINT_CATEGORY_LABELS } from '@/lib/research/taxonomy';

export class NicheInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NicheInputError';
  }
}

export class NicheNotFoundError extends Error {
  constructor() {
    super('Niche was not found');
    this.name = 'NicheNotFoundError';
  }
}

export class NicheConflictError extends Error {
  constructor() {
    super('A niche with this slug already exists');
    this.name = 'NicheConflictError';
  }
}

export interface NicheProfile {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  niche: string | null;
  audience: string | null;
  voice: string | null;
  platforms: string[];
  default_language: string;
  target_audience: string | null;
  core_business: string | null;
  content_goal: string | null;
  core_pain_points: string[];
  content_pillars: string[];
  search_keywords: string[];
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

interface NicheRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  niche: string | null;
  audience: string | null;
  voice: string | null;
  platforms: string[] | null;
  default_language: string;
  target_audience: string | null;
  core_business: string | null;
  content_goal: string | null;
  core_pain_points: string[] | null;
  content_pillars: string[] | null;
  search_keywords: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

const TEXT_FIELDS = ['name', 'description', 'niche', 'audience', 'voice', 'target_audience', 'core_business', 'content_goal'] as const;
const LIST_FIELDS = ['core_pain_points', 'content_pillars', 'search_keywords'] as const;

type TextField = (typeof TEXT_FIELDS)[number];
type ListField = (typeof LIST_FIELDS)[number];

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toProfile(row: NicheRow): NicheProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    niche: row.niche,
    audience: row.audience,
    voice: row.voice,
    platforms: textList(row.platforms),
    default_language: row.default_language,
    target_audience: row.target_audience,
    core_business: row.core_business,
    content_goal: row.content_goal,
    core_pain_points: textList(row.core_pain_points),
    content_pillars: textList(row.content_pillars),
    search_keywords: textList(row.search_keywords),
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export async function listNiches(): Promise<NicheProfile[]> {
  const sql = getDb();
  const rows = await sql<NicheRow[]>`
    select id, slug, name, description, niche, audience, voice, platforms, default_language,
           target_audience, core_business, content_goal, core_pain_points, content_pillars, search_keywords,
           created_at, updated_at, archived_at
    from projects
    where archived_at is null
    order by name
  `;
  return rows.map(toProfile);
}

export async function getNiche(id: string): Promise<NicheProfile | null> {
  const sql = getDb();
  const rows = await sql<NicheRow[]>`
    select id, slug, name, description, niche, audience, voice, platforms, default_language,
           target_audience, core_business, content_goal, core_pain_points, content_pillars, search_keywords,
           created_at, updated_at, archived_at
    from projects
    where id = ${id}
    limit 1
  `;
  return rows[0] ? toProfile(rows[0]) : null;
}

function readText(body: Record<string, unknown>, key: TextField): { set: boolean; value: string | null } {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { set: false, value: null };
  const raw = body[key];
  if (raw == null) {
    if (key === 'name') throw new NicheInputError('name is required');
    return { set: true, value: null };
  }
  if (typeof raw !== 'string') throw new NicheInputError(`${key} must be a string`);
  const trimmed = raw.trim();
  if (key === 'name' && !trimmed) throw new NicheInputError('name is required');
  return { set: true, value: trimmed ? trimmed.slice(0, key === 'name' ? 120 : 2000) : null };
}

function readList(body: Record<string, unknown>, key: ListField): { set: boolean; value: string[] } {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { set: false, value: [] };
  const raw = body[key];
  if (!Array.isArray(raw)) throw new NicheInputError(`${key} must be an array of strings`);
  const value: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') throw new NicheInputError(`${key} must be an array of strings`);
    const trimmed = item.trim();
    if (!trimmed) continue;
    value.push(trimmed.slice(0, 160));
  }
  if (value.length > 40) throw new NicheInputError(`${key} has too many items`);
  return { set: true, value };
}

export async function updateNiche(id: string, body: Record<string, unknown>): Promise<NicheProfile> {
  const text = Object.fromEntries(TEXT_FIELDS.map((key) => [key, readText(body, key)])) as Record<
    TextField,
    { set: boolean; value: string | null }
  >;
  const lists = Object.fromEntries(LIST_FIELDS.map((key) => [key, readList(body, key)])) as Record<
    ListField,
    { set: boolean; value: string[] }
  >;
  const changed = TEXT_FIELDS.some((key) => text[key].set) || LIST_FIELDS.some((key) => lists[key].set);
  if (!changed) throw new NicheInputError('No fields to update');

  const sql = getDb();
  const rows = await sql<NicheRow[]>`
    update projects set
      name = case when ${text.name.set} then ${text.name.value} else name end,
      description = case when ${text.description.set} then ${text.description.value} else description end,
      niche = case when ${text.niche.set} then ${text.niche.value} else niche end,
      audience = case when ${text.audience.set} then ${text.audience.value} else audience end,
      voice = case when ${text.voice.set} then ${text.voice.value} else voice end,
      target_audience = case when ${text.target_audience.set} then ${text.target_audience.value} else target_audience end,
      core_business = case when ${text.core_business.set} then ${text.core_business.value} else core_business end,
      content_goal = case when ${text.content_goal.set} then ${text.content_goal.value} else content_goal end,
      core_pain_points = case when ${lists.core_pain_points.set} then ${sql.array(lists.core_pain_points.value, 1009)} else core_pain_points end,
      content_pillars = case when ${lists.content_pillars.set} then ${sql.array(lists.content_pillars.value, 1009)} else content_pillars end,
      search_keywords = case when ${lists.search_keywords.set} then ${sql.array(lists.search_keywords.value, 1009)} else search_keywords end
    where id = ${id}
    returning id, slug, name, description, niche, audience, voice, platforms, default_language,
              target_audience, core_business, content_goal, core_pain_points, content_pillars, search_keywords,
              created_at, updated_at, archived_at
  `;
  if (!rows[0]) throw new NicheNotFoundError();
  return toProfile(rows[0]);
}

function slugFromName(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (ascii) return ascii;
  // Names without ASCII (typical Simplified Chinese) still need a stable slug so the
  // same name conflicts and a different name does not.
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `n-${(hash >>> 0).toString(36)}`;
}

function readPlatforms(body: Record<string, unknown>): string[] {
  if (!Object.prototype.hasOwnProperty.call(body, 'platforms') || body.platforms == null) return ['tiktok'];
  const raw = body.platforms;
  if (!Array.isArray(raw)) throw new NicheInputError('platforms must be an array of strings');
  const value: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') throw new NicheInputError('platforms must be an array of strings');
    const trimmed = item.trim();
    if (!trimmed) continue;
    value.push(trimmed.slice(0, 40));
  }
  if (value.length > 10) throw new NicheInputError('platforms has too many items');
  return value.length ? value : ['tiktok'];
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23505';
}

export async function createNiche(body: Record<string, unknown>): Promise<NicheProfile> {
  if (!Object.prototype.hasOwnProperty.call(body, 'name')) throw new NicheInputError('name is required');
  const name = readText(body, 'name').value;
  if (!name) throw new NicheInputError('name is required');
  const targetAudience = Object.prototype.hasOwnProperty.call(body, 'target_audience')
    ? readText(body, 'target_audience').value
    : null;
  const coreBusiness = Object.prototype.hasOwnProperty.call(body, 'core_business')
    ? readText(body, 'core_business').value
    : null;
  const contentGoal = Object.prototype.hasOwnProperty.call(body, 'content_goal')
    ? readText(body, 'content_goal').value
    : null;
  const painPoints = Object.prototype.hasOwnProperty.call(body, 'core_pain_points')
    ? readList(body, 'core_pain_points').value
    : [];
  const pillars = Object.prototype.hasOwnProperty.call(body, 'content_pillars')
    ? readList(body, 'content_pillars').value
    : [];
  const keywords = Object.prototype.hasOwnProperty.call(body, 'search_keywords')
    ? readList(body, 'search_keywords').value
    : [];
  const platforms = readPlatforms(body);
  const slug = slugFromName(name);
  const sql = getDb();
  try {
    const rows = await sql<NicheRow[]>`
      insert into projects (
        slug, name, niche, audience, platforms,
        target_audience, core_business, content_goal,
        core_pain_points, content_pillars, search_keywords
      ) values (
        ${slug},
        ${name},
        ${coreBusiness},
        ${targetAudience},
        ${sql.array(platforms, 1009)},
        ${targetAudience},
        ${coreBusiness},
        ${contentGoal},
        ${sql.array(painPoints, 1009)},
        ${sql.array(pillars, 1009)},
        ${sql.array(keywords, 1009)}
      )
      returning id, slug, name, description, niche, audience, voice, platforms, default_language,
                target_audience, core_business, content_goal, core_pain_points, content_pillars, search_keywords,
                created_at, updated_at, archived_at
    `;
    if (!rows[0]) throw new Error('Insert returned no row');
    return toProfile(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new NicheConflictError();
    throw err;
  }
}

export interface NicheOverview {
  niche: NicheProfile;
  counts: {
    videos: number;
    analysed: number;
    opportunities: number;
  };
  top_pain_points: Array<{ key: string; label: string; count: number }>;
  audience_insights: Array<{ title: string; evidence_count: number; confidence: string | null }>;
  opportunities: Array<{ id: string; title: string }>;
  runs: Array<{ id: string; topic: string; status: string; created_at: string }>;
}

function asCount(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

const PAIN_LABELS: Record<string, string> = PAIN_POINT_CATEGORY_LABELS;

export async function getNicheOverview(id: string): Promise<NicheOverview | null> {
  const niche = await getNiche(id);
  if (!niche) return null;
  const sql = getDb();
  const [videoRows, analysedRows, opportunityCountRows, painRows, insightRows, opportunityRows, runRows] = await Promise.all([
    sql<{ n: number }[]>`
      select count(distinct rv.video_id)::int as n
      from research_run_videos rv
      join research_runs r on r.id = rv.run_id
      where r.project_id = ${id}
    `,
    sql<{ n: number }[]>`
      select count(*)::int as n
      from video_analyses
      where niche_id = ${id}
        and is_latest = true
        and status = 'complete'
    `,
    sql<{ n: number }[]>`
      select count(*)::int as n
      from opportunities
      where niche_id = ${id} and status = 'active'
    `,
    sql<{ key: string; count: number }[]>`
      select pain_point_category as key, count(*)::int as count
      from video_analyses
      where niche_id = ${id}
        and is_latest = true
        and status = 'complete'
        and pain_point_category is not null
        and pain_point_category <> ''
      group by pain_point_category
      order by count desc, pain_point_category
      limit 5
    `,
    sql<{ title: string; evidence_count: number | null; confidence: string | null }[]>`
      select ai.title, ai.evidence_count, ai.confidence
      from audience_insights ai
      join research_runs r on r.id = ai.run_id and r.project_id = ${id}
      where ai.category = 'pain_point'
        and ai.status = 'active'
      order by ai.evidence_count desc nulls last, ai.created_at desc nulls last
      limit 5
    `,
    sql<{ id: string; title: string }[]>`
      select id, title
      from opportunities
      where niche_id = ${id} and status = 'active'
      order by coalesce((evidence->>'matching_videos')::numeric, 0) desc, created_at desc
      limit 3
    `,
    sql<{ id: string; topic: string; status: string; created_at: Date | string }[]>`
      select id, topic, status, created_at
      from research_runs
      where project_id = ${id}
      order by created_at desc
      limit 5
    `,
  ]);

  return {
    niche,
    counts: {
      videos: asCount(videoRows[0]?.n),
      analysed: asCount(analysedRows[0]?.n),
      opportunities: asCount(opportunityCountRows[0]?.n),
    },
    top_pain_points: painRows.map((row) => ({
      key: row.key,
      label: PAIN_LABELS[row.key] || row.key,
      count: asCount(row.count),
    })),
    audience_insights: insightRows.map((row) => ({
      title: row.title,
      evidence_count: asCount(row.evidence_count),
      confidence: row.confidence,
    })),
    opportunities: opportunityRows.map((row) => ({ id: row.id, title: row.title })),
    runs: runRows.map((row) => ({
      id: row.id,
      topic: row.topic,
      status: row.status,
      created_at: asIso(row.created_at),
    })),
  };
}
