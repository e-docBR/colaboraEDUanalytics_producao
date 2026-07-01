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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Grid3X3,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Users,
  BookOpen,
  Award,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface HeatmapClass {
  classId: string;
  className: string;
  students: Array<{
    studentId: string;
    studentName: string;
    grades: Record<string, number>;
  }>;
}

interface HeatmapData {
  classes: HeatmapClass[];
  subjects: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getCellColor(score: number): string {
  if (score === 0) return '#9ca3af'; // Gray
  if (score < 10) return '#ef4444'; // Red
  if (score < 15) return '#f97316'; // Orange
  if (score < 20) return '#eab308'; // Yellow
  return '#22c55e'; // Green
}

function getCellTextColor(score: number): string {
  if (score === 0 || score < 10 || score >= 20) return 'text-white';
  return 'text-gray-900';
}

// ── Legend Component ───────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: 'Zero', color: '#9ca3af' },
    { label: '< 10', color: '#ef4444' },
    { label: '10 – 14,9', color: '#f97316' },
    { label: '15 – 19,9', color: '#eab308' },
    { label: '≥ 20', color: '#22c55e' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="w-4 h-4 rounded-sm inline-block border border-black/10"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────

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

// ── Main Component ─────────────────────────────────────────────────────────

export function HeatmapView() {
  const { selectedSchoolId, selectedClassId, selectedShift, selectedGrade, refreshTrigger } =
    useAppStore();

  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassIdx, setSelectedClassIdx] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{
    student: string;
    subject: string;
    score: number;
  } | null>(null);

  const loading = data === null && error === null;

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);
    if (selectedGrade) params.set('grade', selectedGrade);

