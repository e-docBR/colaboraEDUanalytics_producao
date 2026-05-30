import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ADMIN_ROLES, isAdmin, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDINATOR', 'ADVISOR', 'MANAGER', 'TEACHER', 'VIEWER'];

function schoolLinkRole(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DIRECAO'
    ? 'SCHOOL_ADMIN'
    : 'MEMBER';
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const users = await db.user.findMany({
      include: {
        schools: {
          include: { school: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        phone: u.phone,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        schools: u.schools.map((us) => ({
          schoolId: us.school.id,
          schoolName: us.school.name,
          role: us.role,
        })),
      })),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const { name, email, password, role, phone, schoolIds } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });
    }

    if (role === 'SUPER_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Apenas Super Admin pode criar Super Admin' }, { status: 403 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Check email uniqueness
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'VIEWER',
        phone: phone || null,
      },
    });

    // Link schools if provided
    if (schoolIds && schoolIds.length > 0) {
      for (const schoolId of schoolIds) {
        await db.userSchool.create({
          data: {
            userId: user.id,
            schoolId,
            role: schoolLinkRole(role),
          },
        });
      }
    }

    // Fetch with relations
    const created = await db.user.findUnique({
      where: { id: user.id },
      include: {
        schools: { include: { school: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({
      user: {
        id: created!.id,
        name: created!.name,
        email: created!.email,
        role: created!.role,
        phone: created!.phone,
        isActive: created!.isActive,
        schools: created!.schools.map((us) => ({
          schoolId: us.school.id,
          schoolName: us.school.name,
          role: us.role,
        })),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
