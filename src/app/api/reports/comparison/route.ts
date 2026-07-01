import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildClassWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

function formatClassName(grade: string, name: string) {
  const cleanGrade = grade.trim();
  const cleanName = name.trim();

  if (!cleanName) return cleanGrade;
  if (
    cleanGrade
      .toLocaleUpperCase('pt-BR')
      .endsWith(` ${cleanName.toLocaleUpperCase('pt-BR')}`)
  ) {
    return cleanGrade;
  }

  return `${cleanGrade} ${cleanName}`;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');
    const grade = searchParams.get('grade');

    const schoolFilter: Prisma.SchoolClassWhereInput = await buildClassWhereForUser(currentUser, { schoolId, classId, grade });
    if (shift) schoolFilter.shift = shift;

    const classes = await db.schoolClass.findMany({
      where: schoolFilter,
      include: {
        students: {
          include: { grades: { include: { subject: true } } },
          orderBy: { name: 'asc' },
        },
        school: { select: { name: true } },
      },
      orderBy: [
        { grade: 'asc' },
        { name: 'asc' },
        { shift: 'asc' },
      ],
    });

    const subjects = await db.subject.findMany({ orderBy: { name: 'asc' } });

    const classData = classes.map((cls) => {
      const allGrades = cls.students.flatMap((s) => s.grades);
      const totalStudents = cls.students.length;
      const totalApproved = cls.students.filter((s) =>
        ['APROVADO', 'APROVADO POR CONSELHO'].includes(s.finalResult)
      ).length;
      const totalFailed = cls.students.filter((s) => s.finalResult === 'REPROVADO').length;
      const totalEmc = cls.students.filter((s) => s.finalResult === 'EMC').length;
      const overallAvg = allGrades.length > 0
        ? Math.round((allGrades.reduce((a, b) => a + b.score, 0) / allGrades.length) * 100) / 100
        : 0;
      const zeroCount = allGrades.filter((g) => g.score === 0).length;

      const subjectStats = subjects.map((subject) => {
        const grades = allGrades.filter((g) => g.subjectId === subject.id);
        const avg = grades.length > 0
          ? Math.round((grades.reduce((a, b) => a + b.score, 0) / grades.length) * 100) / 100
          : 0;
        const min = grades.length > 0 ? Math.min(...grades.map((g) => g.score)) : 0;
        const max = grades.length > 0 ? Math.max(...grades.map((g) => g.score)) : 0;
        const zeros = grades.filter((g) => g.score === 0).length;
        const above15 = grades.filter((g) => g.score >= 15).length;
      return {
          subject: subject.name,
          average: avg,
          min: Math.round(min * 10) / 10,
          max: Math.round(max * 10) / 10,
          count: grades.length,
          zeros,
          above15,
        };
      });

      const studentAverages = cls.students.map((student) => {
        const grades = student.grades;
        const avg = grades.length > 0
          ? Math.round((grades.reduce((a, b) => a + b.score, 0) / grades.length) * 100) / 100
          : 0;
        return { studentId: student.id, name: student.name, average: avg, finalResult: student.finalResult };
      }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      // Top and bottom students by average (for summary cards)
      const byAverage = [...studentAverages].sort((a, b) => b.average - a.average);

        return {
        classId: cls.id,
        className: formatClassName(cls.grade, cls.name),
        shift: cls.shift,
        schoolName: cls.school.name,
        totalStudents,
        totalApproved,
        totalFailed,
        totalEmc,
        approvalRate: totalStudents > 0 ? Math.round((totalApproved / totalStudents) * 10000) / 100 : 0,
        emcRate: totalStudents > 0 ? Math.round((totalEmc / totalStudents) * 10000) / 100 : 0,
        overallAverage: overallAvg,
        totalGrades: allGrades.length,
        zeroCount,
        zeroPercentage: allGrades.length > 0 ? Math.round((zeroCount / allGrades.length) * 10000) / 100 : 0,
        subjectStats,
        studentAverages,
        topStudent: byAverage[0] || null,
        bottomStudent: byAverage[byAverage.length - 1] || null,
      };
    });

    const subjectComparison = subjects.map((subject) => {
      const classEntries = classData.map((cls) => {
        const stats = cls.subjectStats.find((s) => s.subject === subject.name);
        return { className: cls.className, average: stats?.average || 0, zeros: stats?.zeros || 0, above15: stats?.above15 || 0 };
      });
      if (classEntries.length === 0) {
        return {
          subject: subject.name,
          classes: [],
          bestClass: '-',
          bestAverage: 0,
          worstClass: '-',
          worstAverage: 0,
          difference: 0,
        };
      }
      const bestClass = [...classEntries].sort((a, b) => b.average - a.average)[0];
      const worstClass = [...classEntries].sort((a, b) => a.average - b.average)[0];
      return {
        subject: subject.name,
        classes: classEntries,
        bestClass: bestClass.className,
        bestAverage: bestClass.average,
        worstClass: worstClass.className,
        worstAverage: worstClass.average,
        difference: Math.round((bestClass.average - worstClass.average) * 100) / 100,
      };
    });

    return NextResponse.json({
      classes: classData,
      subjectComparison,
      totalClasses: classData.length,
      totalStudents: classData.reduce((a, b) => a + b.totalStudents, 0),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar comparativo:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
