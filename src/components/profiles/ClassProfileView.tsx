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
  School,
  Users,
  GraduationCap,
  Trophy,
  TrendingUp,
  TrendingDown,
  BookOpen,
  BarChart3,
  Target,
  Star,
  Clock,
  MapPin,
  Calendar,
  Award,
  UserCircle,
  ExternalLink,
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
import { formatGender } from '@/lib/gender';

// ── Types ──────────────────────────────────────────────────────────────────

interface ClassInfo {
  id: string;
  grade: string;
  name: string;
  shift: string;
  year: number;
  minimumAverage: number;
}

interface SchoolInfo {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface SubjectAverage {
  subjectId: string;
  subject: string;
  average: number;
  count: number;
  zeroCount: number;
}

interface StudentDetail {
  id: string;
  name: string;
  birthDate: string | null;
  gender: string | null;
  finalResult: string;
  average: number;
  totalGrades: number;
  zeroCount: number;
  grades: Record<string, number>;
}

interface ClassData {
  class: ClassInfo;
  school: SchoolInfo;
  statistics: {
    totalStudents: number;
    approvedCount: number;
    failedCount: number;
    approvalRate: number;
    failureRate: number;
    overallAverage: number;
    totalGrades: number;
    zeroCount: number;
  };
  subjectAverages: SubjectAverage[];
  students: StudentDetail[];
}

interface ClassOption {
  id: string;
  label: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

function scoreColor(score: number): string {
  if (score === 0) return 'bg-gray-400';
  if (score < 10) return 'bg-red-500';
  if (score < 15) return 'bg-orange-500';
  if (score < 20) return 'bg-yellow-500';
  return 'bg-blue-500';
}

function scoreTextColor(score: number): string {
  if (score === 0) return 'text-gray-500';
  if (score < 10) return 'text-red-600';
  if (score < 15) return 'text-orange-600';
  if (score < 20) return 'text-yellow-600';
  return 'text-blue-600';
}

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

export function ClassProfileView() {
  const { selectedSchoolId, selectedClassId, refreshTrigger, openStudentProfile, setActiveView } = useAppStore();
  const [data, setData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [currentClassId, setCurrentClassId] = useState<string>(selectedClassId || '');

  // Fetch class list
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);

    fetch(`/api/classes?${params}`)
      .then((res) => res.json())
      .then((result) => {
        const classes: ClassOption[] = (result.classes || []).map(
          (c: { id: string; grade: string; name: string; shift: string; school?: { name: string } }) => ({
            id: c.id,
            label: `${c.grade} - ${c.shift}${c.school ? ` (${c.school.name})` : ''}`,
          })
        );
        setClassList(classes);
        if (!currentClassId && classes.length > 0) {
          setCurrentClassId(classes[0].id);
        }
      })
      .catch(() => setClassList([]));
  }, [selectedSchoolId, refreshTrigger]);

