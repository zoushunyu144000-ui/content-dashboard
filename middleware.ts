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
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    const next = `${pathname}${search || ''}`;
    if (next && next !== '/') url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
