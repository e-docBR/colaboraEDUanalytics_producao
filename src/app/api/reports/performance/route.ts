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

    const subjects = await db.subject.findMany({ orderBy: { name: 'asc' } });

    const grades = await db.grade.findMany({
      where: { student: studentWhere },
      include: {
        student: { include: { schoolClass: { select: { grade: true, name: true, shift: true } } } },
        subject: true,
      },
    });

    const subjectDetails = subjects.map((subject) => {
      const subjectGrades = grades.filter((g) => g.subjectId === subject.id);
      const scores = subjectGrades.map((g) => g.score);

      if (scores.length === 0) {
        return {
          subject: subject.name, count: 0, average: 0, median: 0, stdDeviation: 0,
          min: 0, max: 0, q1: 0, q3: 0, zeros: 0, below10: 0, between10and20: 0,
          above20: 0, passRate: 0, failRate: 100,
          distribution: { zero: 0, low: 0, medium: 0, high: 0, excellent: 0 },
          classBreakdown: [], topStudents: [], bottomStudents: [],
        };
      }

      const sorted = [...scores].sort((a, b) => a - b);
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / scores.length) * 100) / 100;
      const median = scores.length % 2 === 0
        ? Math.round(((sorted[scores.length / 2 - 1] + sorted[scores.length / 2]) / 2) * 10) / 10
        : sorted[Math.floor(scores.length / 2)];
      const variance = scores.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / scores.length;
      const stdDeviation = Math.round(Math.sqrt(variance) * 100) / 100;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
      const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;

      const zeros = scores.filter((s) => s === 0).length;
      const below10 = scores.filter((s) => s > 0 && s < 10).length;
      const between10and20 = scores.filter((s) => s >= 10 && s < 20).length;
      const above20 = scores.filter((s) => s >= 20).length;
      const passRate = scores.length > 0 ? Math.round(((scores.length - below10 - zeros) / scores.length) * 10000) / 100 : 0;

      const distribution = {
        zero: zeros, low: below10, medium: between10and20,
        high: above20, excellent: scores.filter((s) => s >= 25).length,
      };

      const classMap = new Map<string, { className: string; scores: number[] }>();
      for (const g of subjectGrades) {
        const className = g.student.schoolClass ? `${g.student.schoolClass.grade} ${g.student.schoolClass.name}` : 'Sem turma';
        if (!classMap.has(className)) classMap.set(className, { className, scores: [] });
        classMap.get(className)!.scores.push(g.score);
      }
      const classBreakdown = [...classMap.values()].map((c) => ({
        className: c.className, count: c.scores.length,
        average: Math.round((c.scores.reduce((a, b) => a + b, 0) / c.scores.length) * 100) / 100,
        min: Math.min(...c.scores), max: Math.max(...c.scores),
        zeros: c.scores.filter((s) => s === 0).length,
      }));

      const studentScores = subjectGrades.map((g) => ({
        studentName: g.student.name,
        className: g.student.schoolClass ? `${g.student.schoolClass.grade} ${g.student.schoolClass.name}` : '-',
        score: g.score,
      })).sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR'));

      // Top 5 and bottom 5 by score, sorted alphabetically
      const byScore = [...studentScores].sort((a, b) => b.score - a.score);
      const topStudents = byScore.slice(0, 5).sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR'));
      const bottomStudents = byScore.slice(-5).reverse().sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR'));

      return {
        subject: subject.name, count: scores.length, average: avg, median, stdDeviation,
        min, max, q1, q3, zeros, below10, between10and20, above20,
        passRate, failRate: 100 - passRate, distribution, classBreakdown,
        topStudents, bottomStudents,
      };
    });

    const subjectRanking = [...subjectDetails].filter((s) => s.count > 0).sort((a, b) => a.average - b.average);
    const criticalThreshold = 15;
    const criticalSubjects = subjectDetails.filter((s) => s.average < criticalThreshold && s.count > 0);

    return NextResponse.json({
      subjects: subjectDetails, subjectRanking, criticalSubjects,
      criticalThreshold, totalSubjects: subjects.length, totalGrades: grades.length,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar análise por disciplina:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
