export const version = '0002_video_analysis_relevance';

export const sql = `
alter table video_analyses add column if not exists relevance smallint;
alter table video_analyses add column if not exists relevance_reason text;
`;
