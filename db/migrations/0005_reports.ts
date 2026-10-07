export const version = '0005_reports';

// Idempotent. Structured research report. TXT and other exports render report_json.
export const sql = `
create table if not exists research_reports (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references research_runs(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  report_version text,
  model text,
  prompt_version text,
  report_json jsonb not null,
  executive_summary text,
  status text not null default 'complete',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_reports_run_created_idx
  on research_reports (research_run_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'research_reports_status_chk'
  ) then
    alter table research_reports
      add constraint research_reports_status_chk
      check (status in ('complete', 'partial'));
  end if;
end $$;
`;
