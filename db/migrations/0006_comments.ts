export const version = '0006_comments';

// Idempotent. TikTok comments collected for a video. Failures in the collector must not block a run.
export const sql = `
create table if not exists video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  platform_comment_id text not null,
  text text not null,
  likes int,
  author text,
  created_at_platform timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists video_comments_video_comment_uidx
  on video_comments (video_id, platform_comment_id);
`;
