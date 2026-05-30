import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;
export const DATA_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDINATOR', 'MANAGER'] as const;

type SchoolLink = {
  schoolId: string;
  role: string;
  school: {
    id: string;
    name: string;
  };
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  schools: SchoolLink[];
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      schools: {
        include: { school: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    schools: user.schools,
  };
}

export async function requireUser(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError(401, 'Não autorizado');
  return user;
}

export function isAdmin(user: CurrentUser) {
  return ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number]);
}

export function requireRoles(user: CurrentUser, roles: readonly string[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'Acesso negado');
  }
}

export function getUserSchoolIds(user: CurrentUser) {
  return user.schools.map((school) => school.schoolId);
}

export function ensureSchoolAccess(user: CurrentUser, schoolId: string) {
  if (isAdmin(user)) return;
  if (!getUserSchoolIds(user).includes(schoolId)) {
    throw new ApiError(403, 'Acesso negado para esta escola');
  }
}

export async function ensureClassAccess(user: CurrentUser, classId: string) {
  const schoolClass = await db.schoolClass.findUnique({
    where: { id: classId },
    select: { schoolId: true },
  });

  if (!schoolClass) throw new ApiError(404, 'Turma não encontrada');
  ensureSchoolAccess(user, schoolClass.schoolId);
  return schoolClass;
}

export async function buildStudentWhereForUser(
  user: CurrentUser,
  filters: { schoolId?: string | null; classId?: string | null } = {}
): Promise<Prisma.StudentWhereInput> {
  const where: Prisma.StudentWhereInput = {};

  if (filters.classId) {
    const schoolClass = await ensureClassAccess(user, filters.classId);
    if (filters.schoolId && filters.schoolId !== schoolClass.schoolId) {
      throw new ApiError(400, 'Turma não pertence à escola informada');
    }
    where.classId = filters.classId;
    return where;
  }

  if (filters.schoolId) {
    ensureSchoolAccess(user, filters.schoolId);
    where.schoolId = filters.schoolId;
    return where;
  }

  if (!isAdmin(user)) {
    const schoolIds = getUserSchoolIds(user);
    where.schoolId = schoolIds.length > 0 ? { in: schoolIds } : '__no_school_access__';
  }

  return where;
}

export async function buildClassWhereForUser(
  user: CurrentUser,
  filters: { schoolId?: string | null; classId?: string | null } = {}
): Promise<Prisma.SchoolClassWhereInput> {
  const where: Prisma.SchoolClassWhereInput = {};

  if (filters.classId) {
    const schoolClass = await ensureClassAccess(user, filters.classId);
    if (filters.schoolId && filters.schoolId !== schoolClass.schoolId) {
      throw new ApiError(400, 'Turma não pertence à escola informada');
    }
    where.id = filters.classId;
    return where;
  }

  if (filters.schoolId) {
    ensureSchoolAccess(user, filters.schoolId);
    where.schoolId = filters.schoolId;
    return where;
  }

  if (!isAdmin(user)) {
    const schoolIds = getUserSchoolIds(user);
    where.schoolId = schoolIds.length > 0 ? { in: schoolIds } : '__no_school_access__';
  }

  return where;
}

export function buildSchoolWhereForUser(user: CurrentUser): Prisma.SchoolWhereInput {
  if (isAdmin(user)) return {};
  const schoolIds = getUserSchoolIds(user);
  return { id: schoolIds.length > 0 ? { in: schoolIds } : '__no_school_access__' };
}

export async function ensureStudentAccess(user: CurrentUser, studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });

  if (!student) throw new ApiError(404, 'Aluno não encontrado');
  if (student.schoolId) ensureSchoolAccess(user, student.schoolId);
  else if (!isAdmin(user)) throw new ApiError(403, 'Acesso negado para este aluno');
}