  // Fetch class data
  const fetchClass = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/class/${classId}`);
      if (!res.ok) throw new Error('Erro ao carregar dados da turma');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentClassId) {
      fetchClass(currentClassId);
    }
  }, [currentClassId, fetchClass]);

  // ── No class selected ────────────────────────────────────────────────
  if (!currentClassId || classList.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Perfil da Turma</h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma escola e turma para ver o perfil detalhado
            </p>
          </div>
        </div>
        <Card className="gap-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <School className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Nenhuma turma selecionada</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              {selectedSchoolId
                ? 'Nenhuma turma encontrada para esta escola.'
                : 'Selecione uma escola nos filtros acima para começar.'}
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
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <School className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
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
          <School className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Erro ao carregar perfil</h3>
          <p className="text-sm text-muted-foreground mt-1">{error || 'Nenhum dado disponível.'}</p>
        </div>
      </div>
    );
  }

  const { class: classInfo, school, statistics, subjectAverages, students } = data;
  const maxScore = 30;

  // Radar data
  const radarData = subjectAverages.map((s) => ({
    subject: s.subject.length > 10 ? s.subject.slice(0, 9) + '...' : s.subject,
    fullSubject: s.subject,
    nota: Math.round((s.average / maxScore) * 100),
    media: s.average,
  }));

  // Distribution data for pie
  const distribution = [
    { name: 'Aprovado', value: statistics.approvedCount, color: '#10b981' },
    { name: 'EMC', value: students.filter(s => s.finalResult === 'EMC').length, color: '#3b82f6' },
    { name: 'Reprovado', value: statistics.failedCount, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Top 5 students
  const topStudents = [...students].sort((a, b) => b.average - a.average).slice(0, 5);
  const bottomStudents = [...students].sort((a, b) => a.average - b.average).slice(0, 5);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Perfil da Turma</h2>
            <p className="text-sm text-muted-foreground">
              Análise detalhada do desempenho da turma
            </p>
          </div>
        </div>

        {/* Class Selector */}
        <Select value={currentClassId} onValueChange={setCurrentClassId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Selecione uma turma" />
          </SelectTrigger>
          <SelectContent>
            {classList.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Class Info Card */}
      <Card className="gap-0 border-blue-100">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {classInfo.grade} - {classInfo.shift}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {school.name}{school.city ? `, ${school.city}` : ''}{school.state ? ` - ${school.state}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Ano {classInfo.year}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    Mínimo: {classInfo.minimumAverage}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setActiveView('school-profile')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver Escola
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Total Alunos</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><Users className="w-3.5 h-3.5" /></div>
              <span className="text-xl font-bold">{statistics.totalStudents}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Aprovados</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><Award className="w-3.5 h-3.5" /></div>
              <div>
                <span className="text-xl font-bold">{statistics.approvedCount}</span>
                <p className="text-[10px] text-muted-foreground">{statistics.approvalRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">EMC</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><Clock className="w-3.5 h-3.5" /></div>
              <div>
                <span className="text-xl font-bold">{students.filter(s => s.finalResult === 'EMC').length}</span>
                <p className="text-[10px] text-muted-foreground">Em curso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Média Geral</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600"><BarChart3 className="w-3.5 h-3.5" /></div>
              <div>
                <span className="text-xl font-bold">{statistics.overallAverage.toFixed(1)}</span>
                <p className="text-[10px] text-muted-foreground">de {maxScore}</p>
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
              <div>
                <span className="text-xl font-bold">{statistics.zeroCount}</span>
                <p className="text-[10px] text-muted-foreground">de {statistics.totalGrades}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider">Disciplinas</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600"><BookOpen className="w-3.5 h-3.5" /></div>
              <span className="text-xl font-bold">{subjectAverages.length}</span>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar - Subject Averages */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Média por Disciplina
            </CardTitle>
            <CardDescription>Mapa radar (escala 0-100)</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar name="Média" dataKey="nota" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
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

        {/* Bar Chart - Subject Averages */}
        <Card className="lg:col-span-2 gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Desempenho por Disciplina
            </CardTitle>
            <CardDescription>Média da turma por disciplina (ordenado crescente)</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectAverages.map(s => ({
                  name: s.subject.length > 16 ? s.subject.slice(0, 14) + '...' : s.subject,
                  full: s.subject,
                  média: s.average,
                  zeros: s.zeroCount,
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
                    {subjectAverages.map((s, i) => (
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
      </div>

      {/* Distribution + Top/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Pie */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Distribuição de Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={distribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) => [`${value} alunos`, name]}
                  />
                  <Legend verticalAlign="bottom" height={40} formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Top 5 - Melhores Médias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topStudents.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
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
                  </button>
                  <Badge variant="outline" className={resultBadgeClass(s.finalResult)}>
                    {s.finalResult}
                  </Badge>
                  <span className={`text-sm font-bold ${s.average >= 15 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.average.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom 5 */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Atenção - Menores Médias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottomStudents.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => openStudentProfile(s.id)}
                  >
                    <p className="text-sm font-medium truncate hover:text-blue-600 transition-colors">{s.name}</p>
                  </button>
                  <Badge variant="outline" className={resultBadgeClass(s.finalResult)}>
                    {s.finalResult}
                  </Badge>
                  <span className={`text-sm font-bold ${s.average >= 15 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.average.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Student List */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Lista Completa de Alunos
          </CardTitle>
          <CardDescription>
            {students.length} alunos ordenados por nome · Clique no nome para ver o perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">#</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Aluno</th>
                  <th className="hidden sm:table-cell text-left py-2 px-2 font-medium text-muted-foreground text-xs">Sexo</th>
                  <th className="hidden md:table-cell text-left py-2 px-2 font-medium text-muted-foreground text-xs">Nascimento</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Média</th>
                  <th className="hidden lg:table-cell text-center py-2 px-2 font-medium text-muted-foreground text-xs">Zeros</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-2 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-2 px-2">
                      <button
                        className="font-medium text-sm hover:text-blue-600 hover:underline transition-colors text-left"
                        onClick={() => openStudentProfile(s.id)}
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="hidden sm:table-cell py-2 px-2 text-xs">{formatGender(s.gender) || '-'}</td>
                    <td className="hidden md:table-cell py-2 px-2 text-xs text-muted-foreground">
                      {s.birthDate ? new Date(s.birthDate).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`text-sm font-bold ${s.average >= 15 ? 'text-blue-600' : s.average >= 10 ? 'text-orange-600' : 'text-red-600'}`}>
                        {s.average.toFixed(1)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell text-center py-2 px-2">
                      {s.zeroCount > 0 && (
                        <Badge variant="outline" className="text-gray-600 bg-gray-50 text-xs">{s.zeroCount}</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      <Badge variant="outline" className={`text-xs ${resultBadgeClass(s.finalResult)}`}>
                        {s.finalResult}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
