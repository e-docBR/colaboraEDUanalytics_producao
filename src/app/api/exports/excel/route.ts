import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { strToU8, zipSync } from 'fflate';
import { buildStudentWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

function escapeSpreadsheetCell(cell: string | number) {
  if (typeof cell !== 'string') return cell;
  return /^[=+\-@]/.test(cell) ? `'${cell}` : cell;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function worksheetXml(rows: Array<Array<string | number>>, widths: number[]) {
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, colIndex) => {
          const ref = `${columnName(colIndex)}${rowNumber}`;
          if (typeof cell === 'number') {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createWorkbook(sheets: Array<{ name: string; rows: Array<Array<string | number>>; widths: number[] }>) {
  const workbookSheets = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');

  const workbookRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows, sheet.widths));
  });

  return zipSync(files);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const shift = searchParams.get('shift');
    const result = searchParams.get('result');

    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId });
    if (result) studentWhere.finalResult = result;
    if (shift) {
      studentWhere.schoolClass = { shift };
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
    const subjectNames = subjects.map((s) => s.name);

    // Build worksheet data
    const wsData: Array<Array<string | number>> = [
      [
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
      ],
    ];

    students.forEach((student) => {
      const gradesMap: Record<string, number> = {};
      student.grades.forEach((g) => {
        gradesMap[g.subject.name] = g.score;
      });

      const avg =
        student.grades.length > 0
          ? student.grades.reduce((a, b) => a + b.score, 0) / student.grades.length
          : 0;

      wsData.push([
        escapeSpreadsheetCell(student.name),
        student.birthDate || '',
        student.gender || '',
        escapeSpreadsheetCell(student.school?.name || ''),
        escapeSpreadsheetCell(student.schoolClass ? `${student.schoolClass.grade} ${student.schoolClass.name}` : ''),
        student.schoolClass?.shift || '',
        student.finalResult,
        Math.round(avg * 100) / 100,
        student.grades.length,
        student.grades.filter((g) => g.score === 0).length,
        ...subjectNames.map((s) => gradesMap[s] !== undefined ? gradesMap[s] : ''),
      ]);
    });

    // Add summary sheet
    const totalStudents = students.length;
    const approved = students.filter((s) =>
      ['APROVADO', 'APROVADO POR CONSELHO'].includes(s.finalResult)
    ).length;
    const failed = students.filter((s) => s.finalResult === 'REPROVADO').length;

    const summaryData: Array<Array<string | number>> = [
      ['Resumo Geral'],
      [],
      ['Total de Alunos', totalStudents],
      ['Aprovados', approved],
      ['Reprovados', failed],
      [
        'Taxa de Aprovação (%)',
        totalStudents > 0 ? Math.round((approved / totalStudents) * 10000) / 100 : 0,
      ],
      [
        'Taxa de Reprovação (%)',
        totalStudents > 0 ? Math.round((failed / totalStudents) * 10000) / 100 : 0,
      ],
      [],
      ['Média por Disciplina'],
      ['Disciplina', 'Média', 'Notas Zeradas'],
    ];

    subjects.forEach((subject) => {
      const grades = students.flatMap((s) => s.grades.filter((g) => g.subjectId === subject.id));
      const avg =
        grades.length > 0
          ? grades.reduce((a, b) => a + b.score, 0) / grades.length
          : 0;
      const zeros = grades.filter((g) => g.score === 0).length;
      summaryData.push([subject.name, Math.round(avg * 100) / 100, zeros]);
    });

    const buffer = createWorkbook([
      {
        name: 'Alunos',
        rows: wsData,
        widths: [40, 12, 10, 40, 15, 12, 22, 12, 12, 14, ...subjectNames.map(() => 20)],
      },
      {
        name: 'Resumo',
        rows: summaryData,
        widths: [30, 15, 15],
      },
    ]);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="alunos_export.xlsx"',
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao exportar Excel:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
