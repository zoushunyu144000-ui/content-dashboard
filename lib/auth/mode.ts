import 'server-only';

/**
 * AUTH_MODE=open  — auto-issue an admin session (no password form).
 * AUTH_MODE=password — require email/password (default historical behavior).
 * Default is "open" for single-admin V0.1 on a private URL; set password to re-enable the form.
 */
export type AuthMode = 'open' | 'password';

export function getAuthMode(): AuthMode {
  const raw = (process.env.AUTH_MODE || 'open').trim().toLowerCase();
  return raw === 'password' ? 'password' : 'open';
}

export function isOpenAuth(): boolean {
  return getAuthMode() === 'open';
}
