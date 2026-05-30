import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureClassAccess, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    const { id } = await params;
    await ensureClassAccess(currentUser, id);

    const schoolClass = await db.schoolClass.findUnique({
      where: { id },
      include: {
        school: true,
        students: {
          include: {
            grades: {
              include: {
                subject: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    // Get all subjects
    const subjects = await db.subject.findMany({
      orderBy: { name: 'asc' },
    });

    // Calculate statistics
    const totalStudents = schoolClass.students.length;
    const approved = schoolClass.students.filter((s) =>
      ['APROVADO', 'APROVADO POR CONSELHO'].includes(s.finalResult)
    ).length;
    const failed = schoolClass.students.filter((s) => s.finalResult === 'REPROVADO').length;

    const allGrades = schoolClass.students.flatMap((s) => s.grades.map((g) => g.score));
    const overallAvg = allGrades.length > 0
      ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length
      : 0;

    const zeroCount = allGrades.filter((g) => g === 0).length;

    // Average by subject for this class
    const subjectAverages = subjects.map((subject) => {
      const grades = schoolClass.students
        .flatMap((s) => s.grades)
        .filter((g) => g.subjectId === subject.id);

      const avg = grades.length > 0
        ? grades.reduce((a, b) => a + b.score, 0) / grades.length
        : 0;

      const zeros = grades.filter((g) => g.score === 0).length;

      return {
        subjectId: subject.id,
        subject: subject.name,
        average: Math.round(avg * 100) / 100,
        count: grades.length,
        zeroCount: zeros,
      };
    }).sort((a, b) => a.average - b.average);

    // Student details
    const studentDetails = schoolClass.students.map((student) => {
      const studentAvg = student.grades.length > 0
        ? student.grades.reduce((a, b) => a + b.score, 0) / student.grades.length
        : 0;

      const gradesMap: Record<string, number> = {};
      student.grades.forEach((g) => {
        gradesMap[g.subject.name] = g.score;
      });

      return {
        id: student.id,
        name: student.name,
        birthDate: student.birthDate,
        gender: student.gender,
        finalResult: student.finalResult,
        average: Math.round(studentAvg * 100) / 100,
        totalGrades: student.grades.length,
        zeroCount: student.grades.filter((g) => g.score === 0).length,
        grades: gradesMap,
      };
    });

    return NextResponse.json({
      class: {
        id: schoolClass.id,
        grade: schoolClass.grade,
        name: schoolClass.name,
        shift: schoolClass.shift,
        year: schoolClass.year,
        minimumAverage: schoolClass.minimumAverage,
      },
      school: {
        id: schoolClass.school.id,
        name: schoolClass.school.name,
        city: schoolClass.school.city,
        state: schoolClass.school.state,
      },
      statistics: {
        totalStudents,
        approvedCount: approved,
        failedCount: failed,
        approvalRate: totalStudents > 0 ? Math.round((approved / totalStudents) * 10000) / 100 : 0,
        failureRate: totalStudents > 0 ? Math.round((failed / totalStudents) * 10000) / 100 : 0,
        overallAverage: Math.round(overallAvg * 100) / 100,
        totalGrades: allGrades.length,
        zeroCount,
      },
      subjectAverages,
      students: studentDetails,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar relatório da turma:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
