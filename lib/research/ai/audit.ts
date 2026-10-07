import 'server-only';
import { getDb } from '@/lib/db';

export type AITaskStatus = 'running' | 'complete' | 'failed';

export interface AIInputSource {
  video_id?: string;
  video_ids?: string[];
  run_id?: string | null;
  niche_id?: string | null;
  window?: string;
  [key: string]: unknown;
}

export class AIAnalysisError extends Error {
  readonly aiTaskRunId: string | null;

  constructor(message: string, aiTaskRunId: string | null) {
    super(message);
    this.name = 'AIAnalysisError';
    this.aiTaskRunId = aiTaskRunId;
  }
}

export function isAIAnalysisError(err: unknown): err is AIAnalysisError {
  return (
    err instanceof AIAnalysisError ||
    (err instanceof Error && err.name === 'AIAnalysisError' && 'aiTaskRunId' in err)
  );
}

export async function startAiTaskRun(input: {
  taskType: string;
  model: string;
  promptVersion: string | null;
  inputSource: AIInputSource | null;
  requestMeta: Record<string, unknown> | null;
}): Promise<string> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    insert into ai_task_runs (task_type, model, prompt_version, status, input_source, request_meta)
    values (
      ${input.taskType},
      ${input.model},
      ${input.promptVersion},
      'running',
      ${input.inputSource ? sql.json(input.inputSource as never) : null},
      ${input.requestMeta ? sql.json(input.requestMeta as never) : null}
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error('Could not record the AI task');
  return id;
}

export async function finishAiTaskRun(input: {
  id: string;
  status: 'complete' | 'failed';
  error: string | null;
  latencyMs: number;
  rawJson: unknown;
  mode?: string | null;
}): Promise<void> {
  const sql = getDb();
  const latency = Math.max(0, Math.round(input.latencyMs));
  const error = input.error ? input.error.slice(0, 4000) : null;
  if (input.mode) {
    await sql`
      update ai_task_runs
      set status = ${input.status},
          error = ${error},
          latency_ms = ${latency},
          raw_json = ${input.rawJson == null ? null : sql.json(input.rawJson as never)},
          request_meta = coalesce(request_meta, '{}'::jsonb) || ${sql.json({ mode: input.mode } as never)},
          finished_at = now()
      where id = ${input.id}
    `;
    return;
  }
  await sql`
    update ai_task_runs
    set status = ${input.status},
        error = ${error},
        latency_ms = ${latency},
        raw_json = ${input.rawJson == null ? null : sql.json(input.rawJson as never)},
        finished_at = now()
    where id = ${input.id}
  `;
}
