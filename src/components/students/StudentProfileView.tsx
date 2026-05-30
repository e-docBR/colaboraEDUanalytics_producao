'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatGender } from '@/lib/gender';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserCircle,
  GraduationCap,
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  BookOpen,
  Users,
  BarChart3,
  Star,
  AlertCircle,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

interface StudentInfo {
  id: string;
  name: string;
  birthDate: string | null;
  gender: string | null;
  finalResult: string;
  className: string;
  schoolName: string;
}

interface GradeItem {
  subject: string;
  score: number;
}

interface Statistics {
  average: number;
  totalSubjects: number;
  above15: number;
  below15: number;
  zeros: number;
  bestSubject: { name: string; score: number };
  worstSubject: { name: string; score: number };
  classRank: number;
  classTotal: number;
  position: string;
}

interface StudentData {
  student: StudentInfo;
  grades: GradeItem[];
  statistics: Statistics;
}

interface StudentOption {
  id: string;
  name: string;
  className: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

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
    return 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100';
  }
  if (result === 'EMC') {
    return 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100';
  }
  return 'bg-red-100 text-red-700 border-red-300 hover:bg-red-100';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// ── KpiCard ─────────────────────────────────────────────────────────────

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

// ── Inner Component (uses useSearchParams) ──────────────────────────────

