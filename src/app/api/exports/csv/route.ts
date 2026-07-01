import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildStudentWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

function escapeSpreadsheetCell(cell: unknown) {
  const str = String(cell);
  return /^[=+\-@]/.test(str) ? `'${str}` : str;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');
    const grade = searchParams.get('grade');
    const result = searchParams.get('result');

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId, grade });
    if (result) studentWhere.finalResult = result;
    if (shift) {
      studentWhere.schoolClass = {
        ...(studentWhere.schoolClass as object),
        shift,
      };
    }

    const students = await db.student.findMany({
      where: studentWhere,
      include: {
        school: {
          select: { name: true },
        },
        schoolClass: {
          select: { grade: true, name: true, shift: true },
        },
        grades: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const subjects = await db.subject.findMany({ orderBy: { name: 'asc' } });

    // Build CSV
    const subjectNames = subjects.map((s) => s.name);
    const headers = [
      'Nome',
      'Data de Nascimento',
      'Gênero',
      'Escola',
      'Turma',
      'Turno',
      'Resultado Final',
      'Média Geral',
      'Total de Notas',
      'Notas Zeradas',
      ...subjectNames,
    ];

    const rows = students.map((student) => {
      const gradesMap: Record<string, number> = {};
      student.grades.forEach((g) => {
        gradesMap[g.subject.name] = g.score;
      });

      const avg =
        student.grades.length > 0
          ? student.grades.reduce((a, b) => a + b.score, 0) / student.grades.length
          : 0;

      return [
        student.name,
        student.birthDate || '',
        student.gender || '',
        student.school?.name || '',
        student.schoolClass ? `${student.schoolClass.grade}` : '',
        student.schoolClass?.shift || '',
        student.finalResult,
        Math.round(avg * 100) / 100,
        student.grades.length,
        student.grades.filter((g) => g.score === 0).length,
        ...subjectNames.map((s) => gradesMap[s] !== undefined ? gradesMap[s] : ''),
      ];
    });

    const csvLines = [
      headers.join(';'),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = escapeSpreadsheetCell(cell);
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(';')
      ),
    ];

    const csvContent = csvLines.join('\n');
    const BOM = '\uFEFF';

    return new NextResponse(BOM + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="alunos_export.csv"',
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao exportar CSV:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
