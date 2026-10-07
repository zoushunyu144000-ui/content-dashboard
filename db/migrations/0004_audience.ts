export const version = '0004_audience';

// Idempotent. Creates audience_insights only. Does not rewrite existing rows.
export const sql = `
create table if not exists audience_insights (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references research_runs(id) on delete cascade,
  niche_id uuid references projects(id) on delete cascade,
  category text not null check (category in (
    'audience_segment',
    'pain_point',
    'desire',
    'need',
    'objection',
    'question',
    'emotional_trigger',
    'misconception',
    'job_to_be_done',
    'content_gap',
    'conversion_signal'
  )),
  title text not null,
  description text,
  surface_problem text,
  underlying_problem text,
  underlying_need text,
  desired_outcome text,
  need_kind text check (need_kind is null or need_kind in ('functional', 'emotional')),
  frequency_pct numeric,
  evidence_count integer,
  high_potential_count integer,
  evidence_video_ids uuid[] default '{}'::uuid[],
  supporting_quotes jsonb default '[]'::jsonb,
  signals jsonb,
  confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  observation_level text check (
    observation_level is null or observation_level in ('observed', 'inferred', 'speculative')
  ),
  rank integer,
  generation_id uuid,
  status text default 'active',
  ai_task_run_id uuid references ai_task_runs(id) on delete set null,
  model text,
  prompt_version text,
  created_at timestamptz default now()
);
create index if not exists audience_insights_run_category_status_idx
  on audience_insights (run_id, category, status);
create index if not exists audience_insights_niche_category_idx
  on audience_insights (niche_id, category);
`;
