import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getPdfUploadDir, getPdfUploadPath } from '@/lib/paths';
import { ADMIN_ROLES, buildSchoolWhereForUser, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

const MAX_FILES_PER_REQUEST = 10;
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

function isPdfFile(file: any, buffer: Buffer) {
  const ext = path.extname(file.name).toLowerCase();
  const signature = buffer.subarray(0, 1024).toString('utf8');
  const hasSignature = signature.includes('%PDF-');
  return ext === '.pdf' && (file.type === 'application/pdf' || hasSignature);
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const formData = await request.formData();
    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Envie no máximo ${MAX_FILES_PER_REQUEST} arquivos por vez` }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadDir = getPdfUploadDir();
    await mkdir(uploadDir, { recursive: true });

    const uploads: Array<Awaited<ReturnType<typeof db.upload.create>>> = [];

    for (const file of files) {
      if (!file || typeof file !== 'object' || !('name' in file) || typeof (file as any).arrayBuffer !== 'function') continue;
      const fileObject = file as any;

      if (fileObject.size > MAX_PDF_SIZE_BYTES) {
        return NextResponse.json({ error: `Arquivo ${fileObject.name} excede o limite de 20MB` }, { status: 400 });
      }

      const buffer = Buffer.from(await fileObject.arrayBuffer());
      if (!isPdfFile(fileObject, buffer)) {
        console.error('File validation failed:', {
          name: fileObject.name,
          type: fileObject.type,
          size: fileObject.size,
          signatureStr: buffer.subarray(0, 20).toString('utf8'),
          signatureHex: buffer.subarray(0, 10).toString('hex'),
        });
        return NextResponse.json({ error: `Arquivo ${fileObject.name} não é um PDF válido` }, { status: 400 });
      }

      const ext = path.extname(fileObject.name).toLowerCase();
      const uniqueId = randomUUID();
      const filename = `${uniqueId}${ext}`;
      const filePath = getPdfUploadPath(filename);

      await writeFile(filePath, buffer);

      const upload = await db.upload.create({
        data: {
          filename,
          originalName: fileObject.name,
          status: 'pending',
        },
      });

      uploads.push(upload);
    }

    return NextResponse.json({ uploads }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao fazer upload dos arquivos' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const schoolWhere = buildSchoolWhereForUser(currentUser);
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if ('id' in schoolWhere) {
      where.schoolId = schoolWhere.id;
    }

    const [uploads, total] = await Promise.all([
      db.upload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          school: {
            select: { id: true, name: true },
          },
          schoolClass: {
            select: { id: true, grade: true, name: true, shift: true },
          },
        },
      }),
      db.upload.count({ where }),
    ]);

    return NextResponse.json({
      uploads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao listar uploads:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
