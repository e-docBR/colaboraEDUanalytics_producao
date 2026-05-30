import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schools: user.schools.map((us) => ({
          id: us.school.id,
          name: us.school.name,
          role: us.role,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar sessão:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
