import 'server-only';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env.server';

export async function ensureAdmin(): Promise<void> {
  const env = getServerEnv();
  if (!env.adminEmail || !env.adminPassword) {
    console.error('[boot] ADMIN_EMAIL and ADMIN_PASSWORD are required to create the first admin');
    return;
  }
  const sql = getDb();
  const existing = await sql<{ id: string }[]>`
    select id from users where lower(email) = ${env.adminEmail} limit 1
  `;
  if (existing.length === 0) {
    const hash = await bcrypt.hash(env.adminPassword, 12);
    await sql`
      insert into users (email, password_hash, role)
      values (${env.adminEmail}, ${hash}, 'admin')
    `;
    console.log('[boot] created admin user');
    return;
  }
  if (env.adminResetPassword) {
    const hash = await bcrypt.hash(env.adminPassword, 12);
    await sql`
      update users set password_hash = ${hash}, role = 'admin' where id = ${existing[0].id}
    `;
    console.log('[boot] reset admin password');
  }
}
