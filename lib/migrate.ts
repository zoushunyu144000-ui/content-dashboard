import 'server-only';
import { migrations } from '@/db/migrations';
import { getDb } from '@/lib/db';

const LOCK_KEY = 81420001;

/**
 * Apply pending migrations in order. Everything runs in a single transaction
 * guarded by a transaction-scoped advisory lock, so concurrent boots serialize
 * and a failed migration leaves schema_migrations untouched.
 * (postgres.js reserved connections do not support .begin(), so we use sql.begin.)
 */
export async function runMigrations(): Promise<void> {
  const sql = getDb();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
    await tx`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const applied = await tx<{ version: string }[]>`select version from schema_migrations`;
    const have = new Set(applied.map((row) => row.version));
    for (const migration of migrations) {
      if (have.has(migration.version)) continue;
      await tx.unsafe(migration.sql);
      await tx`insert into schema_migrations (version) values (${migration.version})`;
      console.log(`[migrate] applied ${migration.version}`);
    }
  });
}
