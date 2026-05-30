import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_ROLES, ensureSchoolAccess, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    const { id } = await params;
    ensureSchoolAccess(currentUser, id);

    // Fetch school
    const school = await db.school.findUnique({ where: { id } });
    if (!school) {
      return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 });
    }

    // Fetch all classes for this school
    const classes = await db.schoolClass.findMany({
      where: { schoolId: id },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: [{ grade: 'asc' }, { shift: 'asc' }],
    });

    // Fetch all students with grades for this school
    const students = await db.student.findMany({
      where: { schoolId: id, classId: { not: null } },
      include: {
        grades: { include: { subject: true } },
        schoolClass: { select: { grade: true, name: true, shift: true } },
      },
    });

    // Fetch total subjects and uploads
    const [totalSubjects, totalUploads] = await Promise.all([
      db.subject.count(),
      db.upload.count({ where: { schoolId: id } }),
    ]);

    // ── Statistics ──────────────────────────────────────────
    const totalStudents = students.length;
    let overallSum = 0;
    let totalGradesCount = 0;
    let approvedCount = 0;
    let failedCount = 0;
    let emcCount = 0;
    let totalZeros = 0;
    let maleCount = 0;
    let femaleCount = 0;

    for (const student of students) {
      const grades = student.grades;
      if (grades.length > 0) {
        const avg = grades.reduce((s, g) => s + g.score, 0) / grades.length;
        overallSum += avg;
        totalGradesCount += grades.length;
      }
      const fr = student.finalResult?.toUpperCase();
      if (fr?.includes('APROVADO')) approvedCount++;
      else if (fr === 'EMC') emcCount++;
      else if (fr?.includes('REPROVADO')) failedCount++;

      for (const g of grades) {
        if (g.score === 0) totalZeros++;
      }

      const gender = student.gender?.toUpperCase();
      if (gender === 'M' || gender === 'MASCULINO') maleCount++;
      else if (gender === 'F' || gender === 'FEMININO') femaleCount++;
    }

    const overallAverage = totalGradesCount > 0 ? overallSum / totalStudents : 0;
    const approvalRate = totalStudents > 0 ? Math.round((approvedCount / totalStudents) * 100) : 0;
    const emcRate = totalStudents > 0 ? Math.round((emcCount / totalStudents) * 100) : 0;
    const failureRate = totalStudents > 0 ? Math.round((failedCount / totalStudents) * 100) : 0;

    // ── Class Stats ─────────────────────────────────────────
    const classMap = new Map<string, typeof students[0][]>();
    for (const s of students) {
      if (s.classId) {
        const list = classMap.get(s.classId) || [];
        list.push(s);
        classMap.set(s.classId, list);
      }
    }

    const classStats = classes.map((c) => {
      const classStudents = classMap.get(c.id) || [];
      let classAvgSum = 0;
      let classGradesTotal = 0;
      let classApproved = 0;
      let classEmc = 0;
      let classFailed = 0;
      let classZeros = 0;

      for (const s of classStudents) {
        if (s.grades.length > 0) {
          classAvgSum += s.grades.reduce((sum, g) => sum + g.score, 0) / s.grades.length;
          classGradesTotal += s.grades.length;
        }
        const fr = s.finalResult?.toUpperCase();
        if (fr?.includes('APROVADO')) classApproved++;
        else if (fr === 'EMC') classEmc++;
        else if (fr?.includes('REPROVADO')) classFailed++;
        for (const g of s.grades) if (g.score === 0) classZeros++;
      }

      const avg = classStudents.length > 0 ? classAvgSum / classStudents.length : 0;
      return {
        id: c.id,
        grade: c.grade,
        name: c.name,
        shift: c.shift,
        year: c.year,
        totalStudents: classStudents.length,
        average: avg,
        approved: classApproved,
        emc: classEmc,
        failed: classFailed,
        approvalRate: classStudents.length > 0 ? Math.round((classApproved / classStudents.length) * 100) : 0,
        zeroCount: classZeros,
        totalGrades: classGradesTotal,
      };
    });

    // ── Subject Stats ───────────────────────────────────────
    const subjectMap = new Map<string, { total: number; sum: number; zeros: number; above15: number; below15: number }>();
    for (const s of students) {
      for (const g of s.grades) {
        const prev = subjectMap.get(g.subject.name) || { total: 0, sum: 0, zeros: 0, above15: 0, below15: 0 };
        prev.total++;
        prev.sum += g.score;
        if (g.score === 0) prev.zeros++;
        if (g.score >= 15) prev.above15++;
        else prev.below15++;
        subjectMap.set(g.subject.name, prev);
      }
    }

    const subjectStats = Array.from(subjectMap.entries()).map(([name, d]) => ({
      subject: name,
      average: d.total > 0 ? d.sum / d.total : 0,
      totalGrades: d.total,
      zeros: d.zeros,
      above15: d.above15,
      below15: d.below15,
      aboveRate: d.total > 0 ? Math.round((d.above15 / d.total) * 100) : 0,
    }));

    // ── Top 10 Students ────────────────────────────────────
    const topStudents = students
      .map((s) => ({
        id: s.id,
        name: s.name,
        className: s.schoolClass ? `${s.schoolClass.grade} ${s.schoolClass.name} - ${s.schoolClass.shift}` : '',
        average: s.grades.length > 0 ? s.grades.reduce((sum, g) => sum + g.score, 0) / s.grades.length : 0,
        finalResult: s.finalResult,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10);

    // ── Shift Data ──────────────────────────────────────────
    const shiftMap = new Map<string, { students: number; avgSum: number }>();
    for (const s of students) {
      const shift = s.schoolClass?.shift || 'N/A';
      const prev = shiftMap.get(shift) || { students: 0, avgSum: 0 };
      prev.students++;
      if (s.grades.length > 0) {
        prev.avgSum += s.grades.reduce((sum, g) => sum + g.score, 0) / s.grades.length;
      }
      shiftMap.set(shift, prev);
    }

    const shiftsData = Array.from(shiftMap.entries()).map(([shift, d]) => ({
      shift,
      totalStudents: d.students,
      average: d.students > 0 ? d.avgSum / d.students : 0,
    }));

    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        inep: school.inep,
        city: school.city,
        state: school.state,
        address: school.address,
        cnpj: school.cnpj,
      },
      statistics: {
        totalStudents,
        totalClasses: classes.length,
        totalSubjects,
        totalUploads,
        overallAverage,
        approvedCount,
        failedCount,
        emcCount,
        approvalRate,
        emcRate,
        failureRate,
        totalZeros,
        maleCount,
        femaleCount,
      },
      classStats,
      subjectStats,
      topStudents,
      shiftsData,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar perfil da escola:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const { id } = await params;
    const data = await request.json();

    const existing = await db.school.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 });
    }

    // Check INEP uniqueness if changed
    if (data.inep && data.inep !== existing.inep) {
      const inepTaken = await db.school.findUnique({ where: { inep: data.inep } });
      if (inepTaken) {
        return NextResponse.json({ error: 'INEP já cadastrado para outra escola' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.inep !== undefined) updateData.inep = data.inep || null;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.principal !== undefined) updateData.principal = data.principal;

    const school = await db.school.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ school });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao atualizar escola:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const { id } = await params;

    const existing = await db.school.findUnique({
      where: { id },
      include: { _count: { select: { students: true, classes: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Escola não encontrada' }, { status: 404 });
    }

    if (existing._count.students > 0 || existing._count.classes > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir escola com alunos ou turmas vinculados' },
        { status: 400 }
      );
    }

    // Delete school-user links first
    await db.userSchool.deleteMany({ where: { schoolId: id } });
    await db.school.delete({ where: { id } });

    return NextResponse.json({ message: 'Escola excluída com sucesso' });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao excluir escola:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
