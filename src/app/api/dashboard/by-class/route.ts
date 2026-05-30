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
          select: { name: true },
        },
        _count: {
          select: { students: true },
        },
        students: {
          select: { finalResult: true },
        },
      },
      orderBy: [{ schoolId: 'asc' }, { grade: 'asc' }, { name: 'asc' }, { shift: 'asc' }],
    });

    const classesWithStats = await Promise.all(
      classes.map(async (cls) => {
        const avgResult = await db.grade.aggregate({
          _avg: { score: true },
          where: {
            student: { classId: cls.id },
          },
        });

        const approved = cls.students.filter((s) =>
          ['APROVADO', 'APROVADO POR CONSELHO'].includes(s.finalResult)
        ).length;
        const failed = cls.students.filter((s) => s.finalResult === 'REPROVADO').length;

        return {
          id: cls.id,
          grade: cls.grade,
          name: cls.name,
          shift: cls.shift,
          year: cls.year,
          minimumAverage: cls.minimumAverage,
          school: cls.school.name,
          studentCount: cls._count.students,
          average: Math.round((avgResult._avg.score || 0) * 100) / 100,
          approvedCount: approved,
          failedCount: failed,
          approvalRate: cls._count.students > 0
            ? Math.round((approved / cls._count.students) * 10000) / 100
            : 0,
          failureRate: cls._count.students > 0
            ? Math.round((failed / cls._count.students) * 10000) / 100
            : 0,
        };
      })
    );

    return NextResponse.json({
      classes: classesWithStats,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar dados por turma:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
