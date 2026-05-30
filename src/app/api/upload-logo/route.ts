import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ADMIN_ROLES, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, ADMIN_ROLES);

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 2MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads/logos directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const logoUrl = `/uploads/logos/${filename}`;

    return NextResponse.json({ logoUrl, filename });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao fazer upload do logo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
