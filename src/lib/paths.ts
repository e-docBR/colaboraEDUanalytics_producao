import path from 'path';

function pathFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith('file:')) return null;

  const filePath = databaseUrl.slice('file:'.length);
  if (!path.isAbsolute(filePath)) return null;

  return path.dirname(path.dirname(filePath));
}

export function getProjectRoot() {
  return process.env.PROJECT_ROOT || pathFromDatabaseUrl() || process.cwd();
}

export function getPdfUploadDir() {
  return path.join(getProjectRoot(), 'uploads', 'pdfs');
}

export function getPdfUploadPath(filename: string) {
  return path.join(getPdfUploadDir(), filename);
}

export function getAtaParserScriptPath() {
  return path.join(getProjectRoot(), 'scripts', 'parse_ata.py');
}
