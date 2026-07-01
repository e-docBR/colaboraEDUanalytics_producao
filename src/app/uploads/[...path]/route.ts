import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getProjectRoot } from '@/lib/paths';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const prefix = '/uploads';

    if (!pathname.startsWith(prefix)) {
      return new NextResponse('Invalid Path', { status: 400 });
    }

    const relativePath = pathname.slice(prefix.length);
    let filePath = path.join(getProjectRoot(), 'uploads', relativePath);
    let resolvedPath = path.resolve(filePath);
    let uploadsBase = path.resolve(path.join(getProjectRoot(), 'uploads'));
    let hasAccess = resolvedPath.startsWith(uploadsBase);
    let fileBuffer: Buffer | null = null;

    if (hasAccess) {
      try {
        fileBuffer = await readFile(resolvedPath);
      } catch {
        hasAccess = false;
      }
    }

    if (!hasAccess || !fileBuffer) {
      filePath = path.join(getProjectRoot(), 'public', 'uploads', relativePath);
      resolvedPath = path.resolve(filePath);
      uploadsBase = path.resolve(path.join(getProjectRoot(), 'public', 'uploads'));
      hasAccess = resolvedPath.startsWith(uploadsBase);
      if (hasAccess) {
        try {
          fileBuffer = await readFile(resolvedPath);
        } catch {
          hasAccess = false;
        }
      }
    }

    if (!hasAccess || !fileBuffer) {
      return new NextResponse('File Not Found', { status: 404 });
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new NextResponse('File Not Found', { status: 404 });
  }
}
