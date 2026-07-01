'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Users,
  GraduationCap,
  Trophy,
  TrendingUp,
  TrendingDown,
  BookOpen,
  BarChart3,
  Target,
  School,
  MapPin,
  Calendar,
  Award,
  FileText,
  Clock,
  UserCircle,
  ExternalLink,
  Globe,
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
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────

interface SchoolInfo {
  id: string;
  name: string;
  inep: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  cnpj: string | null;
}

interface ClassStat {
  id: string;
  grade: string;
  name: string;
  shift: string;
  year: number;
  totalStudents: number;
  average: number;
  approved: number;
  emc: number;
  failed: number;
  approvalRate: number;
  zeroCount: number;
  totalGrades: number;
}

interface SubjectStat {
  subject: string;
  average: number;
  totalGrades: number;
  zeros: number;
  above15: number;
  below15: number;
  aboveRate: number;
}

interface TopStudent {
  id: string;
  name: string;
  className: string;
  average: number;
  finalResult: string;
}

interface ShiftData {
  shift: string;
  totalStudents: number;
  average: number;
}

interface SchoolData {
  school: SchoolInfo;
  statistics: {
    totalStudents: number;
    totalClasses: number;
    totalSubjects: number;
    totalUploads: number;
    overallAverage: number;
    approvedCount: number;
    failedCount: number;
    emcCount: number;
    approvalRate: number;
    emcRate: number;
    failureRate: number;
    totalZeros: number;
    maleCount: number;
    femaleCount: number;
  };
  classStats: ClassStat[];
  subjectStats: SubjectStat[];
  topStudents: TopStudent[];
  shiftsData: ShiftData[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

function resultBadgeClass(result: string): string {
  if (result === 'APROVADO' || result === 'APROVADO POR CONSELHO') {
    return 'bg-blue-100 text-blue-700 border-blue-300';
  }
  if (result === 'EMC') {
    return 'bg-blue-100 text-blue-700 border-blue-300';
  }
  return 'bg-red-100 text-red-700 border-red-300';
}

// ── Component ──────────────────────────────────────────────────────────────

export function SchoolProfileView() {
  const { selectedSchoolId, refreshTrigger, openStudentProfile, setActiveView } = useAppStore();
  const [data, setData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolList, setSchoolList] = useState<Array<{ id: string; name: string }>>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string>(selectedSchoolId || '');

  // Fetch school list
  useEffect(() => {
    fetch('/api/schools')
      .then((res) => res.json())
      .then((result) => {
        const schools = (result.schools || []).map((s: { id: string; name: string }) => ({
          id: s.id,
          name: s.name,
        }));
        setSchoolList(schools);
        if (!currentSchoolId && schools.length > 0) {
          setCurrentSchoolId(schools[0].id);
        }
      })
      .catch(() => setSchoolList([]));
  }, [refreshTrigger]);

  // Fetch school data
  const fetchSchool = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/schools/${schoolId}`);
      if (!res.ok) throw new Error('Erro ao carregar dados da escola');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentSchoolId) {
      fetchSchool(currentSchoolId);
    }
  }, [currentSchoolId, fetchSchool]);

  // ── No school selected ──────────────────────────────────────────────
  if (!currentSchoolId || schoolList.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Perfil da Escola</h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma escola para ver o perfil detalhado
            </p>
          </div>
        </div>
        <Card className="gap-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Nenhuma escola selecionada</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              Selecione uma escola nos filtros ou abaixo para começar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Erro ao carregar perfil</h3>
          <p className="text-sm text-muted-foreground mt-1">{error || 'Nenhum dado disponível.'}</p>
        </div>
      </div>
    );
  }

  const { school, statistics, classStats, subjectStats, topStudents, shiftsData } = data;
  const maxScore = 30;

  // Radar data for subjects
  const radarData = subjectStats.slice(0, 10).map((s) => ({
    subject: s.subject.length > 10 ? s.subject.slice(0, 9) + '...' : s.subject,
    fullSubject: s.subject,
    nota: Math.round((s.average / maxScore) * 100),
    media: s.average,
  }));

  // Distribution pie
  const distribution = [
    { name: 'Aprovado', value: statistics.approvedCount, color: '#10b981' },
    { name: 'EMC', value: statistics.emcCount, color: '#3b82f6' },
    { name: 'Reprovado', value: statistics.failedCount, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  // Gender pie
  const genderData = [
    { name: 'Masculino', value: statistics.maleCount, color: '#3b82f6' },
    { name: 'Feminino', value: statistics.femaleCount, color: '#ec4899' },
    { name: 'Não informado', value: statistics.totalStudents - statistics.maleCount - statistics.femaleCount, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Perfil da Escola</h2>
            <p className="text-sm text-muted-foreground">
              Visão geral consolidada de toda a escola
            </p>
          </div>
        </div>

        {/* School Selector */}
        <Select value={currentSchoolId} onValueChange={setCurrentSchoolId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Selecione uma escola" />
          </SelectTrigger>
          <SelectContent>
            {schoolList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* School Info Card */}
      <Card className="gap-0 border-purple-100">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold">{school.name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                {school.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {school.city}{school.state ? ` - ${school.state}` : ''}
                  </span>
                )}
                {school.address && (
                  <span className="hidden sm:flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {school.address}
                  </span>
                )}
                {school.inep && (
                  <Badge variant="outline" className="text-xs">INEP: {school.inep}</Badge>
                )}
                {school.cnpj && (
                  <Badge variant="outline" className="text-xs">CNPJ: {school.cnpj}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Total Alunos</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600"><Users className="w-3.5 h-3.5" /></div>
              <span className="text-xl font-bold">{statistics.totalStudents}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{statistics.totalClasses} turmas</p>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Média Geral</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><BarChart3 className="w-3.5 h-3.5" /></div>
              <span className="text-xl font-bold">{statistics.overallAverage.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{statistics.totalSubjects} disciplinas</p>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Aprovação</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><Award className="w-3.5 h-3.5" /></div>
              <div>
                <span className="text-xl font-bold">{statistics.approvalRate}%</span>
                <p className="text-[10px] text-muted-foreground">{statistics.approvedCount} alunos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Notas Zero</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 text-red-600"><TrendingDown className="w-3.5 h-3.5" /></div>
              <span className="text-xl font-bold">{statistics.totalZeros}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{statistics.totalUploads} uploads realizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Result Distribution + Gender + Shift */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Result Distribution */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Resultado Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) => [`${value} alunos (${statistics.totalStudents > 0 ? Math.round(value / statistics.totalStudents * 100) : 0}%)`, name]}
                  />
                  <Legend verticalAlign="bottom" height={40} formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-muted-foreground" />
              Distribuição por Gênero
            </CardTitle>
          </CardHeader>
          <CardContent>
            {genderData.length > 0 ? (
              <div className="space-y-4 pt-2">
                {genderData.map((g) => (
                  <div key={g.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-muted-foreground">{g.value} ({statistics.totalStudents > 0 ? Math.round(g.value / statistics.totalStudents * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${statistics.totalStudents > 0 ? (g.value / statistics.totalStudents) * 100 : 0}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Shift data */}
        {shiftsData.length > 0 && (
          <Card className="gap-0">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Por Turno
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 pt-2">
                {shiftsData.map((s) => (
                  <div key={s.shift} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.shift}</span>
                      <span className="text-muted-foreground">{s.totalStudents} alunos · Média: {s.average.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${Math.min((s.average / maxScore) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subject Chart + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Desempenho por Disciplina
            </CardTitle>
            <CardDescription>Média da escola por disciplina</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectStats.map((s) => ({
                  name: s.subject.length > 16 ? s.subject.slice(0, 14) + '...' : s.subject,
                  full: s.subject,
                  média: s.average,
                }))} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    fontSize={10}
                    height={80}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis fontSize={10} domain={[0, maxScore]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.full || ''}
                    formatter={(value: number) => [value.toFixed(1), 'Média']}
                  />
                  <Bar dataKey="média" radius={[4, 4, 0, 0]}>
                    {subjectStats.map((s, i) => (
                      <Cell key={i} fill={s.average >= 15 ? '#10b981' : s.average >= 10 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Radar de Disciplinas
            </CardTitle>
            <CardDescription>Escala 0-100</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar name="Média" dataKey="nota" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                    formatter={(value: number, _name: string, props: { payload?: { fullSubject?: string; media?: number } }) => [
                      `${props.payload?.media?.toFixed(1) ?? 0} pts`,
                      props.payload?.fullSubject ?? '',
                    ]}
                    labelFormatter={() => ''}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Class Comparison */}
      {classStats.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <School className="w-4 h-4 text-muted-foreground" />
              Comparativo entre Turmas
            </CardTitle>
            <CardDescription>Média geral e taxa de aprovação por turma</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, classStats.length * 40 + 40)}>
              <BarChart
                data={classStats.map((c) => ({
                  name: `${c.grade} - ${c.shift}`,
                  média: c.average,
                  aprovação: c.approvalRate,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={10}
                  width={135}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'aprovação') return [`${value.toFixed(1)}%`, 'Aprovação'];
                    return [value.toFixed(1), 'Média'];
                  }}
                />
                <Bar dataKey="média" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="aprovação" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Legend verticalAlign="bottom" height={36} formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Class Details Table */}
      {classStats.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              Detalhamento por Turma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Turma</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Turno</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Alunos</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Média</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Aprovados</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">EMC</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Reprovados</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Aprovação</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Zeros</th>
                  </tr>
                </thead>
                <tbody>
                  {classStats.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{c.grade}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.shift}</td>
                      <td className="py-2 px-3 text-center">{c.totalStudents}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold ${c.average >= 15 ? 'text-blue-600' : c.average >= 10 ? 'text-orange-600' : 'text-red-600'}`}>
                          {c.average.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">{c.approved}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">{c.emc}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {c.failed > 0 && <Badge variant="outline" className="text-red-600 bg-red-50 text-xs">{c.failed}</Badge>}
                        {c.failed === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(c.approvalRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{c.approvalRate}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {c.zeroCount > 0 && <Badge variant="outline" className="text-gray-600 bg-gray-50 text-xs">{c.zeroCount}</Badge>}
                        {c.zeroCount === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Students */}
      {topStudents.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Top 10 - Melhores Médias da Escola
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topStudents.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-700' :
                    i === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => openStudentProfile(s.id)}
                  >
                    <p className="text-sm font-medium truncate hover:text-blue-600 transition-colors">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.className}</p>
                  </button>
                  <Badge variant="outline" className={`text-xs flex-shrink-0 ${resultBadgeClass(s.finalResult)}`}>
                    {s.finalResult}
                  </Badge>
                  <span className={`text-sm font-bold flex-shrink-0 ${s.average >= 15 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.average.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Details Table */}
      {subjectStats.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Análise Detalhada por Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Disciplina</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Média</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Total Notas</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Acima de 15</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Abaixo de 15</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">Zeros</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">% Acima</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectStats.map((s, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{s.subject}</td>
                      <td className="text-center py-2 px-3">
                        <span className={`font-bold ${s.average >= 15 ? 'text-blue-600' : s.average >= 10 ? 'text-orange-600' : 'text-red-600'}`}>
                          {s.average.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-center py-2 px-3">{s.totalGrades}</td>
                      <td className="text-center py-2 px-3">
                        <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">{s.above15}</Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        <Badge variant="outline" className="text-orange-600 bg-orange-50 text-xs">{s.below15}</Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        {s.zeros > 0 && <Badge variant="outline" className="text-gray-600 bg-gray-50 text-xs">{s.zeros}</Badge>}
                        {s.zeros === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-2 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.aboveRate >= 70 ? 'bg-blue-500' : s.aboveRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(s.aboveRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{s.aboveRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
