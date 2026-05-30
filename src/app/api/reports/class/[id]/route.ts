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

    // Fetch class and school details
    const schoolClass = await db.schoolClass.findUnique({
      where: { id },
      include: {
        school: true,
      },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
    }

    // Fetch students belonging to the class
    const students = await db.student.findMany({
      where: { classId: id },
      orderBy: { name: 'asc' },
    });

    // Fetch grades for all these students in a single query
    const studentIds = students.map((s) => s.id);
    const grades = await db.grade.findMany({
      where: {
        studentId: { in: studentIds },
      },
      include: {
        subject: true,
      },
    });

    // Map unique subjects from the fetched grades
    const uniqueSubjectsMap = new Map<string, { id: string; name: string }>();
    grades.forEach((g) => {
      if (g.subject) {
        uniqueSubjectsMap.set(g.subject.id, {
          id: g.subject.id,
          name: g.subject.name,
        });
      }
    });
    const subjects = Array.from(uniqueSubjectsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Calculate statistics
    const totalStudents = students.length;
    const approved = students.filter((s) =>
      ['APROVADO', 'APROVADO POR CONSELHO'].includes(s.finalResult)
    ).length;
    const failed = students.filter((s) => s.finalResult === 'REPROVADO').length;

    const allGrades = grades.map((g) => g.score);
    const overallAvg = allGrades.length > 0
      ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length
      : 0;

    const zeroCount = allGrades.filter((g) => g === 0).length;

    // Group grades by subject for fast O(1) lookups
    const gradesBySubject = new Map<string, typeof grades>();
    grades.forEach((g) => {
      let list = gradesBySubject.get(g.subjectId);
      if (!list) {
        list = [];
        gradesBySubject.set(g.subjectId, list);
      }
      list.push(g);
    });

    // Average by subject for this class
    const subjectAverages = subjects.map((subject) => {
      const subjectGrades = gradesBySubject.get(subject.id) || [];

      const avg = subjectGrades.length > 0
        ? subjectGrades.reduce((a, b) => a + b.score, 0) / subjectGrades.length
        : 0;

      const zeros = subjectGrades.filter((g) => g.score === 0).length;

      return {
        subjectId: subject.id,
        subject: subject.name,
        average: Math.round(avg * 100) / 100,
        count: subjectGrades.length,
        zeroCount: zeros,
      };
    }).sort((a, b) => a.average - b.average);

    // Group grades by student for fast O(1) lookups
    const gradesByStudent = new Map<string, typeof grades>();
    grades.forEach((g) => {
      let list = gradesByStudent.get(g.studentId);
      if (!list) {
        list = [];
        gradesByStudent.set(g.studentId, list);
      }
      list.push(g);
    });

    // Student details
    const studentDetails = students.map((student) => {
      const studentGrades = gradesByStudent.get(student.id) || [];
      const studentAvg = studentGrades.length > 0
        ? studentGrades.reduce((a, b) => a + b.score, 0) / studentGrades.length
        : 0;

      const gradesMap: Record<string, number> = {};
      studentGrades.forEach((g) => {
        if (g.subject) {
          gradesMap[g.subject.name] = g.score;
        }
      });

      return {
        id: student.id,
        name: student.name,
        birthDate: student.birthDate,
        gender: student.gender,
        finalResult: student.finalResult,
        average: Math.round(studentAvg * 100) / 100,
        totalGrades: studentGrades.length,
        zeroCount: studentGrades.filter((g) => g.score === 0).length,
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
