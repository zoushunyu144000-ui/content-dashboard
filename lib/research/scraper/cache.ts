import 'server-only';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
    .join(',')}}`;
}

export function providerCacheKey(provider: string, endpoint: string, params: unknown): string {
  return createHash('sha256').update(`${provider}\n${endpoint}\n${stable(params)}`).digest('hex');
}

export async function readProviderCache(key: string): Promise<unknown | null> {
  const sql = getDb();
  const rows = await sql<{ response: unknown }[]>`
    select response from provider_cache
    where key = ${key} and created_at > now() - interval '24 hours'
    limit 1
  `;
  return rows[0]?.response ?? null;
}

export async function writeProviderCache(
  key: string,
  provider: string,
  request: unknown,
  response: unknown,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into provider_cache (key, provider, request, response)
    values (${key}, ${provider}, ${sql.json(request as never)}, ${sql.json(response as never)})
    on conflict (key) do update
      set request = excluded.request,
          response = excluded.response,
          created_at = now()
  `;
}
