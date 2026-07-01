import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureStudentAccess, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    const { id } = await params;
    await ensureStudentAccess(currentUser, id);

    const student = await db.student.findUnique({
      where: { id },
      include: {
        grades: { include: { subject: true } },
        schoolClass: {
          include: { school: true },
        },
        school: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }

    // Grades sorted by subject name
    const grades = student.grades
      .map((g) => ({
        subject: g.subject.name,
        score: g.score,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR'));

    const totalSubjects = grades.length;
    const allScores = grades.map((g) => g.score);
    const average =
      totalSubjects > 0
        ? Math.round(
            (allScores.reduce((a, b) => a + b, 0) / totalSubjects) * 100
          ) / 100
        : 0;
    const above15 = allScores.filter((s) => s >= 15).length;
    const below15 = allScores.filter((s) => s > 0 && s < 15).length;
    const zeros = allScores.filter((s) => s === 0).length;

    // Best and worst subjects (excluding zeros)
    const nonZeroGrades = grades.filter((g) => g.score > 0);
    const sortedGrades = [...nonZeroGrades].sort((a, b) => b.score - a.score);
    const bestSubject =
      sortedGrades.length > 0
        ? { name: sortedGrades[0].subject, score: sortedGrades[0].score }
        : { name: '-', score: 0 };
    const worstSubject =
      sortedGrades.length > 0
        ? {
            name: sortedGrades[sortedGrades.length - 1].subject,
            score: sortedGrades[sortedGrades.length - 1].score,
          }
        : { name: '-', score: 0 };

    // Class ranking
    const classId = student.classId;
    let classRank = 0;
    let classTotal = 0;
    let classAverage = 0;

    if (classId) {
      const classmates = await db.student.findMany({
        where: { classId },
        include: { grades: true },
      });

      classTotal = classmates.length;

      // Calculate overall class average
      const allClassGrades = classmates.flatMap((s) => s.grades.map((g) => g.score));
      classAverage = allClassGrades.length > 0
        ? Math.round((allClassGrades.reduce((a, b) => a + b, 0) / allClassGrades.length) * 100) / 100
        : 0;

      // Calculate averages for all classmates
      const ranked = classmates
        .map((s) => {
          const scores = s.grades.map((g) => g.score);
          const avg =
            scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : 0;
          return { studentId: s.id, average: avg };
        })
        .sort((a, b) => b.average - a.average);

      let position = 1;
      for (let i = 0; i < ranked.length; i++) {
        if (i > 0 && ranked[i].average < ranked[i - 1].average) {
          position = i + 1;
        }
        if (ranked[i].studentId === id) {
          classRank = position;
          break;
        }
      }
    }

    // Format position
    const position =
      classRank > 0
        ? `${classRank}º`
        : '-';

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        birthDate: student.birthDate,
        gender: student.gender,
        finalResult: student.finalResult,
        className: student.schoolClass
          ? `${student.schoolClass.grade} - ${student.schoolClass.shift}`
          : '-',
        schoolName: student.school?.name || student.schoolClass?.school?.name || '-',
      },
      grades,
      statistics: {
        average,
        totalSubjects,
        above15,
        below15,
        zeros,
        bestSubject,
        worstSubject,
        classRank,
        classTotal,
        position,
        classAverage,
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar perfil do aluno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
