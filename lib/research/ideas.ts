import 'server-only';
import { getDb } from '@/lib/db';
import { RELEVANCE_MIN } from '@/lib/research/relevance';
import { getAIProvider } from '@/lib/research/ai/provider';
import {
  CONTENT_IDEA_SCHEMA,
  CONTENT_IDEA_SYSTEM,
  PROMPT_VERSION,
  contentIdeaUserPrompt,
  type ContentIdeaDraft,
} from '@/lib/research/ai/tasks/content-ideas';

export async function generateIdeas(runId: string): Promise<{ count: number }> {
  const sql = getDb();
  const runs = await sql<
    {
      id: string;
      project_id: string;
      topic: string;
      status: string;
      insights: unknown;
      name: string;
      niche: string | null;
      audience: string | null;
      voice: string | null;
      target_audience: string | null;
      core_business: string | null;
    }[]
  >`
    select r.id, r.project_id, r.topic, r.status, r.insights,
           p.name, p.niche, p.audience, p.voice, p.target_audience, p.core_business
    from research_runs r
    join projects p on p.id = r.project_id
    where r.id = ${runId}
    limit 1
  `;
  const run = runs[0];
  if (!run) throw new Error('Research run was not found');
  if (run.status !== 'completed') throw new Error('Content ideas require a completed research run');

  const videos = await sql`
    select v.caption, v.author_handle, v.views, rv.viral_score
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    left join lateral (
      select relevance
      from video_analyses
      where run_id = rv.run_id and video_id = rv.video_id and status = 'complete'
      order by created_at desc
      limit 1
    ) a on true
    where rv.run_id = ${runId}
      and (a.relevance is null or a.relevance >= ${RELEVANCE_MIN})
    order by rv.viral_score desc nulls last
    limit 8
  `;
  const ai = getAIProvider();
  const result = await ai.completeJson<{ ideas: ContentIdeaDraft[] }>({
    task: 'content_ideas',
    system: CONTENT_IDEA_SYSTEM,
    user: contentIdeaUserPrompt({
      project: {
        name: run.name,
        niche: run.core_business || run.niche,
        audience: run.target_audience || run.audience,
        voice: run.voice,
      },
      topic: run.topic,
      insights: run.insights,
      topVideos: videos,
    }),
    schemaName: 'content_ideas',
    schema: CONTENT_IDEA_SCHEMA,
    maxTokens: 8000,
    timeoutMs: 120_000,
    promptVersion: PROMPT_VERSION,
    inputSource: { run_id: runId, niche_id: run.project_id, window: 'run' },
  });

  await sql.begin(async (tx) => {
    await tx`delete from research_content_ideas where run_id = ${runId}`;
    for (let index = 0; index < result.data.ideas.length; index += 1) {
      const idea = result.data.ideas[index];
      await tx`
        insert into research_content_ideas (
          run_id, project_id, position, topic, hook, angle, structure, reason, model, raw
        ) values (
          ${runId}, ${run.project_id}, ${index + 1}, ${idea.topic}, ${idea.hook}, ${idea.angle},
          ${idea.structure}, ${idea.reason}, ${result.model}, ${tx.json({ ...idea, prompt_version: PROMPT_VERSION } as never)}
        )
      `;
    }
  });
  return { count: result.data.ideas.length };
}