    fetch(`/api/reports/heatmap?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar mapa de calor');
        return res.json();
      })
      .then((result: HeatmapData) => {
        if (!cancelled) {
          setData(result);
          setSelectedClassIdx(0);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId, selectedClassId, selectedShift, refreshTrigger]);

  // Reset class selection when filters change
  useEffect(() => {
    setSelectedClassIdx(0);
  }, [selectedSchoolId, selectedClassId, selectedShift]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
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
          <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Erro ao carregar mapa de calor
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Nenhum dado disponível. Faça upload de atas primeiro.'}
          </p>
        </div>
      </div>
    );
  }

  const currentClass = data.classes[selectedClassIdx];
  const subjects = data.subjects;

  if (!currentClass || data.classes.length === 0) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Nenhuma turma encontrada
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Aplique filtros ou faça upload de atas de resultado.
          </p>
        </div>
      </div>
    );
  }

  // ── Calculate Summary Stats ──────────────────────────────────────────────

  const students = currentClass.students;
  const totalStudents = students.length;

  // Class average per subject
  const subjectAverages = subjects.map((subj) => {
    const scores = students.map((s) => s.grades[subj] || 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { subject: subj, average: Math.round(avg * 10) / 10 };
  });

  const overallClassAvg =
    subjectAverages.length > 0
      ? Math.round(
          (subjectAverages.reduce((a, b) => a + b.average, 0) /
            subjectAverages.length) *
            10
        ) / 10
      : 0;

  const bestSubject =
    subjectAverages.length > 0
      ? [...subjectAverages].sort((a, b) => b.average - a.average)[0]
      : null;

  const worstSubject =
    subjectAverages.length > 0
      ? [...subjectAverages].sort((a, b) => a.average - b.average)[0]
      : null;

  // Students below threshold (average < 15)
  const belowThreshold = students.filter((s) => {
    const scores = subjects.map((subj) => s.grades[subj] || 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return avg < 15;
  }).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
          <Grid3X3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Mapa de Calor de Notas
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualização das notas por aluno e disciplina
          </p>
        </div>
      </div>

      {/* ── Class Selector ────────────────────────────────────────────────── */}
      {data.classes.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Turma:</span>
          <Select
            value={String(selectedClassIdx)}
            onValueChange={(val) => setSelectedClassIdx(Number(val))}
          >
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Selecione a turma" />
            </SelectTrigger>
            <SelectContent>
              {data.classes.map((cls, idx) => (
                <SelectItem key={cls.classId} value={String(idx)}>
                  {cls.className} ({cls.students.length} alunos)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/40 rounded-lg border">
        <span className="text-sm font-medium">Legenda de Cores:</span>
        <Legend />
      </div>

      {/* ── Heatmap Table ─────────────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            {currentClass.className}
          </CardTitle>
          <CardDescription>
            {totalStudents} alunos × {subjects.length} disciplinas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted">
                  <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground min-w-[180px] border-r border-b">
                    Aluno
                  </th>
                  {subjects.map((subj) => (
                    <th
                      key={subj}
                      className="px-2 py-2 text-center font-semibold text-muted-foreground min-w-[80px] border-b whitespace-nowrap"
                    >
                      {subj.length > 10 ? subj.slice(0, 9) + '…' : subj}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground min-w-[60px] border-b border-l">
                    Média
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, sIdx) => {
                  const scores = subjects.map((subj) => student.grades[subj] || 0);
                  const studentAvg =
                    scores.length > 0
                      ? Math.round(
                          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
                        ) / 10
                      : 0;

                  return (
                    <tr
                      key={student.studentId}
                      className={sIdx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}
                    >
                      <td className="sticky left-0 z-10 px-3 py-2 font-medium text-foreground whitespace-nowrap border-r text-xs">
                        <span className="block truncate max-w-[200px]">
                          {student.studentName}
                        </span>
                      </td>
                      {subjects.map((subj) => {
                        const score = student.grades[subj] || 0;
                        const bgColor = getCellColor(score);
                        const textColor = getCellTextColor(score);

                        return (
                          <Tooltip key={subj}>
                            <TooltipTrigger asChild>
                              <td
                                className="px-1 py-1.5 text-center cursor-default border-b border-r border-r-black/5 hover:ring-2 hover:ring-inset hover:ring-primary/30 transition-all"
                                style={{ backgroundColor: bgColor }}
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    student: student.studentName,
                                    subject: subj,
                                    score,
                                  })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                <span
                                  className={`font-semibold ${textColor}`}
                                >
                                  {score.toFixed(1)}
                                </span>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{student.studentName}</p>
                              <p>
                                {subj}: <strong>{score.toFixed(1)}</strong>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-bold border-l border-b">
                        <span
                          className={
                            studentAvg < 10
                              ? 'text-red-600'
                              : studentAvg < 15
                                ? 'text-orange-600'
                                : studentAvg < 20
                                  ? 'text-yellow-600'
                                  : 'text-blue-600'
                          }
                        >
                          {studentAvg.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Média da Turma"
          value={overallClassAvg.toFixed(1)}
          subtitle={`${subjects.length} disciplinas`}
          icon={BarChart3}
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          title="Melhor Disciplina"
          value={bestSubject ? bestSubject.subject : '-'}
          subtitle={
            bestSubject
              ? `Média: ${bestSubject.average.toFixed(1)}`
              : 'sem dados'
          }
          icon={TrendingUp}
          color="bg-green-100 text-green-600"
        />
        <KpiCard
          title="Pior Disciplina"
          value={worstSubject ? worstSubject.subject : '-'}
          subtitle={
            worstSubject
              ? `Média: ${worstSubject.average.toFixed(1)}`
              : 'sem dados'
          }
          icon={TrendingDown}
          color="bg-red-100 text-red-600"
        />
        <KpiCard
          title="Total Alunos"
          value={totalStudents}
          subtitle="na turma"
          icon={Users}
          color="bg-cyan-100 text-cyan-600"
        />
        <KpiCard
          title="Abaixo de 15"
          value={belowThreshold}
          subtitle={
            totalStudents > 0
              ? `${Math.round((belowThreshold / totalStudents) * 100)}% da turma`
              : 'sem dados'
          }
          icon={Award}
          color="bg-orange-100 text-orange-600"
        />
      </div>

      {/* ── Subject Average Bars ───────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Média por Disciplina
          </CardTitle>
          <CardDescription>
            Desempenho médio da turma em cada disciplina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {subjectAverages
              .sort((a, b) => b.average - a.average)
              .map((sa) => {
                const pct = Math.min((sa.average / 30) * 100, 100); // max ~30
                const color =
                  sa.average >= 20
                    ? 'bg-blue-500'
                    : sa.average >= 15
                      ? 'bg-yellow-500'
                      : sa.average >= 10
                        ? 'bg-orange-500'
                        : sa.average > 0
                          ? 'bg-red-500'
                          : 'bg-gray-400';

                return (
                  <div
                    key={sa.subject}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs font-medium text-muted-foreground min-w-[140px] truncate">
                      {sa.subject}
                    </span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold min-w-[36px] text-right">
                      {sa.average.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
