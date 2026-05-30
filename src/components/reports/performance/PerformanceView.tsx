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
  BookOpen,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Distribution {
  zero: number;
  low: number;
  medium: number;
  high: number;
  excellent: number;
}

interface ClassBreakdown {
  className: string;
  count: number;
  average: number;
  min: number;
  max: number;
  zeros: number;
}

interface StudentEntry {
  studentName: string;
  className: string;
  score: number;
}

interface SubjectData {
  subject: string;
  count: number;
  average: number;
  median: number;
  stdDeviation: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  zeros: number;
  below10: number;
  between10and20: number;
  above20: number;
  passRate: number;
  failRate: number;
  distribution: Distribution;
  classBreakdown: ClassBreakdown[];
  topStudents: StudentEntry[];
  bottomStudents: StudentEntry[];
}

interface PerformanceData {
  subjects: SubjectData[];
  subjectRanking: SubjectData[];
  criticalSubjects: SubjectData[];
  criticalThreshold: number;
  totalSubjects: number;
  totalGrades: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3) + '...';
}

function getBarColor(avg: number): string {
  if (avg < 10) return '#ef4444';
  if (avg < 15) return '#f97316';
  if (avg < 20) return '#f59e0b';
  return '#10b981';
}

function getBarColorClass(avg: number): string {
  if (avg < 10) return 'bg-red-100 text-red-700 border-red-200';
  if (avg < 15) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (avg < 20) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
}

const DISTRIBUTION_COLORS: Record<string, string> = {
  zero: '#6b7280',
  low: '#ef4444',
  medium: '#f59e0b',
  high: '#10b981',
  excellent: '#059669',
};

const DISTRIBUTION_LABELS: Record<string, string> = {
  zero: 'Zero',
  low: 'Baixa (0-10)',
  medium: 'Média (10-20)',
  high: 'Alta (20+)',
  excellent: 'Excelente',
};

