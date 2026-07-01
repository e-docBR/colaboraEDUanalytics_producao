import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DATA_WRITE_ROLES, jsonError, requireRoles, requireUser, ensureStudentAccess } from '@/lib/api-auth';

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    // Verificar se a role permite escrita (já inclui SUPER_ADMIN, ADMIN, DIRECAO, etc)
    requireRoles(currentUser, DATA_WRITE_ROLES);

    // O Frontend já filtrará por roles específicos (SUPER_ADMIN, ADMIN, DIRECAO)
    // Mas para segurança extra no backend, podemos restringir aqui se quisermos, 
    // ou apenas usar DATA_WRITE_ROLES que é padrão do sistema para escrita.
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO'];
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Acesso negado: apenas diretores e administradores podem alterar notas.' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, subjectName, score } = body;

    if (!studentId || !subjectName || typeof score !== 'number') {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Verificar se o usuário tem acesso à escola do aluno
    await ensureStudentAccess(currentUser, studentId);

    // 1. Obter a disciplina pelo nome
    const subject = await db.subject.findUnique({
      where: { name: subjectName }
    });

    if (!subject) {
      return NextResponse.json({ error: 'Disciplina não encontrada' }, { status: 404 });
    }

    // 2. Obter o Aluno com sua turma para saber a média mínima
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { schoolClass: true }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    // 3. Atualizar a nota na tabela Grade
    await db.grade.upsert({
      where: {
        studentId_subjectId: {
          studentId,
          subjectId: subject.id,
        }
      },
      update: { score },
      create: {
        studentId,
        subjectId: subject.id,
        score
      }
    });

    // 4. Recalcular a média e Resultado Final
    const allGrades = await db.grade.findMany({
      where: { studentId }
    });

    const minAverage = student.schoolClass?.minimumAverage || 50.0;
    
    let isBelowAverage = false;
    for (const grade of allGrades) {
      if (grade.score < minAverage) {
        isBelowAverage = true;
        break;
      }
    }

    let newFinalResult = student.finalResult;
    
    // Regra de negócio aprovada:
    if (!isBelowAverage) {
      // Se nenhuma nota for abaixo da média, vira APROVADO
      newFinalResult = 'APROVADO';
    } else {
      // Se houver qualquer nota abaixo da média, e estava como APROVADO, muda para EMC.
      // (Se for "APROVADO POR CONSELHO" ou "EMC", mantém)
      if (newFinalResult === 'APROVADO') {
        newFinalResult = 'EMC';
      }
    }

    // Atualiza o resultado no banco se houve mudança
    if (newFinalResult !== student.finalResult) {
      await db.student.update({
        where: { id: studentId },
        data: { finalResult: newFinalResult }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Nota atualizada com sucesso',
      data: { score, finalResult: newFinalResult } 
    });

  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao editar nota:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
