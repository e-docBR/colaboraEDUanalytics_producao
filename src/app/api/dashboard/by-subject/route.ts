import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildStudentWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId });

    const avgBySubject = await db.grade.groupBy({
      by: ['subjectId'],
      _avg: { score: true },
      _count: { score: true },
      _min: { score: true },
      _max: { score: true },
      where: {
        student: studentWhere,
      },
    });

    const subjectsWithStats = await Promise.all(
      avgBySubject.map(async (item) => {
        const subject = await db.subject.findUnique({
          where: { id: item.subjectId },
        });

        const zeroCount = await db.grade.count({
          where: {
            subjectId: item.subjectId,
            score: 0,
            student: studentWhere,
          },
        });

        // Distribution buckets
        const grades = await db.grade.findMany({
          where: {
            subjectId: item.subjectId,
            student: studentWhere,
          },
          select: { score: true },
        });

        const distribution = {
          zeroTo20: grades.filter((g) => g.score >= 0 && g.score < 20).length,
          twentyTo40: grades.filter((g) => g.score >= 20 && g.score < 40).length,
          fortyTo60: grades.filter((g) => g.score >= 40 && g.score < 60).length,
          sixtyTo80: grades.filter((g) => g.score >= 60 && g.score < 80).length,
          eightyTo100: grades.filter((g) => g.score >= 80 && g.score <= 100).length,
        };

        return {
          subjectId: item.subjectId,
          subject: subject?.name || 'Desconhecida',
          average: Math.round((item._avg.score || 0) * 100) / 100,
          min: item._min.score || 0,
          max: item._max.score || 0,
          count: item._count.score,
          zeroCount,
          distribution,
        };
      })
    );

    return NextResponse.json({
      subjects: subjectsWithStats.sort((a, b) => a.average - b.average),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar dados por disciplina:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
