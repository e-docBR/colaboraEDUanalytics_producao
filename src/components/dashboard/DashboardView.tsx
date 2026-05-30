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
  FileCheck,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertCircle,
  School,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface SummaryData {
  totalFiles: number;
  totalStudents: number;
  totalClasses: number;
  approvedCount: number;
  failedCount: number;
  emcCount: number;
  approvalRate: number;
  failureRate: number;
  emcRate: number;
  overallAverage: number;
  averageBySubject: Array<{
    subject: string;
    average: number;
    count: number;
    zeroCount: number;
  }>;
  averageByClass: Array<{
    classId: string;
    grade: string;
    name: string;
    shift: string;
    average: number;
    studentCount: number;
  } | null>;
  averageByShift: Array<{
    shift: string;
    average: number;
    studentCount: number;
  }>;
  totalZeros: number;
  criticalSubjects: Array<{
    subject: string;
    average: number;
    count: number;
    zeroCount: number;
  }>;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];

function truncateName(name: string, maxLen: number) {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3) + '...';
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  loading: boolean;
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
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { selectedSchoolId, selectedClassId, selectedShift, selectedResult, refreshTrigger } =
    useAppStore();
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);
    if (selectedResult) params.set('result', selectedResult);

    fetch(`/api/dashboard/summary?${params}`)
      .then((r) => r.json())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedSchoolId, selectedClassId, selectedShift, selectedResult, refreshTrigger]);

  const loading = data === null;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Nenhum dado disponível
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Faça upload de atas de resultado para ver as estatísticas
          </p>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Aprovados', value: data.approvedCount, color: '#10b981' },
    { name: 'EMC', value: data.emcCount, color: '#3b82f6' },
    { name: 'Reprovados', value: data.failedCount, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const subjectChartData = data.averageBySubject.map((s) => ({
    name: truncateName(s.subject, 18),
    fullName: s.subject,
    média: s.average,
    notasZeradas: s.zeroCount,
  }));

  const classChartData = data.averageByClass
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      name: `${c.grade} ${c.name}`,
      fullName: `${c.grade} ${c.name} - ${c.shift}`,
      média: c.average,
      alunos: c.studentCount,
    }));

  const shiftChartData = data.averageByShift.map((s) => ({
    name: s.shift,
    média: s.average,
    alunos: s.studentCount,
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total de Turmas"
          value={data.totalClasses}
          subtitle="turmas registradas"
          icon={School}
          color="bg-blue-100 text-blue-600"
          loading={loading}
        />
        <KpiCard
          title="Total de Alunos"
          value={data.totalStudents}
          subtitle={`${data.totalZeros} notas zeradas`}
          icon={Users}
          color="bg-cyan-100 text-cyan-600"
          loading={loading}
        />
        <KpiCard
          title="Taxa de Aprovação"
          value={`${data.approvalRate}%`}
          subtitle={`${data.approvedCount} alunos aprovados`}
          icon={TrendingUp}
          color="bg-green-100 text-green-600"
          loading={loading}
        />
        <KpiCard
          title="Em Curso (EMC)"
          value={`${data.emcRate}%`}
          subtitle={`${data.emcCount} alunos em curso`}
          icon={Users}
          color="bg-blue-100 text-blue-600"
          loading={loading}
        />
        <KpiCard
          title="Média Geral"
          value={data.overallAverage}
          subtitle="de todas as disciplinas"
          icon={BarChart3}
          color="bg-amber-100 text-amber-600"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart by subject */}
        <Card className="lg:col-span-2 gap-0">
          <CardHeader>
            <CardTitle className="text-base">Média por Disciplina</CardTitle>
            <CardDescription>Desempenho médio dos alunos em cada disciplina</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    height={80}
                  />
                  <YAxis
                    domain={[0, 100]}
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'média') return [value.toFixed(1), 'Média'];
                      return [value, 'Notas Zeradas'];
                    }}
                    labelFormatter={(label: string, payload: Array<{ payload?: { fullName?: string } }>) => {
                      return payload?.[0]?.payload?.fullName || label;
                    }}
                  />
                  <Bar dataKey="média" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Sem dados de disciplinas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Resultados</CardTitle>
            <CardDescription>Aprovados, Em Curso (EMC) e Reprovados</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string, entry: { color?: string }) => (
                      <span style={{ color: entry.color, fontSize: 12 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second row of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Average by class */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Média por Turma</CardTitle>
            <CardDescription>Desempenho médio por turma e turno</CardDescription>
          </CardHeader>
          <CardContent>
            {classChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={classChartData} margin={{ top: 5, right: 20, left: 0, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickMargin={10}
                    interval={0}
                    height={80}
                  />
                  <YAxis
                    domain={[0, 100]}
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'média') return [value.toFixed(1), 'Média'];
                      return [value, 'Alunos'];
                    }}
                    labelFormatter={(label: string, payload: Array<{ payload?: { fullName?: string } }>) => {
                      return payload?.[0]?.payload?.fullName || label;
                    }}
                  />
                  <Bar dataKey="média" radius={[4, 4, 0, 0]}>
                    {classChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Sem dados de turmas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average by shift */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Média por Turno</CardTitle>
            <CardDescription>Desempenho médio por período</CardDescription>
          </CardHeader>
          <CardContent>
            {shiftChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={shiftChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [value.toFixed(1), 'Média']}
                  />
                  <Bar dataKey="média" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Sem dados de turnos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Critical subjects */}
      {data.criticalSubjects.length > 0 && (
        <Card className="gap-0 border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-base text-red-700">
                Disciplinas Críticas
              </CardTitle>
            </div>
            <CardDescription>
              Disciplinas com média abaixo de 40 pontos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.criticalSubjects.map((subject, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <div>
                    <p className="font-medium text-sm">{subject.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {subject.count} notas · {subject.zeroCount} zeradas
                    </p>
                  </div>
                  <Badge variant="destructive">
                    Média: {subject.average}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {data.totalStudents === 0 && (
        <Card className="gap-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhum dado processado
            </h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              Acesse a seção de Uploads para enviar arquivos PDF de atas de resultado
              escolar e começar a visualizar as estatísticas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
