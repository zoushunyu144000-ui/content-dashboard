import 'server-only';
import { getDb } from '@/lib/db';

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
