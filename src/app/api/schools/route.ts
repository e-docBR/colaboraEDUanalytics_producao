import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_ROLES, buildSchoolWhereForUser, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const schools = await db.school.findMany({
      where: buildSchoolWhereForUser(currentUser),
      include: {
        _count: {
          select: {
            classes: true,
            students: true,
            uploads: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ schools });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar escolas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const data = await request.json();

    if (!data.name) {
      return NextResponse.json({ error: 'Nome da escola é obrigatório' }, { status: 400 });
    }

    // Check INEP uniqueness
    if (data.inep) {
      const existing = await db.school.findUnique({ where: { inep: data.inep } });
      if (existing) {
        return NextResponse.json({ error: 'INEP já cadastrado' }, { status: 400 });
      }
    }

    const school = await db.school.create({
      data: {
        name: data.name,
        inep: data.inep || null,
        city: data.city || null,
        state: data.state || null,
        address: data.address || null,
        cnpj: data.cnpj || null,
        phone: data.phone || null,
        email: data.email || null,
        logoUrl: data.logoUrl || null,
        principal: data.principal || null,
      },
    });

    return NextResponse.json({ school }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao criar escola:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
