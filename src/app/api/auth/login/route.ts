import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparePassword } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/session';

function isSecureRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        schools: {
          include: { school: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await createSessionToken(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        schools: user.schools.map((us) => ({
          id: us.school.id,
          name: us.school.name,
          role: us.role,
        })),
      },
    });

    // Set cookie
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
