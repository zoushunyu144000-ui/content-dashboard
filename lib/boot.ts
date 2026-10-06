import 'server-only';
import { ensureAdmin } from '@/lib/auth/bootstrap';
import { runMigrations } from '@/lib/migrate';

export async function boot(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[boot] DATABASE_URL is not set; skipping migrations and admin bootstrap');
    return;
  }
  await runMigrations();
  await ensureAdmin();
}
