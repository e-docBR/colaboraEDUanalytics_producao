'use client';

import { useEffect, useState } from 'react';
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
  Trophy,
  Medal,
  TrendingDown,
  Award,
  Users,
  BarChart3,
  Target,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

interface RankedStudent {
  position: number;
  studentId: string;
  name: string;
  className: string;
  shift: string;
  finalResult: string;
  average: number;
  totalGrades: number;
  zeros: number;
  above15: number;
  maxGrade: number;
  minGrade: number;
  bestSubject: { name: string; score: number } | null;
  worstSubject: { name: string; score: number } | null;
  grades: Record<string, number>;
}

interface ClassBreakdownItem {
  className: string;
  students: number;
  average: number;
}

interface RankingDistribution {
  zeroTo5: number;
  fiveTo10: number;
  tenTo15: number;
  fifteenTo20: number;
  twentyTo25: number;
  above25: number;
}

interface RankingData {
  ranking: RankedStudent[];
  topStudents: RankedStudent[];
  bottomStudents: RankedStudent[];
  classBreakdown: ClassBreakdownItem[];
  distribution: RankingDistribution;
  totalStudents: number;
  overallAvg: number;
  highestAvg: number;
  lowestAvg: number;
  totalZeros: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#ef4444',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#e11d48',
  '#0ea5e9',
];

const DISTRIBUTION_COLORS = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#15803d'];

const DISTRIBUTION_LABELS: Record<string, string> = {
  zeroTo5: '0 – 5',
  fiveTo10: '5 – 10',
  tenTo15: '10 – 15',
  fifteenTo20: '15 – 20',
  twentyTo25: '20 – 25',
  above25: '25+',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function averageColor(avg: number): string {
  if (avg < 10) return 'text-red-600 font-bold';
  if (avg < 15) return 'text-orange-500 font-semibold';
  if (avg < 20) return 'text-yellow-600 font-semibold';
  return 'text-blue-600 font-bold';
}

function averageBg(avg: number): string {
  if (avg < 10) return 'bg-red-50';
  if (avg < 15) return 'bg-orange-50';
  if (avg < 20) return 'bg-yellow-50';
  return 'bg-blue-50';
}

function medalBadge(position: number) {
  if (position === 1)
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-100 text-xs px-2">
        🥇 1º
      </Badge>
    );
  if (position === 2)
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100 text-xs px-2">
        🥈 2º
      </Badge>
    );
  if (position === 3)
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-50 text-xs px-2">
        🥉 3º
      </Badge>
    );
  return <span className="text-sm text-muted-foreground">{position}º</span>;
}

