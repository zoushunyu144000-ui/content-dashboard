import 'server-only';
import { migrations } from '@/db/migrations';
import { getDb } from '@/lib/db';

const LOCK_KEY = 81420001;

export async function runMigrations(): Promise<void> {
  const sql = getDb();
  const reserved = await sql.reserve();
  try {
    await reserved`select pg_advisory_lock(${LOCK_KEY})`;
    await reserved`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const applied = await reserved<{ version: string }[]>`select version from schema_migrations`;
    const have = new Set(applied.map((row) => row.version));
    for (const migration of migrations) {
      if (have.has(migration.version)) continue;
      await reserved.begin(async (tx) => {
        await tx.unsafe(migration.sql);
        await tx`insert into schema_migrations (version) values (${migration.version})`;
      });
      console.log(`[migrate] applied ${migration.version}`);
    }
  } finally {
    try {
      await reserved`select pg_advisory_unlock(${LOCK_KEY})`;
    } catch (err) {
      console.error('[migrate] unlock failed', err);
    }
    reserved.release();
  }
}
