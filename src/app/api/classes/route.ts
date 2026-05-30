import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildClassWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');

    const where = await buildClassWhereForUser(currentUser, { schoolId, classId });
    if (shift) where.shift = shift;

    const classes = await db.schoolClass.findMany({
      where,
      include: {
        school: {
          select: { id: true, name: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }, { shift: 'asc' }],
    });

    return NextResponse.json({ classes });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar turmas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
