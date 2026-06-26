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
    const filePath = path.join(getProjectRoot(), 'uploads', relativePath);
    
    // Basic protection against Path Traversal
    const resolvedPath = path.resolve(filePath);
    const uploadsBase = path.resolve(path.join(getProjectRoot(), 'uploads'));
    
    if (!resolvedPath.startsWith(uploadsBase)) {
      return new NextResponse('Access Denied', { status: 403 });
    }

    const fileBuffer = await readFile(resolvedPath);
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

    return new NextResponse(fileBuffer, {
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
