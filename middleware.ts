import { NextResponse, type NextRequest } from 'next/server';
import { readSessionToken } from '@/lib/auth/jwt';

function isOpenAuth(): boolean {
  const raw = (process.env.AUTH_MODE || 'open').trim().toLowerCase();
  return raw !== 'password';
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // API routes return their own 401. A redirect here would turn that into a 307.
  // /api/health stays public; other APIs use requireUser (which auto-sessions in open mode).
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const open = isOpenAuth();
  const token = request.cookies.get('ci_session')?.value;
  const session = token ? await readSessionToken(token) : null;

  if (pathname === '/login') {
    // Password form disabled: send everyone to the dashboard.
    if (open || session) {
      return publicRedirect(request, '/');
    }
    return NextResponse.next();
  }

  if (!session && !open) {
    const next = `${pathname}${search || ''}`;
    const target = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
    return publicRedirect(request, target);
  }

  // Open mode: allow the page through; the first /api/auth/me (or any requireUser)
  // call silently issues the admin ci_session cookie.
  return NextResponse.next();
}

/**
 * Behind Cloudflare Tunnel + HOSTNAME=127.0.0.1, request.url resolves to
 * localhost:3100, so redirects built from it would send phones to localhost.
 * Next requires an absolute Location, so rebuild the public origin from the
 * Host / X-Forwarded-* / CF-Visitor headers the tunnel forwards.
 */
function publicRedirect(request: NextRequest, path: string) {
  const h = request.headers;
  const host = (h.get('x-forwarded-host') || h.get('host') || request.nextUrl.host).split(',')[0].trim();
  let proto = (h.get('x-forwarded-proto') || '').split(',')[0].trim();
  if (!proto) {
    const visitor = h.get('cf-visitor');
    if (visitor && visitor.includes('"https"')) proto = 'https';
  }
  if (!proto) proto = request.nextUrl.protocol.replace(':', '') || 'http';
  return NextResponse.redirect(new URL(path, `${proto}://${host}`), 307);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
