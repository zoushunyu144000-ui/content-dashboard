export const version = '0001_init';

// Bundled as a string so `output: 'standalone'` still contains the migration.
// Marker: logos-web-studio
export const sql = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists users_email_lower_uidx on users (lower(email));

create table if not exists provider_cache (
  key text primary key,
  provider text not null,
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists provider_cache_created_idx on provider_cache (created_at desc);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  niche text,
  audience text,
  voice text,
  platforms text[] not null default '{tiktok}',
  default_language text not null default 'en',
  viral_score_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists projects_archived_name_idx on projects (archived_at, name);

create table if not exists research_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  topic text not null,
  status text not null default 'created' check (status in (
    'created', 'keyword_expansion', 'scraping', 'normalizing', 'scoring',
    'analyzing', 'clustering', 'generating_insights', 'completed', 'failed', 'cancelled'
  )),
  current_step text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  run_after timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  config jsonb not null default '{}'::jsonb,
  insights jsonb,
  scraper_provider text,
  scraper_note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_runs_project_created_idx on research_runs (project_id, created_at desc);
create index if not exists research_runs_claim_idx on research_runs (created_at)
  where status not in ('completed', 'failed', 'cancelled');

create table if not exists research_keywords (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  term text not null,
  platform text not null,
  intent text check (intent is null or intent in ('pain', 'trend', 'competitor', 'how_to')),
  language text,
  source text not null default 'ai' check (source in ('ai', 'user')),
  unique (run_id, platform, term)
);

create table if not exists scrape_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  keyword_id uuid references research_keywords(id) on delete set null,
  scraper_provider text not null,
  actor text,
  platform text not null,
  query text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  external_run_id text,
  dataset_id text,
  attempt integer not null default 0,
  error text,
  raw_meta jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists scrape_tasks_run_status_idx on scrape_tasks (run_id, status);
create index if not exists scrape_tasks_external_run_idx on scrape_tasks (external_run_id);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  platform_video_id text,
  url text,
  canonical_url text,
  video_url text,
  video_url_expires_at timestamptz,
  embed_url text,
  thumbnail_url text,
  caption text,
  author_handle text,
  author_name text,
  author_followers bigint,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  duration_seconds integer,
  published_at timestamptz,
  transcript text,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint videos_identity_chk check (
    platform_video_id is not null
    or (canonical_url is not null and length(canonical_url) > 0)
  )
);
create unique index if not exists videos_platform_video_uidx
  on videos (platform, platform_video_id)
  where platform_video_id is not null;
create unique index if not exists videos_canonical_fallback_uidx
  on videos (platform, canonical_url)
  where platform_video_id is null and canonical_url is not null;
create index if not exists videos_published_idx on videos (published_at desc);
create index if not exists videos_author_idx on videos (author_handle);

create table if not exists research_run_videos (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  keyword_id uuid references research_keywords(id) on delete set null,
  scrape_task_id uuid references scrape_tasks(id) on delete set null,
  engagement_score numeric,
  outlier_score numeric,
  freshness_score numeric,
  viral_score numeric,
  is_high_potential boolean not null default false,
  score_components jsonb not null default '{}'::jsonb,
  rank integer,
  unique (run_id, video_id)
);
create index if not exists research_run_videos_score_idx on research_run_videos (run_id, viral_score desc);

create table if not exists video_analyses (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  audience text,
  pain_point text,
  hook text,
  hook_type text,
  emotion text,
  topic text,
  content_structure text,
  viral_hypothesis text,
  reusable_pattern text,
  replicability integer check (replicability is null or (replicability >= 0 and replicability <= 100)),
  hook_text text,
  summary text,
  model text not null default '',
  prompt_version text not null,
  analysis_version text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  error text,
  unique (run_id, video_id, prompt_version)
);
create index if not exists video_analyses_run_status_idx on video_analyses (run_id, status);

create table if not exists insight_clusters (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  kind text not null check (kind in ('pain_point', 'hook', 'structure', 'emotion', 'topic')),
  label text not null,
  summary text,
  video_count integer not null default 0,
  percent numeric,
  rank integer,
  method text not null default 'hybrid' check (method in ('tag_count', 'llm', 'hybrid')),
  source_labels text[] not null default '{}',
  unique (run_id, kind, label)
);
create index if not exists insight_clusters_run_kind_idx on insight_clusters (run_id, kind, rank);

create table if not exists insight_cluster_videos (
  cluster_id uuid not null references insight_clusters(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  primary key (cluster_id, video_id)
);

create table if not exists research_content_ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  position smallint not null check (position >= 1 and position <= 10),
  topic text not null,
  hook text not null,
  angle text not null,
  structure text not null,
  reason text not null,
  model text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, position)
);

create table if not exists research_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  phase text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists research_run_events_run_idx on research_run_events (run_id, created_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists research_runs_set_updated_at on research_runs;
create trigger research_runs_set_updated_at
  before update on research_runs
  for each row execute function set_updated_at();

insert into projects (slug, name, niche, audience, platforms, default_language)
values
  (
    'logos-web-studio',
    'LOGOS Web Studio',
    'web design & development studio for small businesses',
    'small business owners who need a website that brings in customers',
    '{tiktok}',
    'en'
  ),
  (
    'praxis',
    'PRAXIS',
    'professional practice and applied expertise',
    'practitioners who want ideas they can use',
    '{tiktok}',
    'en'
  ),
  (
    'personal-ip',
    'Personal IP',
    'personal brand and original point of view',
    'people building an audience around their own work',
    '{tiktok}',
    'en'
  )
on conflict (slug) do nothing;
`;
