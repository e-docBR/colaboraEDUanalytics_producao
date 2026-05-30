import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Public routes - no auth required
  const publicPaths = ['/login'];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    // If user is already logged in and goes to /login, redirect to home
    const sessionToken = request.cookies.get('session_token')?.value;
    if (await verifySessionToken(sessionToken)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Allow auth API routes (login, logout, me, seed)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const session = await verifySessionToken(sessionToken);
    if (session) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Erro ao validar sessão');
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
