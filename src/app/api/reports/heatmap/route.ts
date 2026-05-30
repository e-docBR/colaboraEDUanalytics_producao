import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildClassWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');

    const classWhere: Prisma.SchoolClassWhereInput = await buildClassWhereForUser(currentUser, { schoolId, classId });
    if (shift) classWhere.shift = shift;

    const classes = await db.schoolClass.findMany({
      where: Object.keys(classWhere).length > 0 ? classWhere : undefined,
      include: {
        school: { select: { id: true, name: true } },
        students: {
          include: {
            grades: { include: { subject: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ grade: 'asc' }, { shift: 'asc' }, { name: 'asc' }],
    });

    // Get all subjects sorted alphabetically
    const subjects = await db.subject.findMany({
      orderBy: { name: 'asc' },
    });

    const result = classes.map((cls) => {
      const students = cls.students.map((student) => {
        const grades: Record<string, number> = {};
        // Initialize all subjects with null (0)
        subjects.forEach((s) => {
          grades[s.name] = 0;
        });
        // Fill in actual grades
        student.grades.forEach((g) => {
          grades[g.subject.name] = g.score;
        });

        return {
          studentId: student.id,
          studentName: student.name,
          grades,
        };
      });

      return {
        classId: cls.id,
        className: `${cls.grade} ${cls.name} - ${cls.shift}`,
        students,
      };
    });

    return NextResponse.json({
      classes: result,
      subjects: subjects.map((s) => s.name),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar dados do mapa de calor:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
