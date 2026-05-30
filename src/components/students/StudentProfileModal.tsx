'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatGender } from '@/lib/gender';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  BookOpen,
  BarChart3,
  Star,
  AlertCircle,
  Users,
  X,
  ExternalLink,
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
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────

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
  student: {
    id: string;
    name: string;
    birthDate: string | null;
    gender: string | null;
    finalResult: string;
    className: string;
    schoolName: string;
  };
  grades: GradeItem[];
  statistics: Statistics;
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

// ── Component ──────────────────────────────────────────────────────────────

export function StudentProfileModal() {
  const {
    studentModalOpen,
    setStudentModalOpen,
    selectedStudentId,
    setSelectedStudentId,
    setActiveView,
  } = useAppStore();

  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudent = useCallback(async (studentId: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/reports/student/${studentId}`);
      if (!res.ok) throw new Error('Erro ao carregar perfil do aluno');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (studentModalOpen && selectedStudentId) {
      fetchStudent(selectedStudentId);
    }
  }, [studentModalOpen, selectedStudentId, fetchStudent]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setStudentModalOpen(false);
      setSelectedStudentId(null);
      setData(null);
      setError(null);
    }
  };

  const goToProfile = () => {
    if (selectedStudentId) {
      setStudentModalOpen(false);
      // Don't clear selectedStudentId - StudentProfileView needs it
      setData(null);
      setActiveView('student-profile');
    }
  };

  const maxScore = 30;

  return (
    <Dialog open={studentModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0">
        {/* Always include DialogTitle for accessibility (Radix UI requirement) */}
        <DialogTitle className="sr-only">Perfil do Aluno</DialogTitle>
        <DialogDescription className="sr-only">Perfil detalhado do desempenho do aluno</DialogDescription>

        {loading && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => selectedStudentId && fetchStudent(selectedStudentId)}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Visible Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold">Perfil do Aluno</h2>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-blue-600 hover:text-blue-700"
                onClick={goToProfile}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver página completa
              </Button>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* Student Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {data.student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate">{data.student.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {data.student.className}
                    </span>
                    {data.student.schoolName && data.student.schoolName !== '-' && (
                      <span className="hidden sm:inline">· {data.student.schoolName}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <Badge className={resultBadgeClass(data.student.finalResult)}>
                    {data.student.finalResult}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {data.student.birthDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(data.student.birthDate)}
                      </span>
                    )}
                    {formatGender(data.student.gender, true) && (
                      <Badge variant="outline" className="text-xs">
                        {formatGender(data.student.gender, true)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Média Geral</span>
                    <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-xl font-bold">{data.statistics.average.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">{data.statistics.totalSubjects} disciplinas</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Posição</span>
                    <Trophy className="w-3.5 h-3.5 text-yellow-600" />
                  </div>
                  <div className="text-xl font-bold">{data.statistics.position}</div>
                  <p className="text-xs text-muted-foreground">de {data.statistics.classTotal} alunos</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Melhor</span>
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="text-sm font-bold truncate">{data.statistics.bestSubject.name}</div>
                  <p className="text-xs text-muted-foreground">Nota: {data.statistics.bestSubject.score.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Pior</span>
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="text-sm font-bold truncate">{data.statistics.worstSubject.name}</div>
                  <p className="text-xs text-muted-foreground">Nota: {data.statistics.worstSubject.score.toFixed(1)}</p>
                </div>
              </div>

              {/* Radar + Grades Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Radar Chart */}
                <Card className="gap-0">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      Mapa de Competências
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {data.grades.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart
                          data={data.grades.map((g) => ({
                            subject: g.subject.length > 10 ? g.subject.slice(0, 9) + '...' : g.subject,
                            fullSubject: g.subject,
                            nota: Math.round((g.score / maxScore) * 100),
                            score: g.score,
                          }))}
                        >
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
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
                              fontSize: 11,
                            }}
                            formatter={(value: number, _name: string, props: { payload?: { fullSubject?: string; score?: number } }) => [
                              `${props.payload?.score ?? 0}`,
                              props.payload?.fullSubject ?? '',
                            ]}
                            labelFormatter={() => ''}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                        Sem notas disponíveis
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Grades Grid */}
                <Card className="gap-0">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      Notas por Disciplina
                    </CardTitle>
                    <CardDescription>
                      Acima de 15: <strong className="text-blue-600">{data.statistics.above15}</strong> ·{' '}
                      Abaixo: <strong className="text-orange-600">{data.statistics.below15}</strong> ·{' '}
                      Zeros: <strong className="text-gray-600">{data.statistics.zeros}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto">
                      {data.grades.map((g) => {
                        const pct = Math.min((g.score / maxScore) * 100, 100);
                        return (
                          <div
                            key={g.subject}
                            className="rounded-lg border p-2 space-y-1.5 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground truncate max-w-[80px]">
                                {g.subject}
                              </span>
                              <span className={`text-sm font-bold ${scoreTextColor(g.score)}`}>
                                {g.score.toFixed(1)}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
