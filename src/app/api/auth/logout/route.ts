import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';

function isSecureRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Logout realizado com sucesso' });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
