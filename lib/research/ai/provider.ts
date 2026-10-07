import 'server-only';
import { getServerEnv } from '@/lib/env.server';
import {
  finishAiTaskRun,
  isAIAnalysisError,
  startAiTaskRun,
  AIAnalysisError,
  type AIInputSource,
} from './audit';
import { stripForStrict, type JsonSchema } from './schema';
import { validateJson } from './validate';

export type AIMode = 'json_schema' | 'json_object' | 'prompt';

export interface CompleteJsonParams {
  task: string;
  system: string;
  user: string;
  schemaName: string;
  schema: JsonSchema;
  maxTokens?: number;
  timeoutMs?: number;
  promptVersion?: string;
  inputSource?: AIInputSource | null;
  requestMeta?: Record<string, unknown> | null;
}

export interface CompleteJsonResult<T> {
  data: T;
  model: string;
  mode: AIMode;
  raw: string;
  aiTaskRunId: string;
}

export interface AIProvider {
  id: string;
  completeJson<T>(params: CompleteJsonParams): Promise<CompleteJsonResult<T>>;
}

export { AIAnalysisError, isAIAnalysisError };

const modeCache = globalThis as unknown as { __contentIntelAiMode?: AIMode };
const MODE_ORDER: AIMode[] = ['json_schema', 'json_object', 'prompt'];

/** Gemini 2.5 and older must never be selected, including as a fallback. */
const OLD_GEMINI = /gemini[-_.]?(?:1|2)(?:[-_.]|$)|gemini-pro(?:[-_.]|$)|gemini-flash-latest/i;

class ModeRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModeRejectedError';
  }
}

function parseModelJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  else if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new SyntaxError('response was not JSON');
  }
}

function assertCurrentModel(model: string): void {
  if (OLD_GEMINI.test(model)) {
    throw new Error('AI_MODEL is Gemini 2.5 or older and is not allowed');
  }
}

class OpenAICompatibleProvider implements AIProvider {
  id = 'openai-compatible';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async completeJson<T>(params: CompleteJsonParams): Promise<CompleteJsonResult<T>> {
    const started = Date.now();
    const taskRunId = await startAiTaskRun({
      taskType: params.task,
      model: this.model,
      promptVersion: params.promptVersion ?? null,
      inputSource: params.inputSource ?? null,
      requestMeta: {
        schema_name: params.schemaName,
        max_tokens: params.maxTokens ?? 8000,
        timeout_ms: params.timeoutMs ?? 120_000,
        ...(params.requestMeta ?? {}),
      },
    });
    let lastRaw: string | null = null;
    let lastParsed: unknown;
    let parsedOnce = false;

    try {
      const preferred = modeCache.__contentIntelAiMode;
      const modes = preferred
        ? [preferred, ...MODE_ORDER.filter((mode) => mode !== preferred)]
        : MODE_ORDER;
      let lastError = 'no response';

      for (const mode of modes) {
        let user = params.user;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const raw = await this.request(mode, params, user);
            lastRaw = raw;
            let parsed: unknown;
            try {
              parsed = parseModelJson(raw);
            } catch (err) {
              parsedOnce = false;
              if (err instanceof SyntaxError) {
                lastError = err.message;
                user = `${params.user}\n\nThe previous response was not valid JSON. Return only a JSON object.`;
                continue;
              }
              throw err;
            }
            lastParsed = parsed;
            parsedOnce = true;
            const verdict = validateJson(parsed, params.schema);
            if (!verdict.ok) {
              lastError = verdict.errors.slice(0, 8).join('; ');
              user = `${params.user}\n\nThe previous JSON failed validation: ${lastError}\nReturn only corrected JSON.`;
              continue;
            }
            modeCache.__contentIntelAiMode = mode;
            await finishAiTaskRun({
              id: taskRunId,
              status: 'complete',
              error: null,
              latencyMs: Date.now() - started,
              rawJson: parsed,
              mode,
            });
            return { data: parsed as T, model: this.model, mode, raw, aiTaskRunId: taskRunId };
          } catch (err) {
            if (err instanceof ModeRejectedError) {
              lastError = err.message;
              break;
            }
            if (err instanceof SyntaxError) {
              parsedOnce = false;
              lastError = err.message;
              user = `${params.user}\n\nThe previous response was not valid JSON. Return only a JSON object.`;
              continue;
            }
            throw err;
          }
        }
      }

      throw new Error(`AI response failed validation (${lastError})`);
    } catch (err) {
      if (isAIAnalysisError(err)) throw err;
      const message = err instanceof Error ? err.message : 'AI request failed';
      const rawJson = parsedOnce ? lastParsed : lastRaw != null ? { raw_text: lastRaw } : null;
      try {
        await finishAiTaskRun({
          id: taskRunId,
          status: 'failed',
          error: message,
          latencyMs: Date.now() - started,
          rawJson,
        });
      } catch (writeErr) {
        const writeMessage = writeErr instanceof Error ? writeErr.message : 'audit write failed';
        throw new AIAnalysisError(`${message} (audit log failed: ${writeMessage})`, taskRunId);
      }
      throw new AIAnalysisError(message, taskRunId);
    }
  }

  private async request(mode: AIMode, params: CompleteJsonParams, user: string): Promise<string> {
    let system = params.system;
    if (mode !== 'json_schema') {
      system += `\n\nReturn JSON only. Schema ${params.schemaName}: ${JSON.stringify(params.schema)}`;
    }
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: 0.2,
      max_tokens: params.maxTokens ?? 8000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    if (mode === 'json_schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: stripForStrict(params.schema),
        },
      };
    } else if (mode === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 120_000);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        if ((response.status === 400 || response.status === 422) && /response_format|json_schema|structured/i.test(text)) {
          throw new ModeRejectedError(`mode ${mode} was rejected`);
        }
        throw new Error(`AI request failed (${response.status})`);
      }
      const payload = JSON.parse(text) as { choices?: { message?: { content?: string | null } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content || !content.trim()) throw new Error('AI response was empty');
      return content;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw new Error('AI request timed out');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getAIProvider(tier: 'default' | 'intel' = 'default'): AIProvider {
  const env = getServerEnv();
  const model: string = (tier === 'intel' ? process.env.AI_MODEL_INTEL?.trim() || env.aiModel : env.aiModel) || '';
  if ((env.aiProvider || 'openai-compatible') !== 'openai-compatible') {
    throw new Error(`AI_PROVIDER "${env.aiProvider}" is not supported`);
  }
  if (!env.aiModel) throw new Error('AI_MODEL is not configured');
  assertCurrentModel(model);
  if (!env.aiBaseUrl) throw new Error('AI_BASE_URL is not configured');
  if (env.aiBaseUrl.includes('generativelanguage.googleapis.com')) {
    throw new Error('Direct Gemini API calls are not allowed');
  }
  if (!env.aiApiKey) throw new Error('AI_API_KEY is not configured');
  return new OpenAICompatibleProvider(env.aiBaseUrl, env.aiApiKey, model);
}
