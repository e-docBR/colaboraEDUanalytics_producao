import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildClassWhereForUser, buildStudentWhereForUser, buildSchoolWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');
    const grade = searchParams.get('grade');
    const threshold = parseFloat(searchParams.get('threshold') || '15');

    let schoolLogo: string | null = null;
    if (schoolId && schoolId !== '__all__') {
      const school = await db.school.findUnique({
        where: { id: schoolId },
        select: { logoUrl: true },
      });
      if (school) {
        schoolLogo = school.logoUrl;
      }
    }

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId, grade });
    if (shift) {
      studentWhere.schoolClass = {
        ...(studentWhere.schoolClass as object),
        shift,
      };
    }

    // Count total students matching the filter
    const totalStudentsCount = await db.student.count({
      where: studentWhere,
    });

    // Find all grades below threshold (including zeros)
    const lowGrades = await db.grade.findMany({
      where: {
        score: { lt: threshold },
        student: studentWhere,
      },
      include: {
        student: {
          include: {
            schoolClass: {
              select: { grade: true, name: true, shift: true, id: true },
            },
            school: {
              select: { name: true },
            },
          },
        },
        subject: true,
      },
      orderBy: { score: 'asc' },
    });

    // Count zero grades
    const zeroGradeCount = lowGrades.filter((g) => g.score === 0).length;

    // Build student-level analysis
    const studentMap = new Map<string, {
      studentId: string;
      studentName: string;
      className: string;
      classId: string;
      shift: string;
      schoolName: string;
      finalResult: string;
      lowGradeCount: number;
      totalGrades: number;
      lowGradeSubjects: Array<{ subject: string; score: number }>;
      allGrades: Array<{ subject: string; score: number }>;
      average: number;
    }>();

    const allStudentIds = [...new Set(lowGrades.map((g) => g.studentId))];

    for (const g of lowGrades) {
      if (!studentMap.has(g.studentId)) {
        studentMap.set(g.studentId, {
          studentId: g.studentId,
          studentName: g.student.name,
          className: g.student.schoolClass
            ? `${g.student.schoolClass.grade}`
            : '-',
          classId: g.student.schoolClass?.id || '',
          shift: g.student.schoolClass?.shift || '-',
          schoolName: g.student.school?.name || '-',
          finalResult: g.student.finalResult || '-',
          lowGradeCount: 0,
          totalGrades: 0,
          lowGradeSubjects: [],
          allGrades: [],
          average: 0,
        });
      }

      const entry = studentMap.get(g.studentId)!;
      entry.lowGradeCount++;
      entry.lowGradeSubjects.push({ subject: g.subject.name, score: g.score });
    }

    // Fetch ALL grades for these students (not just low ones) to calculate averages and show complete data
    if (allStudentIds.length > 0) {
      const allGrades = await db.grade.findMany({
        where: { studentId: { in: allStudentIds } },
        include: { subject: true },
      });

      const gradeCountMap = new Map<string, number>();
      const gradeSumMap = new Map<string, number>();

      for (const g of allGrades) {
        gradeCountMap.set(g.studentId, (gradeCountMap.get(g.studentId) || 0) + 1);
        gradeSumMap.set(g.studentId, (gradeSumMap.get(g.studentId) || 0) + g.score);

        // Add all grades to student entry
        const entry = studentMap.get(g.studentId);
        if (entry) {
          entry.allGrades.push({ subject: g.subject.name, score: g.score });
        }
      }

      for (const [studentId, entry] of studentMap) {
        entry.totalGrades = gradeCountMap.get(studentId) || 0;
        entry.average = Math.round(((gradeSumMap.get(studentId) || 0) / (gradeCountMap.get(studentId) || 1)) * 100) / 100;
        // Sort all grades by subject name alphabetically
        entry.allGrades.sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR'));
        // Sort low grade subjects by subject name alphabetically
        entry.lowGradeSubjects.sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR'));
      }
    }

    // Sort by student name alphabetically
    const studentsWithLowGrades = [...studentMap.values()].sort(
      (a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR')
    );

    // Build subject-level analysis
    const subjectMap = new Map<string, {
      subject: string;
      lowCount: number;
      zeroCount: number;
      totalCount: number;
      scores: number[];
    }>();

    for (const g of lowGrades) {
      if (!subjectMap.has(g.subjectId)) {
        subjectMap.set(g.subjectId, {
          subject: g.subject.name,
          lowCount: 0,
          zeroCount: 0,
          totalCount: 0,
          scores: [],
        });
      }
      const entry = subjectMap.get(g.subjectId)!;
      entry.lowCount++;
      entry.scores.push(g.score);
      if (g.score === 0) entry.zeroCount++;
    }

    // Get total count per subject
    const subjectIds = [...subjectMap.keys()];
    if (subjectIds.length > 0) {
      const subjectCounts = await db.grade.groupBy({
        by: ['subjectId'],
        _count: { id: true },
        where: { subjectId: { in: subjectIds }, student: studentWhere },
      });

      for (const sc of subjectCounts) {
        const entry = subjectMap.get(sc.subjectId);
        if (entry) {
          entry.totalCount = sc._count.id;
        }
      }
    }

    const subjectAnalysis = [...subjectMap.values()].map((s) => ({
      subject: s.subject,
      lowCount: s.lowCount,
      zeroCount: s.zeroCount,
      totalCount: s.totalCount,
      percentage: s.totalCount > 0 ? Math.round((s.lowCount / s.totalCount) * 10000) / 100 : 0,
      avgLowScore: s.scores.length > 0 ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100 : 0,
    })).sort((a, b) => b.lowCount - a.lowCount);

    // Class-level analysis
    const classMap = new Map<string, {
      className: string;
      shift: string;
      schoolName: string;
      totalStudents: number;
      affectedCount: number;
    }>();

    for (const [, entry] of studentMap) {
      const key = `${entry.className} - ${entry.shift}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          className: entry.className,
          shift: entry.shift,
          schoolName: entry.schoolName,
          totalStudents: 0,
          affectedCount: 0,
        });
      }
      classMap.get(key)!.affectedCount++;
    }

    // Total students per class
    const allClasses = await db.schoolClass.findMany({
      where: await buildClassWhereForUser(currentUser, { schoolId, classId, grade }),
      include: {
        students: { where: studentWhere, select: { id: true } },
        school: { select: { name: true } },
      },
    });

    for (const cls of allClasses) {
      const key = `${cls.grade} - ${cls.shift}`;
      if (classMap.has(key)) {
        classMap.get(key)!.totalStudents = cls.students.length;
        classMap.get(key)!.schoolName = cls.school.name;
      }
    }

    const classAnalysis = [...classMap.values()].sort((a, b) => b.affectedCount - a.affectedCount);

    // Score distribution for chart (ranges: 0, 1-5, 5.1-10, 10.1-14.9)
    const scoreDistribution = [
      { range: 'Zero (0)', count: 0, color: '#6b7280' },
      { range: '0.1 - 5', count: 0, color: '#dc2626' },
      { range: '5.1 - 10', count: 0, color: '#f97316' },
      { range: '10.1 - 14.9', count: 0, color: '#eab308' },
    ];

    for (const g of lowGrades) {
      if (g.score === 0) scoreDistribution[0].count++;
      else if (g.score <= 5) scoreDistribution[1].count++;
      else if (g.score <= 10) scoreDistribution[2].count++;
      else scoreDistribution[3].count++;
    }

    // Fallback inteligente para schoolLogo caso nao tenha sido selecionada uma escola especifica
    if (!schoolLogo) {
      const schoolIds = [...new Set(lowGrades.map((g) => g.student.schoolId).filter(Boolean))];
      if (schoolIds.length === 1) {
        const school = await db.school.findUnique({
          where: { id: schoolIds[0] as string },
          select: { logoUrl: true },
        });
        if (school) {
          schoolLogo = school.logoUrl;
        }
      } else {
        const userSchools = await db.school.findMany({
          where: buildSchoolWhereForUser(currentUser),
          select: { logoUrl: true },
          take: 2,
        });
        if (userSchools.length === 1) {
          schoolLogo = userSchools[0].logoUrl;
        }
      }
    }

    return NextResponse.json({
      threshold,
      totalLowGrades: lowGrades.length,
      zeroGradeCount,
      totalStudentsCount,
      affectedStudents: studentsWithLowGrades.length,
      affectedPercentage: totalStudentsCount > 0
        ? Math.round((studentsWithLowGrades.length / totalStudentsCount) * 10000) / 100
        : 0,
      students: studentsWithLowGrades,
      subjectAnalysis,
      classAnalysis,
      scoreDistribution,
      schoolLogo,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar notas baixas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
