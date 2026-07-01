import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildStudentWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

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

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId, grade });
    if (shift) {
      studentWhere.schoolClass = {
        ...(studentWhere.schoolClass as object),
        shift,
      };
    }

    const students = await db.student.findMany({
      where: studentWhere,
      include: {
        grades: { include: { subject: true } },
        schoolClass: { select: { grade: true, name: true, shift: true } },
      },
      orderBy: { name: 'asc' },
    });

    const ranking = students.map((student) => {
      const grades = student.grades;
      const totalGrades = grades.length;
      const avg = totalGrades > 0
        ? Math.round((grades.reduce((a, b) => a + b.score, 0) / totalGrades) * 100) / 100
        : 0;
      const gradesMap: Record<string, number> = {};
      grades.forEach((g) => { gradesMap[g.subject.name] = g.score; });
      const zeros = grades.filter((g) => g.score === 0).length;
      const above15 = grades.filter((g) => g.score >= 15).length;
      const maxGrade = totalGrades > 0 ? Math.max(...grades.map((g) => g.score)) : 0;
      const minGrade = totalGrades > 0 ? Math.min(...grades.map((g) => g.score)) : 0;
      const sortedByScore = [...grades].sort((a, b) => b.score - a.score);
      const bestSubject = sortedByScore[0] ? { name: sortedByScore[0].subject.name, score: sortedByScore[0].score } : null;
      const worstSubject = sortedByScore[sortedByScore.length - 1] ? { name: sortedByScore[sortedByScore.length - 1].subject.name, score: sortedByScore[sortedByScore.length - 1].score } : null;

      return {
        studentId: student.id, name: student.name,
        className: student.schoolClass
          ? formatClassName(student.schoolClass.grade, student.schoolClass.name)
          : '-',
        shift: student.schoolClass?.shift || '-', finalResult: student.finalResult,
        average: avg, totalGrades, zeros, above15,
        maxGrade: Math.round(maxGrade * 10) / 10,
        minGrade: Math.round(minGrade * 10) / 10,
        bestSubject, worstSubject, grades: gradesMap, position: 0,
      };
    });

    // Sort by student name alphabetically (ranking positions still assigned by average)
    ranking.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    // Assign positions based on average (for ranking display)
    const byAverage = [...ranking].sort((a, b) => b.average - a.average);

    let currentPosition = 1;
    for (let i = 0; i < byAverage.length; i++) {
      if (i > 0 && byAverage[i].average < byAverage[i - 1].average) currentPosition = i + 1;
      byAverage[i].position = currentPosition;
    }
    // Apply positions to alphabetically sorted ranking
    const positionMap = new Map(byAverage.map((s) => [s.studentId, s.position]));
    for (const s of ranking) {
      s.position = positionMap.get(s.studentId)!;
    }

    const totalStudents = ranking.length;
    const overallAvg = totalStudents > 0 ? Math.round((ranking.reduce((a, b) => a + b.average, 0) / totalStudents) * 100) / 100 : 0;
    const distribution = {
      zeroTo5: ranking.filter((s) => s.average < 5).length,
      fiveTo10: ranking.filter((s) => s.average >= 5 && s.average < 10).length,
      tenTo15: ranking.filter((s) => s.average >= 10 && s.average < 15).length,
      fifteenTo20: ranking.filter((s) => s.average >= 15 && s.average < 20).length,
      twentyTo25: ranking.filter((s) => s.average >= 20 && s.average < 25).length,
      above25: ranking.filter((s) => s.average >= 25).length,
    };

    const topStudents = byAverage.slice(0, 10);
    const bottomStudents = byAverage.slice(-10).reverse();

    const classBreakdown = (() => {
      const map = new Map<string, { className: string; students: number; totalAvg: number }>();
      for (const s of ranking) {
        if (!map.has(s.className)) map.set(s.className, { className: s.className, students: 0, totalAvg: 0 });
        const entry = map.get(s.className)!;
        entry.students++;
        entry.totalAvg += s.average;
      }
      return [...map.values()].map((e) => ({
        className: e.className, students: e.students,
        average: Math.round((e.totalAvg / e.students) * 100) / 100,
      })).sort((a, b) => b.average - a.average);
    })();

    return NextResponse.json({
      ranking, topStudents, bottomStudents, classBreakdown, distribution,
      totalStudents, overallAvg,
      highestAvg: byAverage[0]?.average || 0,
      lowestAvg: byAverage[byAverage.length - 1]?.average || 0,
      totalZeros: ranking.reduce((a, b) => a + b.zeros, 0),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar ranking:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