function StudentProfileInner() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get('studentId');

  const { selectedSchoolId, selectedClassId, selectedShift, refreshTrigger, selectedStudentId: storeStudentId, setSelectedStudentId } =
    useAppStore();

  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentList, setStudentList] = useState<StudentOption[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string>(
    selectedStudentId || storeStudentId || ''
  );
  const [classAverage, setClassAverage] = useState<number>(0);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loading = data === null && error === null && !!currentStudentId;

  // Sync with store's selectedStudentId (from modal "Ver página completa")
  useEffect(() => {
    if (storeStudentId && storeStudentId !== currentStudentId) {
      setCurrentStudentId(storeStudentId);
    }
  }, [storeStudentId, currentStudentId]);

  // Fetch student list based on filters
  useEffect(() => {
    if (!selectedClassId) {
      setStudentList([]);
      return;
    }

    setLoadingStudents(true);
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);

    fetch(`/api/reports/class/${selectedClassId}`)
      .then((res) => res.json())
      .then((result) => {
        const students: StudentOption[] = (result.students || []).map(
          (s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
            className: result.class
              ? `${result.class.grade} ${result.class.name} - ${result.class.shift}`
              : '',
          })
        );
        setStudentList(students);
        setClassAverage(result.statistics?.overallAverage || 0);
        setLoadingStudents(false);
      })
      .catch(() => {
        setStudentList([]);
        setClassAverage(0);
        setLoadingStudents(false);
      });
  }, [selectedSchoolId, selectedClassId, selectedShift, refreshTrigger]);

  // Set initial student when list loads
  useEffect(() => {
    if (!currentStudentId && studentList.length > 0) {
      setCurrentStudentId(studentList[0].id);
    }
  }, [studentList, currentStudentId]);

  // Fetch student data
  const fetchStudent = useCallback(
    (studentId: string) => {
      if (!studentId) return;

      setData(null);
      setError(null);

      fetch(`/api/reports/student/${studentId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Erro ao carregar perfil do aluno');
          return res.json();
        })
        .then((result: StudentData) => {
          setData(result);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
    },
    []
  );

  useEffect(() => {
    fetchStudent(currentStudentId);
  }, [currentStudentId, fetchStudent]);

  // ── No student selected ────────────────────────────────────────────────

  if (!currentStudentId && studentList.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <UserCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Perfil do Aluno
            </h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma turma e um aluno para ver o perfil detalhado
            </p>
          </div>
        </div>

        <Card className="gap-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhum aluno selecionado
            </h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              {selectedClassId
                ? 'Nenhum aluno encontrado nesta turma.'
                : 'Selecione uma turma nos filtros acima para começar.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Erro ao carregar perfil
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Nenhum dado disponível.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Prepare radar chart data ──────────────────────────────────────────────
  const maxScore = 30; // approximate max score
  const radarData = data.grades.map((g) => ({
    subject:
      g.subject.length > 12 ? g.subject.slice(0, 11) + '…' : g.subject,
    fullSubject: g.subject,
    nota: Math.round((g.score / maxScore) * 100),
    score: g.score,
  }));

  const { student, grades, statistics } = data;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <UserCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Perfil do Aluno
            </h2>
            <p className="text-sm text-muted-foreground">
              Análise detalhada do desempenho individual
            </p>
          </div>
        </div>

        {/* ── Student Selector ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Aluno:
          </span>
          <Select
            value={currentStudentId}
            onValueChange={(val) => setCurrentStudentId(val)}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Selecione um aluno" />
            </SelectTrigger>
            <SelectContent>
              {loadingStudents ? (
                <SelectItem value="_loading" disabled>
                  Carregando...
                </SelectItem>
              ) : (
                studentList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Student Info Card ────────────────────────────────────────────── */}
      <Card className="gap-0 border-blue-100">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                {student.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold">{student.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {student.className}
                  </span>
                  {student.schoolName && student.schoolName !== '-' && (
                    <span>· {student.schoolName}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={resultBadgeClass(student.finalResult)}>
                {student.finalResult}
              </Badge>
              {student.birthDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(student.birthDate)}
                </span>
              )}
              {formatGender(student.gender) && (
                <Badge variant="outline" className="text-xs">
                  {formatGender(student.gender)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Radar Chart + Grades Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="lg:col-span-1 gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Mapa de Competências
            </CardTitle>
            <CardDescription>
              Notas normalizadas (escala 0-100)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {grades.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Radar
                    name="Nota"
                    dataKey="nota"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: 12,
                    }}
                    formatter={(value: number, _name: string, props: { payload?: { fullSubject?: string; score?: number } }) => [
                      `${props.payload?.score ?? 0}`,
                      props.payload?.fullSubject ?? 'Disciplina',
                    ]}
                    labelFormatter={() => ''}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                Sem notas disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grades Grid */}
        <Card className="lg:col-span-2 gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Notas por Disciplina
            </CardTitle>
            <CardDescription>
              {statistics.totalSubjects} disciplinas · Média: {statistics.average.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {grades.map((g) => {
                const pct = Math.min((g.score / maxScore) * 100, 100);
                return (
                  <div
                    key={g.subject}
                    className="rounded-lg border p-3 space-y-2 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground truncate max-w-[100px]">
                        {g.subject}
                      </span>
                      <span
                        className={`text-lg font-bold ${scoreTextColor(g.score)}`}
                      >
                        {g.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreColor(g.score)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Média Geral"
          value={statistics.average.toFixed(2)}
          subtitle={`${statistics.totalSubjects} disciplinas`}
          icon={BarChart3}
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          title="Posição na Turma"
          value={statistics.position}
          subtitle={`${statistics.classTotal} alunos`}
          icon={Trophy}
          color="bg-yellow-100 text-yellow-600"
        />
        <KpiCard
          title="Melhor Disciplina"
          value={statistics.bestSubject.name}
          subtitle={`Nota: ${statistics.bestSubject.score.toFixed(1)}`}
          icon={TrendingUp}
          color="bg-green-100 text-green-600"
        />
        <KpiCard
          title="Pior Disciplina"
          value={statistics.worstSubject.name}
          subtitle={`Nota: ${statistics.worstSubject.score.toFixed(1)}`}
          icon={TrendingDown}
          color="bg-red-100 text-red-600"
        />
        <KpiCard
          title="Acima de 15"
          value={`${statistics.above15}/${statistics.totalSubjects}`}
          subtitle={`${statistics.below15} abaixo · ${statistics.zeros} zeros`}
          icon={Star}
          color="bg-cyan-100 text-cyan-600"
        />
      </div>

      {/* ── Comparison Bar ───────────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Comparação com a Turma
          </CardTitle>
          <CardDescription>
            Média do aluno vs média geral da turma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Class average bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                Média da Turma
              </span>
              <span className="font-bold">{classAverage.toFixed(2)}</span>
            </div>
            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{
                  width: `${Math.min((classAverage / maxScore) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Student average bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Sua Média ({student.name.split(' ')[0]})</span>
              <span
                className={`font-bold ${
                  statistics.average >= classAverage
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              >
                {statistics.average.toFixed(2)}
                {statistics.average >= classAverage ? (
                  <TrendingUp className="w-3.5 h-3.5 inline-block ml-1" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 inline-block ml-1" />
                )}
              </span>
            </div>
            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  statistics.average >= classAverage
                    ? 'bg-blue-500'
                    : 'bg-orange-500'
                }`}
                style={{
                  width: `${Math.min(
                    (statistics.average / maxScore) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Difference */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {statistics.average >= classAverage ? (
                <>
                  <strong className="text-blue-600">
                    {student.name.split(' ')[0]}
                  </strong>{' '}
                  está{' '}
                  <strong className="text-blue-600">
                    {(statistics.average - classAverage).toFixed(2)} pontos
                  </strong>{' '}
                  acima da média da turma.
                </>
              ) : (
                <>
                  <strong className="text-red-600">
                    {student.name.split(' ')[0]}
                  </strong>{' '}
                  está{' '}
                  <strong className="text-red-600">
                    {(classAverage - statistics.average).toFixed(2)} pontos
                  </strong>{' '}
                  abaixo da média da turma.
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Wrapped component with Suspense boundary ───────────────────────────────

export function StudentProfileView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-2" />
          </div>
        </div>
      }
    >
      <StudentProfileInner />
    </Suspense>
  );
}
