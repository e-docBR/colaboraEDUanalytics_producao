'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  BarChart3,
  Radar as RadarIcon,
  Target,
  Scale,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface SubjectStat {
  subject: string;
  average: number;
  min: number;
  max: number;
  count: number;
  zeros: number;
  above15: number;
}

interface StudentAverage {
  studentId: string;
  name: string;
  average: number;
  finalResult: string;
}

interface StudentHighlight {
  studentId: string;
  name: string;
  average: number;
  finalResult: string;
}

interface ClassData {
  classId: string;
  className: string;
  shift: string;
  schoolName: string;
  totalStudents: number;
  totalApproved: number;
  totalFailed: number;
  totalEmc: number;
  approvalRate: number;
  emcRate: number;
  overallAverage: number;
  totalGrades: number;
  zeroCount: number;
  zeroPercentage: number;
  subjectStats: SubjectStat[];
  studentAverages: StudentAverage[];
  topStudent: StudentHighlight | null;
  bottomStudent: StudentHighlight | null;
}

interface SubjectClassEntry {
  className: string;
  average: number;
  zeros: number;
  above15: number;
}

interface SubjectComparison {
  subject: string;
  classes: SubjectClassEntry[];
  bestClass: string;
  bestAverage: number;
  worstClass: string;
  worstAverage: number;
  difference: number;
}

interface ComparisonData {
  classes: ClassData[];
  subjectComparison: SubjectComparison[];
  totalClasses: number;
  totalStudents: number;
}

