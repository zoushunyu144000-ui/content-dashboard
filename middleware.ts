import { NextResponse, type NextRequest } from 'next/server';
import { readSessionToken } from '@/lib/auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // API routes return their own 401. A redirect here would turn that into a 307.
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('ci_session')?.value;
  const session = token ? await readSessionToken(token) : null;

  if (pathname === '/login') {
    if (session) {
      return relativeRedirect('/');
    }
    return NextResponse.next();
  }

  if (!session) {
    const next = `${pathname}${search || ''}`;
    const target = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
    return relativeRedirect(target);
  }

  return NextResponse.next();
}

/**
 * Behind Cloudflare Tunnel + HOSTNAME=127.0.0.1, request.url resolves to
 * localhost:3100, so absolute redirects would send phones to localhost.
 * A relative Location header is valid (RFC 7231) and keeps the public host.
 */
function relativeRedirect(location: string) {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
