import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const seedToken = process.env.SEED_ADMIN_TOKEN;
    const providedToken = request.headers.get('x-seed-token');

    if (!seedToken || providedToken !== seedToken) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const email = process.env.INITIAL_ADMIN_EMAIL || 'superadmin@atas.com';
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      return NextResponse.json(
        { error: 'INITIAL_ADMIN_PASSWORD com pelo menos 12 caracteres é obrigatório' },
        { status: 500 }
      );
    }

    // Check if superadmin already exists
    const existing = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (existing) {
      return NextResponse.json({ error: 'Super Admin já existe' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const superAdmin = await db.user.create({
      data: {
        name: 'Super Administrador',
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        phone: '',
      },
    });

    // Link superadmin to ALL existing schools with SCHOOL_ADMIN role
    const schools = await db.school.findMany();
    if (schools.length > 0) {
      for (const school of schools) {
        await db.userSchool.create({
          data: {
            userId: superAdmin.id,
            schoolId: school.id,
            role: 'SCHOOL_ADMIN',
          },
        });
      }
    }

    return NextResponse.json({
      message: 'Super Admin criado com sucesso',
      user: { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role },
    });
  } catch (error) {
    console.error('Erro ao criar super admin:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