const RADAR_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6',
  '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
  '#e11d48', '#0ea5e9', '#a855f7', '#d946ef', '#22d3ee',
];

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  fontSize: 13,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
  borderClass,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  colorClass: string;
  borderClass?: string;
}) {
  return (
    <Card className={`gap-0 ${borderClass || ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs font-medium uppercase tracking-wider">
            {title}
          </CardDescription>
          <div className={`p-2 rounded-lg ${colorClass}`}>
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

function StatBox({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass || ''}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>

      {/* Detail skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PerformanceView() {
  const { selectedSchoolId, selectedClassId, selectedShift, refreshTrigger } =
    useAppStore();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const loading = !loaded;

  // ── Fetch data ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);

    fetch(`/api/reports/performance?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao carregar dados');
        return r.json();
      })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId, selectedClassId, selectedShift, refreshTrigger]);

  // ── Derived data ────────────────────────────────────────────────────────

  const bestSubject =
    data && data.subjectRanking.length > 0
      ? data.subjectRanking[data.subjectRanking.length - 1]
      : null;

  const worstSubject =
    data && data.subjectRanking.length > 0
      ? data.subjectRanking[0]
      : null;

  const avgPassRate =
    data && data.subjects.length > 0
      ? (
          data.subjects.reduce((sum, s) => sum + s.passRate, 0) /
          data.subjects.length
        ).toFixed(1)
      : '0';

  // Horizontal bar chart data: sorted ascending by average so best on top
  const barChartData = data
    ? [...data.subjects]
        .sort((a, b) => a.average - b.average)
        .map((s) => ({
          name: truncateName(s.subject, 25),
          fullName: s.subject,
          média: Number(s.average.toFixed(1)),
          fill: getBarColor(s.average),
        }))
    : [];

  // Radar chart data: normalize to percentage (max score ~30 → multiply by 100/30)
  const radarData = data
    ? data.subjects.map((s) => ({
        subject: truncateName(s.subject, 14),
        fullName: s.subject,
        percentagem: Number(((s.average / 30) * 100).toFixed(1)),
      }))
    : [];

  // Selected subject detail
  const selectedSubjectData = selectedSubject
    ? data?.subjects.find((s) => s.subject === selectedSubject) ?? null
    : null;

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data || data.subjects.length === 0) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Nenhum dado disponível
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma escola e turma para ver a análise por disciplina
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ─── 1. Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
            Análise por Disciplina
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.totalSubjects} disciplinas analisadas · {data.totalGrades}{' '}
          notas registradas
        </p>
      </div>

      {/* ─── 2. KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Disciplinas"
          value={data.totalSubjects}
          subtitle={`${data.totalGrades} notas no total`}
          icon={BookOpen}
          colorClass="bg-cyan-100 text-cyan-600"
        />

        <KpiCard
          title="Disciplinas Críticas"
          value={data.criticalSubjects.length}
          subtitle={`Média abaixo de ${data.criticalThreshold}`}
          icon={AlertTriangle}
          colorClass="bg-red-100 text-red-600"
          borderClass="border-red-200"
        />

        <KpiCard
          title="Melhor Disciplina"
          value={bestSubject ? truncateName(bestSubject.subject, 18) : '-'}
          subtitle={
            bestSubject
              ? `Média: ${bestSubject.average.toFixed(1)}`
              : undefined
          }
          icon={Award}
          colorClass="bg-blue-100 text-blue-600"
          borderClass="border-blue-200"
        />

        <KpiCard
          title="Pior Disciplina"
          value={worstSubject ? truncateName(worstSubject.subject, 18) : '-'}
          subtitle={
            worstSubject
              ? `Média: ${worstSubject.average.toFixed(1)}`
              : undefined
          }
          icon={TrendingDown}
          colorClass="bg-red-100 text-red-600"
          borderClass="border-red-200"
        />

        <KpiCard
          title="Taxa Aprovação Média"
          value={`${avgPassRate}%`}
          subtitle="Média entre todas as disciplinas"
          icon={Target}
          colorClass="bg-amber-100 text-amber-600"
        />
      </div>

      {/* ─── 3. Subject Overview Horizontal Bar Chart ─────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base">
            Ranking de Disciplinas por Média
          </CardTitle>
          <CardDescription>
            Disciplinas ordenadas pela média de notas (ascendente). Cores:{' '}
            <span className="text-red-500 font-medium">vermelho &lt; 10</span>,{' '}
            <span className="text-orange-500 font-medium">laranja 10-15</span>,{' '}
            <span className="text-yellow-500 font-medium">amarelo 15-20</span>,{' '}
            <span className="text-blue-500 font-medium">azul 20+</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {barChartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(280, barChartData.length * 44)}
            >
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 60,
                  left: 10,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  type="number"
                  domain={[0, 30]}
                  fontSize={11}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  fontSize={11}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [value.toFixed(1), 'Média']}
                  labelFormatter={(
                    label: string,
                    payload: Array<{ payload?: { fullName?: string } }>
                  ) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="média" radius={[0, 4, 4, 0]} barSize={28}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Sem dados de disciplinas
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. Radar Chart ────────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base">
            Perfil de Desempenho por Disciplina
          </CardTitle>
          <CardDescription>
            Médias normalizadas para porcentagem (baseado em nota máxima de 30
            pontos)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(360, radarData.length * 26)}>
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="75%"
                data={radarData}
              >
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="subject"
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Radar
                  name="Desempenho"
                  dataKey="percentagem"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [
                    `${value.toFixed(1)}%`,
                    'Desempenho',
                  ]}
                  labelFormatter={(
                    label: string,
                    payload: Array<{ payload?: { fullName?: string } }>
                  ) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[360px] text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. Critical Subjects Alert Cards ──────────────────────────── */}
      {data.criticalSubjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-red-700">
              Disciplinas em Situação Crítica
            </h2>
            <Badge variant="destructive">{data.criticalSubjects.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.criticalSubjects.map((subject, i) => (
              <Card key={i} className="gap-0 border-red-200 bg-red-50/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-red-800">
                      {subject.subject}
                    </CardTitle>
                    <Badge variant="destructive" className="text-xs">
                      Média: {subject.average.toFixed(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Taxa de Reprovação
                      </span>
                      <span className="font-medium text-red-600">
                        {subject.failRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notas Zero</span>
                      <span className="font-medium text-red-600">
                        {subject.zeros}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Alunos Afetados
                      </span>
                      <span className="font-medium">
                        {subject.count} alunos
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. Subject Selector + Detail Panel ───────────────────────── */}
      {data.subjects.length > 0 && (
        <div className="space-y-4">
          {/* Selector pills */}
          <Card className="gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Detalhamento por Disciplina
              </CardTitle>
              <CardDescription>
                Selecione uma disciplina para ver dados detalhados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.subjects.map((s) => {
                  const isActive = selectedSubject === s.subject;
                  return (
                    <button
                      key={s.subject}
                      onClick={() =>
                        setSelectedSubject(isActive ? null : s.subject)
                      }
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                        border transition-all cursor-pointer
                        ${
                          isActive
                            ? getBarColorClass(s.average) + ' ring-2 ring-offset-1 ring-current scale-105'
                            : 'border-border bg-background text-foreground hover:bg-accent'
                        }
                      `}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getBarColor(s.average) }}
                      />
                      {truncateName(s.subject, 22)}
                      <span className="font-bold">
                        {s.average.toFixed(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detail panel */}
          {selectedSubjectData && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {/* a. Stats grid */}
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle className="text-base">
                    Estatísticas — {selectedSubjectData.subject}
                  </CardTitle>
                  <CardDescription>
                    {selectedSubjectData.count} notas registradas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <StatBox
                      label="Média"
                      value={selectedSubjectData.average.toFixed(2)}
                      colorClass={
                        selectedSubjectData.average < 10
                          ? 'text-red-600'
                          : selectedSubjectData.average < 15
                            ? 'text-orange-500'
                            : selectedSubjectData.average < 20
                              ? 'text-yellow-600'
                              : 'text-blue-600'
                      }
                    />
                    <StatBox
                      label="Mediana"
                      value={selectedSubjectData.median.toFixed(2)}
                    />
                    <StatBox
                      label="Desvio Padrão"
                      value={selectedSubjectData.stdDeviation.toFixed(2)}
                    />
                    <StatBox
                      label="Mín"
                      value={selectedSubjectData.min.toFixed(1)}
                      colorClass="text-red-500"
                    />
                    <StatBox
                      label="Máx"
                      value={selectedSubjectData.max.toFixed(1)}
                      colorClass="text-blue-600"
                    />
                    <StatBox label="Q1" value={selectedSubjectData.q1.toFixed(2)} />
                    <StatBox label="Q3" value={selectedSubjectData.q3.toFixed(2)} />
                  </div>
                </CardContent>
              </Card>

              {/* b. Distribution Pie Chart */}
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle className="text-base">
                    Distribuição de Notas — {selectedSubjectData.subject}
                  </CardTitle>
                  <CardDescription>
                    Classificação: Zero / Baixa (0-10) / Média (10-20) / Alta
                    (20+)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    <div className="w-full lg:w-1/2">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: DISTRIBUTION_LABELS.zero,
                                value:
                                  selectedSubjectData.distribution.zero,
                              },
                              {
                                name: DISTRIBUTION_LABELS.low,
                                value:
                                  selectedSubjectData.distribution.low,
                              },
                              {
                                name: DISTRIBUTION_LABELS.medium,
                                value:
                                  selectedSubjectData.distribution.medium,
                              },
                              {
                                name: DISTRIBUTION_LABELS.high,
                                value:
                                  selectedSubjectData.distribution.high +
                                  selectedSubjectData.distribution.excellent,
                              },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }: { name: string; percent: number }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={true}
                          >
                            <Cell fill="#6b7280" />
                            <Cell fill="#ef4444" />
                            <Cell fill="#f59e0b" />
                            <Cell fill="#10b981" />
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(
                              value: number,
                              name: string
                            ) => [`${value} alunos`, name]}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(
                              value: string,
                              entry: { color?: string }
                            ) => (
                              <span
                                style={{ color: entry.color, fontSize: 12 }}
                              >
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full lg:w-1/2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatBox
                        label="Zero"
                        value={selectedSubjectData.distribution.zero}
                        colorClass="text-gray-600"
                      />
                      <StatBox
                        label="Baixa (0-10)"
                        value={selectedSubjectData.distribution.low}
                        colorClass="text-red-500"
                      />
                      <StatBox
                        label="Média (10-20)"
                        value={selectedSubjectData.distribution.medium}
                        colorClass="text-amber-500"
                      />
                      <StatBox
                        label="Alta (20+)"
                        value={
                          selectedSubjectData.distribution.high +
                          selectedSubjectData.distribution.excellent
                        }
                        colorClass="text-blue-600"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* c. Class breakdown table */}
              {selectedSubjectData.classBreakdown.length > 0 && (
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Desempenho por Turma — {selectedSubjectData.subject}
                    </CardTitle>
                    <CardDescription>
                      Comparativo de médias entre as turmas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Turma</TableHead>
                            <TableHead className="text-center">Alunos</TableHead>
                            <TableHead className="text-center">Média</TableHead>
                            <TableHead className="text-center">Mín</TableHead>
                            <TableHead className="text-center">Máx</TableHead>
                            <TableHead className="text-center">Zeros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSubjectData.classBreakdown.map(
                            (cls, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-sm">
                                  {cls.className}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                  {cls.count}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={getBarColorClass(cls.average)}
                                  >
                                    {cls.average.toFixed(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center text-sm text-red-500">
                                  {cls.min.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-center text-sm text-blue-600">
                                  {cls.max.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {cls.zeros > 0 ? (
                                    <Badge variant="destructive" className="text-xs">
                                      {cls.zeros}
                                    </Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      0
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* d & e. Top and Bottom students side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 5 */}
                {selectedSubjectData.topStudents.length > 0 && (
                  <Card className="gap-0">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <CardTitle className="text-base text-blue-700">
                          5 Melhores Alunos
                        </CardTitle>
                      </div>
                      <CardDescription>
                        {selectedSubjectData.subject}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-center">#</TableHead>
                              <TableHead>Aluno</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Turma
                              </TableHead>
                              <TableHead className="text-center">Nota</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSubjectData.topStudents
                              .slice(0, 5)
                              .map((student, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-center">
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                        i === 0
                                          ? 'bg-amber-100 text-amber-700'
                                          : i === 1
                                            ? 'bg-gray-100 text-gray-600'
                                            : i === 2
                                              ? 'bg-orange-100 text-orange-700'
                                              : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {i + 1}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium text-sm">
                                    {student.studentName}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                    {student.className}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200"
                                    >
                                      {student.score.toFixed(1)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bottom 5 */}
                {selectedSubjectData.bottomStudents.length > 0 && (
                  <Card className="gap-0 border-red-100">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <CardTitle className="text-base text-red-700">
                          5 Alunos com Menor Nota
                        </CardTitle>
                      </div>
                      <CardDescription>
                        {selectedSubjectData.subject}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-center">#</TableHead>
                              <TableHead>Aluno</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Turma
                              </TableHead>
                              <TableHead className="text-center">Nota</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSubjectData.bottomStudents
                              .slice(0, 5)
                              .map((student, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-red-50 text-red-600">
                                      {i + 1}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium text-sm">
                                    {student.studentName}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                    {student.className}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant="outline"
                                      className={
                                        student.score === 0
                                          ? 'bg-gray-100 text-gray-700 border-gray-300'
                                          : 'bg-red-50 text-red-700 border-red-200'
                                      }
                                    >
                                      {student.score.toFixed(1)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
