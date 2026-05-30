import { execFileSync } from 'child_process';
import { getAtaParserScriptPath } from '@/lib/paths';

export interface AtaParseResult {
  school: {
    name: string;
    inep: string;
    city: string;
    state: string;
    address: string;
    cnpj: string;
  };
  class: {
    grade: string;
    name: string;
    shift: string;
    minimum_average: number;
  };
  students: Array<{
    name: string;
    birth_date: string | null;
    gender: string | null;
    grades: Record<string, number>;
    final_result: string;
    zero_count: number;
    total_grades: number;
  }>;
  warnings: Array<{
    type: string;
    student: string | null;
    message: string;
  }>;
  disciplines: string[];
}

export async function parseAtaPdf(pdfPath: string): Promise<AtaParseResult> {
  const scriptPath = getAtaParserScriptPath();
  const pythonBin = process.env.PYTHON_BIN || 'python3';
  const result = execFileSync(pythonBin, [scriptPath, pdfPath], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(result);
}