interface ByClassData {
  classes: Array<{
    id: string;
    grade: string;
    name: string;
    shift: string;
    school: string;
    studentCount: number;
    average: number;
    approvedCount: number;
    failedCount: number;
    approvalRate: number;
    failureRate: number;
  }>;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const CLASS_COLORS = [
  '#10b981', // blue-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

const CLASS_BG_COLORS = [
  'bg-blue-50 border-blue-200',
  'bg-blue-50 border-blue-200',
  'bg-amber-50 border-amber-200',
  'bg-violet-50 border-violet-200',
  'bg-red-50 border-red-200',
  'bg-cyan-50 border-cyan-200',
  'bg-pink-50 border-pink-200',
  'bg-lime-50 border-lime-200',
  'bg-orange-50 border-orange-200',
  'bg-indigo-50 border-indigo-200',
];

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

function getColor(index: number): string {
  return CLASS_COLORS[index % CLASS_COLORS.length];
}

function getBgClass(index: number): string {
  return CLASS_BG_COLORS[index % CLASS_BG_COLORS.length];
}

function formatResult(result: string): string {
  if (!result) return '-';
  switch (result) {
    case 'APROVADO':
      return 'Aprovado';
    case 'APROVADO POR CONSELHO':
      return 'Aprov. Conselho';
    case 'REPROVADO':
      return 'Reprovado';
    case 'EMC':
      return 'EMC (Em Curso)';
    default:
      return result;
  }
}

function resultBadgeClass(result: string): string {
  if (!result) return '';
  switch (result) {
    case 'APROVADO':
    case 'APROVADO POR CONSELHO':
      return 'text-blue-700 bg-blue-100 border-blue-300';
    case 'REPROVADO':
      return 'text-red-700 bg-red-100 border-red-300';
    case 'EMC':
      return 'text-blue-700 bg-blue-100 border-blue-300';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
}

// ──────────────────────────────────────────────
// Loading Skeleton
// ──────────────────────────────────────────────

function ComparisonLoadingSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ──────────────────────────────────────────────
// Custom Tooltip
// ──────────────────────────────────────────────

function CustomBarTooltip({
  active,
  payload,
  label,
  classes,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  classes: ClassData[];
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function CustomRadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export function ComparisonView() {
  const { selectedSchoolId, selectedClassId, selectedShift, refreshTrigger } =
    useAppStore();

  const [data, setData] = useState<ComparisonData | null>(null);
  const [byClassData, setByClassData] = useState<ByClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      setData(null);
      setByClassData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);

    try {
      const [comparisonRes, byClassRes] = await Promise.all([
        fetch(`/api/reports/comparison?${params}`),
        fetch(`/api/dashboard/by-class?${params}`),
      ]);

      if (!comparisonRes.ok || !byClassRes.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const comparisonJson = await comparisonRes.json();
      const byClassJson = await byClassRes.json();

      setData(comparisonJson);
      setByClassData(byClassJson);
    } catch (err) {
      console.error('Erro ao buscar comparativo:', err);
      setError('Erro ao carregar dados do comparativo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId, selectedClassId, selectedShift]);

  useEffect(() => {
    let cancelled = false;

    fetchData().then(() => {
      if (!cancelled) {
        // Data loaded
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchData, refreshTrigger]);

  // ─── Derived data for charts ───

  const barChartData = data
    ? data.subjectComparison.map((sc) => {
        const entry: Record<string, string | number> = { subject: sc.subject };
        sc.classes.forEach((cls) => {
          entry[cls.className] = cls.average;
        });
        return entry;
      })
    : [];

  const radarChartData = data
    ? data.subjectComparison.map((sc) => {
        const entry: Record<string, string | number> = { subject: sc.subject };
        sc.classes.forEach((cls) => {
          entry[cls.className] = cls.average;
        });
        return entry;
      })
    : [];

  // ─── Loading state ───

  if (loading) {
    return <ComparisonLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center p-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">
          Erro ao carregar comparativo
        </p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data || data.classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center p-4">
        <Scale className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">
          Nenhum dado disponível
        </p>
        <p className="text-sm text-muted-foreground">
          Selecione uma escola para ver o comparativo entre turmas, ou faça upload de atas primeiro.
        </p>
      </div>
    );
  }

  // ─── Responsive grid cols for KPI cards ───
  const kpiGridCols =
    data.classes.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : data.classes.length <= 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : data.classes.length <= 5
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ─── Header ─── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Scale className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Comparativo entre Turmas
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.totalClasses} {data.totalClasses === 1 ? 'turma' : 'turmas'} &bull;{' '}
              {data.totalStudents} {data.totalStudents === 1 ? 'aluno' : 'alunos'} no total
            </p>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className={`grid ${kpiGridCols} gap-4`}>
        {data.classes.map((cls, idx) => (
          <Card
            key={cls.classId}
            className={`gap-0 border ${getBgClass(idx)} overflow-hidden`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold leading-tight">
                  {cls.className}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-medium shrink-0"
                >
                  {cls.shift}
                </Badge>
              </div>
              <CardDescription className="text-[11px] truncate">
                {cls.schoolName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Alunos
                    </p>
                    <p className="text-sm font-bold leading-tight">
                      {cls.totalStudents}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Aprovação
                    </p>
                    <p className="text-sm font-bold text-blue-600 leading-tight">
                      {cls.approvalRate}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Média Geral
                    </p>
                    <p className="text-sm font-bold text-amber-600 leading-tight">
                      {cls.overallAverage.toFixed(1)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Zeros
                    </p>
                    <p className="text-sm font-bold text-red-500 leading-tight">
                      {cls.zeroPercentage}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border/60" />

              {/* Top & Bottom student */}
              <div className="space-y-1.5">
                {cls.topStudent && (
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-none truncate">
                        {cls.topStudent.name}
                      </p>
                      <p className="text-xs font-semibold text-blue-600 leading-tight">
                        {cls.topStudent.average.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}
                {cls.bottomStudent && (
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-none truncate">
                        {cls.bottomStudent.name}
                      </p>
                      <p className="text-xs font-semibold text-red-500 leading-tight">
                        {cls.bottomStudent.average.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <Card className="gap-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">
                Média por Disciplina - Comparativo
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Média de notas de cada turma por disciplina
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={barChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="subject"
                  angle={-40}
                  textAnchor="end"
                  fontSize={11}
                  height={70}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  fontSize={11}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  content={<CustomBarTooltip classes={data.classes} />}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                {data.classes.map((cls, idx) => (
                  <Bar
                    key={cls.classId}
                    dataKey={cls.className}
                    fill={getColor(idx)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card className="gap-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <RadarIcon className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">
                Perfil de Desempenho
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Distribuição das médias por disciplina para cada turma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartData}>
                <PolarGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <PolarAngleAxis
                  dataKey="subject"
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <PolarRadiusAxis
                  fontSize={9}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[0, 'auto']}
                />
                {data.classes.map((cls, idx) => (
                  <Radar
                    key={cls.classId}
                    name={cls.className}
                    dataKey={cls.className}
                    stroke={getColor(idx)}
                    fill={getColor(idx)}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip content={<CustomRadarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ─── Subject Comparison Table ─── */}
      <Card className="gap-0">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold">
              Comparação Detalhada por Disciplina
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Análise comparativa entre todas as turmas por disciplina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] overflow-auto rounded-md border">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-muted/50 min-w-[180px] text-xs font-semibold align-middle"
                  >
                    Disciplina
                  </TableHead>
                  {data.classes.map((cls, idx) => (
                    <TableHead
                      key={cls.classId}
                      colSpan={3}
                      className="min-w-[210px] text-center text-xs font-semibold"
                      style={{ color: getColor(idx) }}
                    >
                      {cls.className}
                    </TableHead>
                  ))}
                  <TableHead
                    rowSpan={2}
                    className="text-center text-xs font-semibold min-w-[150px] align-middle"
                  >
                    Melhor Turma
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center text-xs font-semibold min-w-[90px] align-middle"
                  >
                    Diferença
                  </TableHead>
                </TableRow>
                {/* Sub-header row */}
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {data.classes.map((cls) => (
                    <Fragment key={cls.classId}>
                      <TableHead className="min-w-[70px] text-center text-[10px] font-medium text-muted-foreground py-1">
                        Média
                      </TableHead>
                      <TableHead className="min-w-[70px] text-center text-[10px] font-medium text-muted-foreground py-1">
                        Zeros
                      </TableHead>
                      <TableHead className="min-w-[70px] text-center text-[10px] font-medium text-muted-foreground py-1">
                        Acima de 15
                      </TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subjectComparison.map((sc) => (
                  <TableRow key={sc.subject}>
                    {/* Subject name - sticky */}
                    <TableCell className="sticky left-0 z-10 bg-background font-medium text-sm whitespace-nowrap">
                      {sc.subject}
                    </TableCell>

                    {/* Class columns: Média, Zeros, Acima de 15 */}
                    {sc.classes.map((clsEntry) => {
                      const isBest = clsEntry.className === sc.bestClass;
                      return (
                        <Fragment key={clsEntry.className}>
                          <TableCell
                            className={`text-center text-sm tabular-nums ${
                              isBest
                                ? 'font-bold text-blue-600 bg-blue-50/60'
                                : ''
                            }`}
                          >
                            {clsEntry.average.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                            {clsEntry.zeros}
                          </TableCell>
                          <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                            {clsEntry.above15}
                          </TableCell>
                        </Fragment>
                      );
                    })}

                    {/* Best class */}
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap"
                      >
                        <Award className="h-3 w-3 mr-1" />
                        {sc.bestClass}
                      </Badge>
                    </TableCell>

                    {/* Difference */}
                    <TableCell className="text-center text-sm tabular-nums">
                      <span
                        className={
                          sc.difference === 0
                            ? 'text-muted-foreground'
                            : sc.difference > 5
                              ? 'text-red-500 font-semibold'
                              : sc.difference > 2
                                ? 'text-amber-500 font-medium'
                                : 'text-blue-600'
                        }
                      >
                        {sc.difference.toFixed(1)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
