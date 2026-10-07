export const version = '0003_v02';

// Idempotent. Adds tables and columns only. Does not delete or rewrite existing rows,
// except backfilling niche_id / is_latest and seeding niche profiles that are still null.
export const sql = `
create table if not exists ai_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  model text,
  prompt_version text,
  status text not null check (status in ('running', 'complete', 'failed')),
  error text,
  latency_ms integer,
  input_source jsonb,
  request_meta jsonb,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_task_runs_task_created_idx on ai_task_runs (task_type, created_at desc);
create index if not exists ai_task_runs_status_idx on ai_task_runs (status);

alter table projects add column if not exists target_audience text;
alter table projects add column if not exists core_business text;
alter table projects add column if not exists content_goal text;
alter table projects add column if not exists core_pain_points text[];
alter table projects add column if not exists content_pillars text[];
alter table projects add column if not exists search_keywords text[];

-- Seed only untouched profiles. Keywords may stay English; the rest is Simplified Chinese.
update projects set
  target_audience = '马来西亚中小企业主，需要一个能带来客户的网站',
  core_business = '为马来西亚中小企业做网站设计/建站（让网站带来客户）',
  content_goal = '让马来西亚中小企业主看懂网站如何带来咨询和客户，并愿意联系建站',
  core_pain_points = array[
    '有网站但没有客户',
    '访客来了却不咨询',
    '预算有限，担心建站被坑',
    '不懂落地页和转化',
    '本地搜索和曝光做不起来'
  ]::text[],
  content_pillars = array[
    '网站带来客户',
    '落地页与转化',
    '中小企业建站避坑',
    '本地获客',
    '案例拆解'
  ]::text[],
  search_keywords = array[
    'small business website',
    'web design for business',
    'Malaysia small business marketing',
    'landing page design',
    'website for small business'
  ]::text[]
where target_audience is null
  and (slug = 'logos-web-studio' or name = 'LOGOS Web Studio');

update projects set
  target_audience = '想把专业能力用起来的职场人士与从业者',
  core_business = '专业人士的效率/实践方法论',
  content_goal = '帮专业人士把效率和方法落到每天能执行的实践上',
  core_pain_points = array[
    '白天推不动，效率很低',
    '没有稳定的早晨例程',
    '方法看了很多但做不到',
    '难以长时间专注',
    '专业能力没有变成可复用的实践'
  ]::text[],
  content_pillars = array[
    '专业人士效率',
    '早晨例程',
    '可执行的实践方法',
    '专注与深度工作',
    '职业方法论'
  ]::text[],
  search_keywords = array[
    'productivity tips for professionals',
    'morning routine for productivity',
    'professional practice',
    'deep work for professionals',
    'applied expertise'
  ]::text[]
where target_audience is null
  and (slug = 'praxis' or name = 'PRAXIS');

update projects set
  target_audience = '想建立个人品牌和个人 IP 的创作者与专业人士',
  core_business = '个人品牌/个人 IP 打造',
  content_goal = '把经历、观点和方法变成可被记住、可持续更新的个人 IP',
  core_pain_points = array[
    '不知道自己该被记住什么',
    '有专业能力但没有受众',
    '内容没有稳定的记忆点',
    '更新一阵就停',
    '信任无法变成合作或咨询'
  ]::text[],
  content_pillars = array[
    '个人定位',
    '内容支柱',
    '观点与表达',
    '信任建立',
    '个人 IP 机会'
  ]::text[],
  search_keywords = array[
    'personal branding',
    'personal ip',
    'build a personal brand',
    'creator positioning',
    'thought leadership'
  ]::text[]
where target_audience is null
  and (slug = 'personal-ip' or name = 'Personal IP');

alter table video_analyses alter column run_id drop not null;

alter table video_analyses add column if not exists content_format text;
alter table video_analyses add column if not exists cta_type text;
alter table video_analyses add column if not exists why_it_works text;
alter table video_analyses add column if not exists what_not_to_copy text;
alter table video_analyses add column if not exists replicability_score smallint;
alter table video_analyses add column if not exists value_types jsonb;
alter table video_analyses add column if not exists tags text[] not null default '{}';
alter table video_analyses add column if not exists niche_id uuid;
alter table video_analyses add column if not exists is_latest boolean not null default true;
alter table video_analyses add column if not exists pain_point_category text;
alter table video_analyses add column if not exists topic_category text;
alter table video_analyses add column if not exists audience_category text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'video_analyses_replicability_score_chk'
  ) then
    alter table video_analyses
      add constraint video_analyses_replicability_score_chk
      check (replicability_score is null or (replicability_score >= 0 and replicability_score <= 100));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'video_analyses_niche_id_fkey'
  ) then
    alter table video_analyses
      add constraint video_analyses_niche_id_fkey
      foreign key (niche_id) references projects(id) on delete set null;
  end if;
end $$;

update video_analyses a
set niche_id = r.project_id
from research_runs r
where a.run_id = r.id
  and a.niche_id is null;

update video_analyses a
set is_latest = false
where exists (
  select 1 from video_analyses newer
  where newer.video_id = a.video_id
    and (newer.created_at, newer.id) > (a.created_at, a.id)
);

create index if not exists video_analyses_niche_latest_idx on video_analyses (niche_id, is_latest);
create index if not exists video_analyses_video_id_idx on video_analyses (video_id);
create index if not exists video_analyses_hook_type_idx on video_analyses (hook_type);
create index if not exists video_analyses_emotion_idx on video_analyses (emotion);
create index if not exists video_analyses_content_structure_idx on video_analyses (content_structure);
create index if not exists video_analyses_content_format_idx on video_analyses (content_format);
create index if not exists video_analyses_cta_type_idx on video_analyses (cta_type);
create index if not exists video_analyses_audience_category_idx on video_analyses (audience_category);
create index if not exists video_analyses_pain_point_category_idx on video_analyses (pain_point_category);
create index if not exists video_analyses_topic_category_idx on video_analyses (topic_category);
create index if not exists video_analyses_tags_gin on video_analyses using gin (tags);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references projects(id) on delete cascade,
  run_id uuid references research_runs(id) on delete set null,
  title text not null,
  topic text,
  target_audience text,
  pain_point text,
  recommended_hook text,
  angle text,
  content_structure text,
  why_now text,
  opportunity_type text check (
    opportunity_type is null or opportunity_type in (
      'trend_ride',
      'evergreen_search',
      'pain_point_deep_dive',
      'conversion_play',
      'contrarian_take',
      'format_remix'
    )
  ),
  platform_suggestion text,
  evidence jsonb,
  evidence_video_ids uuid[],
  ai_task_run_id uuid references ai_task_runs(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists opportunities_niche_created_idx on opportunities (niche_id, created_at desc);
create index if not exists opportunities_run_idx on opportunities (run_id);
create index if not exists opportunities_status_idx on opportunities (status);

create table if not exists intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('run', 'niche')),
  niche_id uuid not null references projects(id) on delete cascade,
  run_id uuid references research_runs(id) on delete set null,
  window text not null check (window in ('run', '7d', '30d', 'all')),
  video_count integer,
  analyzed_count integer,
  frequencies jsonb,
  summary jsonb,
  raw_json jsonb,
  model text,
  prompt_version text,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  error text,
  ai_task_run_id uuid references ai_task_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists intelligence_reports_niche_level_window_idx
  on intelligence_reports (niche_id, level, window, created_at desc);
create index if not exists intelligence_reports_run_idx on intelligence_reports (run_id);
`;
