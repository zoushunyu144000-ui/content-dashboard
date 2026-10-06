import 'server-only';
import { cookies } from 'next/headers';
import { readSessionToken, signSessionToken, type SessionClaims } from '@/lib/auth/jwt';

export const SESSION_COOKIE = 'ci_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function setSessionCookie(user: { id: string; email: string; role: 'admin' | 'member' }) {
  const token = await signSessionToken({ sub: user.id, email: user.email, role: user.role });
  cookies().set(SESSION_COOKIE, token, cookieOptions(MAX_AGE_SECONDS));
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', cookieOptions(0));
}

export async function readSessionCookie(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}