function tooltipStyle() {
  return {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: 12,
  };
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs font-medium uppercase tracking-wider">
            {title}
          </CardDescription>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Podium Card ────────────────────────────────────────────────────────────

function PodiumCard({
  student,
  place,
  accentColor,
  bgColor,
  borderColor,
  iconColor,
}: {
  student: RankedStudent;
  place: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}) {
  return (
    <Card className={`gap-0 border-2 ${borderColor} ${bgColor} flex flex-col`}>
      <CardHeader className="pb-2 text-center">
        <div className="flex justify-center mb-1">
          <Award className={`w-7 h-7 ${iconColor}`} />
        </div>
        <CardTitle className="text-lg">{place}</CardTitle>
        <CardDescription className="text-xs">{student.className} · {student.shift}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-2">
        <p className="font-bold text-base text-center">{student.name}</p>
        <p className="text-2xl font-extrabold">{student.average.toFixed(2)}</p>
        {student.bestSubject && (
          <Badge variant="outline" className={`text-xs ${accentColor} border-current/30`}>
            {student.bestSubject.name}: {student.bestSubject.score}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function RankingView() {
  const { selectedSchoolId, selectedClassId, selectedShift, refreshTrigger } =
    useAppStore();

  const [data, setData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = data === null && error === null;

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);

    fetch(`/api/reports/ranking?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar ranking');
        return res.json();
      })
      .then((result: RankingData) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId, selectedClassId, selectedShift, refreshTrigger]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* KPI skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        {/* Podium skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>

        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>

        {/* Table skeleton */}
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Erro ao carregar ranking
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Nenhum dado disponível. Faça upload de atas primeiro.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Derived Data ─────────────────────────────────────────────────────────

  const distributionChartData = [
    { name: DISTRIBUTION_LABELS.zeroTo5, value: data.distribution.zeroTo5 },
    { name: DISTRIBUTION_LABELS.fiveTo10, value: data.distribution.fiveTo10 },
    { name: DISTRIBUTION_LABELS.tenTo15, value: data.distribution.tenTo15 },
    { name: DISTRIBUTION_LABELS.fifteenTo20, value: data.distribution.fifteenTo20 },
    { name: DISTRIBUTION_LABELS.twentyTo25, value: data.distribution.twentyTo25 },
    { name: DISTRIBUTION_LABELS.above25, value: data.distribution.above25 },
  ];

  const classBreakdownData = data.classBreakdown.map((c) => ({
    name: c.className.length > 20 ? c.className.slice(0, 18) + '…' : c.className,
    fullName: c.className,
    value: c.average,
    students: c.students,
  }));

  const topStudentIds = new Set(data.topStudents.map((s) => s.studentId));
  const bottomStudentIds = new Set(data.bottomStudents.map((s) => s.studentId));

  // Top 3 by average (for podium display) - alphabetical ranking uses position field
  const topByAverage = [...data.ranking].sort((a, b) => b.average - a.average);
  const podium = topByAverage.slice(0, 3);
  const first = podium[0];
  const second = podium[1];
  const third = podium[2];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Ranking Geral de Alunos
          </h2>
          <p className="text-sm text-muted-foreground">
            Todos os alunos ordenados alfabeticamente com posi&ccedil;&otilde;es por m&eacute;dia
          </p>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Alunos"
          value={data.totalStudents}
          subtitle="alunos no ranking"
          icon={Users}
          color="bg-cyan-100 text-cyan-600"
        />
        <KpiCard
          title="Média Geral"
          value={data.overallAvg.toFixed(2)}
          subtitle="média de todos os alunos"
          icon={BarChart3}
          color="bg-amber-100 text-amber-600"
        />
        <KpiCard
          title="Melhor Média"
          value={data.highestAvg.toFixed(2)}
          subtitle={first?.name}
          icon={Trophy}
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          title="Pior Média"
          value={data.lowestAvg.toFixed(2)}
          subtitle={data.bottomStudents[0]?.name}
          icon={TrendingDown}
          color="bg-red-100 text-red-600"
        />
        <KpiCard
          title="Total de Zeros"
          value={data.totalZeros}
          subtitle="notas zeradas no total"
          icon={Target}
          color="bg-orange-100 text-orange-600"
        />
      </div>

      {/* ── Podium Section ────────────────────────────────────────────────── */}
      {podium.length >= 3 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Medal className="w-4 h-4 text-yellow-500" />
            Pódio — Top 3 Alunos
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 2nd place */}
            {second && (
              <PodiumCard
                student={second}
                place="2º Lugar"
                accentColor="text-gray-600"
                bgColor="bg-gray-50/60"
                borderColor="border-gray-300"
                iconColor="text-gray-500"
              />
            )}

            {/* 1st place */}
            {first && (
              <PodiumCard
                student={first}
                place="1º Lugar"
                accentColor="text-yellow-600"
                bgColor="bg-yellow-50/60"
                borderColor="border-yellow-400"
                iconColor="text-yellow-500"
              />
            )}

            {/* 3rd place */}
            {third && (
              <PodiumCard
                student={third}
                place="3º Lugar"
                accentColor="text-amber-700"
                bgColor="bg-amber-50/60"
                borderColor="border-amber-300"
                iconColor="text-amber-600"
              />
            )}
          </div>
        </section>
      )}

      {/* ── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Bar Chart */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Distribuição de Médias
            </CardTitle>
            <CardDescription>
              Quantidade de alunos por faixa de média
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.totalStudents > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={distributionChartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value: number) => [
                      `${value} aluno${value !== 1 ? 's' : ''}`,
                      'Alunos',
                    ]}
                  />
                  <Bar dataKey="value" name="Alunos" radius={[6, 6, 0, 0]}>
                    {distributionChartData.map((_, index) => (
                      <Cell key={`dist-${index}`} fill={DISTRIBUTION_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Breakdown Pie Chart */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Média por Turma
            </CardTitle>
            <CardDescription>
              Desempenho médio de cada turma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classBreakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={classBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {classBreakdownData.map((_, index) => (
                      <Cell
                        key={`class-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value: number, _name: string, props: { payload?: { fullName?: string; students?: number } }) => [
                      `${value.toFixed(2)} (${props.payload?.students ?? 0} alunos)`,
                      props.payload?.fullName ?? 'Turma',
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={56}
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string, entry: { color?: string }) => (
                      <span style={{ color: entry.color }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Sem dados de turmas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Full Ranking Table ─────────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-muted-foreground" />
            Ranking Completo
          </CardTitle>
          <CardDescription>
            {data.totalStudents} alunos em ordem alfabética
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0 z-10">
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead className="hidden sm:table-cell">Turma</TableHead>
                  <TableHead className="text-center">Média</TableHead>
                  <TableHead className="hidden md:table-cell">Melhor Disciplina</TableHead>
                  <TableHead className="hidden md:table-cell">Pior Disciplina</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Zeros</TableHead>
                  <TableHead className="text-center">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ranking.map((student) => {
                  const isTop = topStudentIds.has(student.studentId);
                  const isBottom = bottomStudentIds.has(student.studentId);

                  let rowBg = '';
                  if (isTop) rowBg = 'bg-blue-50/60';
                  else if (isBottom) rowBg = 'bg-red-50/40';

                  return (
                    <TableRow
                      key={student.studentId}
                      className={rowBg}
                    >
                      {/* Position */}
                      <TableCell className="text-center">
                        {medalBadge(student.position)}
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <p className="font-medium text-sm">{student.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {student.className}
                        </p>
                      </TableCell>

                      {/* Class */}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {student.className}
                        </span>
                      </TableCell>

                      {/* Average */}
                      <TableCell className="text-center">
                        <span className={averageColor(student.average)}>
                          {student.average.toFixed(2)}
                        </span>
                      </TableCell>

                      {/* Best Subject */}
                      <TableCell className="hidden md:table-cell">
                        {student.bestSubject ? (
                          <div className="text-xs">
                            <span className="font-medium text-blue-700">
                              {student.bestSubject.name}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              ({student.bestSubject.score})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Worst Subject */}
                      <TableCell className="hidden md:table-cell">
                        {student.worstSubject ? (
                          <div className="text-xs">
                            <span className="font-medium text-red-600">
                              {student.worstSubject.name}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              ({student.worstSubject.score})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Zeros */}
                      <TableCell className="text-center hidden lg:table-cell">
                        {student.zeros > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-red-600 bg-red-50 border-red-200 text-xs"
                          >
                            {student.zeros}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      {/* Result */}
                      <TableCell className="text-center">
                        {student.finalResult === 'APROVADO' || student.finalResult === 'APROVADO POR CONSELHO' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100 text-xs">
                            {student.finalResult}
                          </Badge>
                        ) : student.finalResult === 'EMC' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100 text-xs">
                            EMC
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-300 hover:bg-red-100 text-xs">
                            REPROVADO
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 inline-block" />
              Top 10 — Melhores médias
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 inline-block" />
              Últimos 10 — Menores médias
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" />
              🥇🥈🥉 — Pódio (Top 3)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Empty State ────────────────────────────────────────────────────── */}
      {data.totalStudents === 0 && (
        <Card className="gap-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Trophy className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhum aluno encontrado
            </h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              Aplique filtros ou faça upload de atas de resultado para visualizar
              o ranking dos alunos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
