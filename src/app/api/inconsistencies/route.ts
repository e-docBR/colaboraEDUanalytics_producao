import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSchoolWhereForUser, jsonError, requireUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const uploadId = searchParams.get('uploadId');

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }
    if (uploadId) {
      where.uploadId = uploadId;
    }
    const schoolWhere = buildSchoolWhereForUser(currentUser);
    if ('id' in schoolWhere) {
      where.upload = { schoolId: schoolWhere.id };
    }

    const inconsistencies = await db.inconsistency.findMany({
      where,
      include: {
        upload: {
          select: { id: true, originalName: true, status: true },
        },
        student: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by type
    const grouped: Record<string, typeof inconsistencies> = {};
    for (const inc of inconsistencies) {
      if (!grouped[inc.type]) {
        grouped[inc.type] = [];
      }
      grouped[inc.type].push(inc);
    }

    return NextResponse.json({
      inconsistencies,
      grouped,
      totalByType: Object.entries(grouped).map(([type, items]) => ({
        type,
        count: items.length,
      })),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao buscar inconsistências:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
