import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const subjects = await db.subject.findMany({
      include: {
        _count: {
          select: { grades: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar disciplinas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
