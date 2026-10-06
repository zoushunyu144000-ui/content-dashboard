import 'server-only';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env.server';

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __contentIntelSql?: Sql };

export function getDb(): Sql {
  if (globalForDb.__contentIntelSql) return globalForDb.__contentIntelSql;
  const url = getServerEnv().databaseUrl;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  globalForDb.__contentIntelSql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    onnotice: () => {},
  });
  return globalForDb.__contentIntelSql;
}
