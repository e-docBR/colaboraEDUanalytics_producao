import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ADMIN_ROLES, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDINATOR', 'ADVISOR', 'MANAGER', 'TEACHER', 'VIEWER'];

function schoolLinkRole(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DIRECAO'
    ? 'SCHOOL_ADMIN'
    : 'MEMBER';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      include: {
        schools: { include: { school: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        schools: user.schools.map((us) => ({
          schoolId: us.school.id,
          schoolName: us.school.name,
          role: us.role,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar usuário:', error);
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

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Check email uniqueness if changed
    if (data.email && data.email !== existing.email) {
      const emailTaken = await db.user.findUnique({ where: { email: data.email } });
      if (emailTaken) {
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
      }
    }

    if (data.role !== undefined && !VALID_ROLES.includes(data.role)) {
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });
    }

    if ((existing.role === 'SUPER_ADMIN' || data.role === 'SUPER_ADMIN') && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Apenas Super Admin pode gerenciar Super Admin' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
    });

    // Update school links if provided
    if (data.schoolIds !== undefined) {
      // Delete existing links
      await db.userSchool.deleteMany({ where: { userId: id } });
      // Create new links individually (createMany has issues with SQLite)
      for (const schoolId of data.schoolIds) {
        await db.userSchool.create({
          data: {
            userId: id,
            schoolId,
            role: schoolLinkRole(data.role ?? existing.role),
          },
        });
      }
    }

    // Fetch with relations
    const updated = await db.user.findUnique({
      where: { id },
      include: {
        schools: { include: { school: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({
      user: {
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        role: updated!.role,
        avatarUrl: updated!.avatarUrl,
        phone: updated!.phone,
        isActive: updated!.isActive,
        schools: updated!.schools.map((us) => ({
          schoolId: us.school.id,
          schoolName: us.school.name,
          role: us.role,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao atualizar usuário:', error);
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

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (existing.role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Apenas Super Admin pode excluir Super Admin' }, { status: 403 });
    }

    // Prevent deleting last admin/superadmin
    if (existing.role === 'SUPER_ADMIN') {
      const superAdminCount = await db.user.count({ where: { role: 'SUPER_ADMIN' } });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível excluir o último Super Administrador' }, { status: 400 });
      }
    }
    if (existing.role === 'ADMIN') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Não é possível excluir o último administrador' }, { status: 400 });
      }
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
