import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildClassWhereForUser, buildStudentWhereForUser, getUserSchoolIds, isAdmin, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');
    const result = searchParams.get('result');

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId });
    if (result) {
      studentWhere.finalResult = result;
    }
    if (shift) {
      studentWhere.schoolClass = { shift };
    }

    // Total processed files
    const uploadWhere: Prisma.UploadWhereInput = { status: 'processed' };
    if (classId) {
      uploadWhere.classId = classId;
    } else if (schoolId) {
      uploadWhere.schoolId = schoolId;
    } else if (!isAdmin(currentUser)) {
      const schoolIds = getUserSchoolIds(currentUser);
      uploadWhere.schoolId = schoolIds.length > 0 ? { in: schoolIds } : '__no_school_access__';
    }

    const totalFiles = await db.upload.count({ where: uploadWhere });

    // Total students
    const totalStudents = await db.student.count({ where: studentWhere });

    // Approval, EMC and failure counts
    const approvedCount = await db.student.count({
      where: {
        ...studentWhere,
        finalResult: { in: ['APROVADO', 'APROVADO POR CONSELHO'] },
      },
    });
    const failedCount = await db.student.count({
      where: {
        ...studentWhere,
        finalResult: 'REPROVADO',
      },
    });
    const emcCount = await db.student.count({
      where: {
        ...studentWhere,
        finalResult: 'EMC',
      },
    });

    const approvalRate = totalStudents > 0 ? (approvedCount / totalStudents) * 100 : 0;
    const failureRate = totalStudents > 0 ? (failedCount / totalStudents) * 100 : 0;
    const emcRate = totalStudents > 0 ? (emcCount / totalStudents) * 100 : 0;

    // Overall average
    const overallAvg = await db.grade.aggregate({
      _avg: { score: true },
      where: {
        student: studentWhere,
      },
    });

    // Average by subject
    const avgBySubject = await db.grade.groupBy({
      by: ['subjectId'],
      _avg: { score: true },
      _count: { score: true },
      where: {
        student: studentWhere,
      },
      orderBy: { _avg: { score: 'asc' } },
    });

    const subjectsWithAvg = await Promise.all(
      avgBySubject.map(async (item) => {
        const subject = await db.subject.findUnique({
          where: { id: item.subjectId },
        });
        // Count zeros for this subject
        const zeroCount = await db.grade.count({
          where: {
            subjectId: item.subjectId,
            score: 0,
            student: studentWhere,
          },
        });
        return {
          subject: subject?.name || 'Desconhecida',
          average: Math.round((item._avg.score || 0) * 100) / 100,
          count: item._count.score,
          zeroCount,
        };
      })
    );

    // Average by class - get classes first then compute averages
    const classesWithStudents = await db.schoolClass.findMany({
      where: await buildClassWhereForUser(currentUser, { schoolId, classId }),
      include: {
        students: {
          where: studentWhere,
          select: { id: true },
        },
      },
    });

    const classesWithAvg = await Promise.all(
      classesWithStudents.map(async (cls) => {
        const avgResult = await db.grade.aggregate({
          _avg: { score: true },
          where: {
            student: { classId: cls.id, ...studentWhere },
          },
        });
        return {
          classId: cls.id,
          grade: cls.grade || '',
          name: cls.name || '',
          shift: cls.shift || '',
          average: Math.round((avgResult._avg.score || 0) * 100) / 100,
          studentCount: cls.students.length,
        };
      })
    );

    // Average by shift - group by shift from classes
    const shiftClasses = await db.schoolClass.findMany({
      where: await buildClassWhereForUser(currentUser, { schoolId, classId }),
      include: {
        students: {
          where: studentWhere,
          select: { id: true },
        },
      },
    });

    const shiftsMap: Record<string, { avg: number; count: number }> = {};

    for (const cls of shiftClasses) {
      if (cls.students.length === 0) continue;

      if (!shiftsMap[cls.shift]) {
        shiftsMap[cls.shift] = { avg: 0, count: 0 };
      }
      const avgResult = await db.grade.aggregate({
        _avg: { score: true },
        where: {
          student: { classId: cls.id },
        },
      });
      shiftsMap[cls.shift].avg += (avgResult._avg.score || 0) * cls.students.length;
      shiftsMap[cls.shift].count += cls.students.length;
    }

    const shiftsAvg = Object.entries(shiftsMap).map(([shift, data]) => ({
      shift,
      average: Math.round((data.avg / data.count) * 100) / 100,
      studentCount: data.count,
    }));

    // Zero grade count
    const totalZeros = await db.grade.count({
      where: {
        score: 0,
        student: studentWhere,
      },
    });

    // Critical subjects (avg < 40)
    const criticalSubjects = subjectsWithAvg.filter((s) => s.average < 40 && s.count > 0);

    const totalClasses = classesWithStudents.length;

    return NextResponse.json({
      totalFiles,
      totalStudents,
      totalClasses,
      approvedCount,
      failedCount,
      emcCount,
      approvalRate: Math.round(approvalRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      emcRate: Math.round(emcRate * 100) / 100,
      overallAverage: Math.round((overallAvg._avg.score || 0) * 100) / 100,
      averageBySubject: subjectsWithAvg.sort((a, b) => a.average - b.average),
      averageByClass: classesWithAvg.sort((a, b) => a.average - b.average),
      averageByShift: shiftsAvg,
      totalZeros,
      criticalSubjects,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar resumo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
