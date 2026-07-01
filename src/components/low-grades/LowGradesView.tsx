'use client';

import { Fragment, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingDown,
  AlertCircle,
  Users,
  BookOpen,
  Download,
  GraduationCap,
  BarChart3,
  FileSpreadsheet,
  Filter,
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
  ReferenceLine,
  LabelList,
} from 'recharts';
import { toast } from 'sonner';
import { generateLowGradesOnlyPDF } from '@/lib/pdfGenerator';

interface LowGradeStudent {
  studentId: string;
  studentName: string;
  className: string;
  classId: string;
  shift: string;
  schoolName: string;
  finalResult: string;
  lowGradeCount: number;
  totalGrades: number;
  lowGradeSubjects: Array<{ subject: string; score: number }>;
  allGrades: Array<{ subject: string; score: number }>;
  average: number;
}

interface SubjectAnalysis {
  subject: string;
  lowCount: number;
  zeroCount: number;
  totalCount: number;
  percentage: number;
  avgLowScore: number;
}

interface ClassAnalysis {
  className: string;
  shift: string;
  schoolName: string;
  totalStudents: number;
  affectedCount: number;
}

interface ScoreDistribution {
  range: string;
  count: number;
  color: string;
}

interface LowGradesData {
  threshold: number;
  totalLowGrades: number;
  zeroGradeCount: number;
  totalStudentsCount: number;
  affectedStudents: number;
  affectedPercentage: number;
  students: LowGradeStudent[];
  subjectAnalysis: SubjectAnalysis[];
  classAnalysis: ClassAnalysis[];
  scoreDistribution: ScoreDistribution[];
}

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#ec4899'];

export function LowGradesView() {
  const { selectedSchoolId, selectedClassId, selectedShift, selectedGrade, refreshTrigger } = useAppStore();
  const [data, setData] = useState<LowGradesData | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);
    if (selectedGrade) params.set('grade', selectedGrade);

    fetch(`/api/dashboard/low-grades?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => { cancelled = true; };
  }, [selectedSchoolId, selectedClassId, selectedShift, refreshTrigger]);

  const exportCSV = async () => {
    if (!data) return;
    try {
      const BOM = '\uFEFF';
      let csv = BOM + 'Aluno;Turma;Turno;Escola;Média Geral;Resultado Final;Disciplinas Abaixo da Média;Nota Mais Baixa\n';
      for (const s of data.students) {
        const lowestGrade = s.lowGradeSubjects.length > 0
          ? Math.min(...s.lowGradeSubjects.map((g) => g.score)).toFixed(1)
          : '-';
        csv += `"${s.studentName}";"${s.className}";"${s.shift}";"${s.schoolName}";${s.average};${s.finalResult};${s.lowGradeCount}/${s.totalGrades};${lowestGrade}\n`;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alunos_abaixo_da_media.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  };

  const exportPDF = async () => {
    if (!data) return;
    try {
      toast.loading('Gerando PDF...', { id: 'pdf-gen' });
      const firstStudent = data.students[0];
      const schoolName = firstStudent?.schoolName || data.classAnalysis[0]?.schoolName || 'colaboraEDU Analytics';
      
      let clsName = '';
      let shftName = '';
      if (selectedClassId && data.students.length > 0) {
        clsName = data.students[0].className;
        shftName = data.students[0].shift;
      } else {
        clsName = data.classAnalysis.map(c => c.className).join(', ') || 'Geral';
        shftName = selectedShift || 'Todos';
      }

      await generateLowGradesOnlyPDF(data, schoolName, clsName, shftName);
      toast.success('PDF exportado com sucesso', { id: 'pdf-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar PDF', { id: 'pdf-gen' });
    }
  };

  if (!data) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const scoreColor = (score: number) => {
    if (score === 0) return 'text-gray-600 bg-gray-100 border-gray-300';
    if (score < 5) return 'text-red-700 bg-red-100 border-red-300';
    if (score < 10) return 'text-red-600 bg-red-50 border-red-200';
    if (score < 15) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score < 20) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const isLowGrade = (score: number) => score < data.threshold;

  // Chart data: first 15 students (alphabetically ordered)
  const topStudentsChart = data.students.slice(0, 15).map((s, i) => ({
    name: s.studentName.length > 20 ? s.studentName.slice(0, 18) + '...' : s.studentName,
    fullName: s.studentName,
    'Disciplinas < 15': s.lowGradeCount,
    'Média Geral': Math.round(s.average * 10) / 10,
  }));

  // Pie chart: distribution of students by number of low grades
  const studentDistribution = (() => {
    const buckets: Record<string, number> = {
      '1-2 disciplinas': 0,
      '3-4 disciplinas': 0,
      '5-6 disciplinas': 0,
      '7-8 disciplinas': 0,
      '9-10 disciplinas': 0,
    };
    for (const s of data.students) {
      if (s.lowGradeCount <= 2) buckets['1-2 disciplinas']++;
      else if (s.lowGradeCount <= 4) buckets['3-4 disciplinas']++;
      else if (s.lowGradeCount <= 6) buckets['5-6 disciplinas']++;
      else if (s.lowGradeCount <= 8) buckets['7-8 disciplinas']++;
      else buckets['9-10 disciplinas']++;
    }
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  })();

  // Subject chart data sorted by low count
  const subjectChartData = data.subjectAnalysis.map((s) => ({
    name: s.subject.length > 18 ? s.subject.slice(0, 16) + '...' : s.subject,
    fullName: s.subject,
    'Alunos abaixo': s.lowCount,
    '% abaixo': s.percentage,
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-red-500" />
            Alunos Abaixo da M&eacute;dia
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Relat&oacute;rio completo de alunos com notas abaixo de {data.threshold} pontos em qualquer disciplina
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button onClick={exportPDF} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="gap-0 border-red-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Notas &lt; {data.threshold}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">{data.totalLowGrades}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.zeroGradeCount > 0 && `${data.zeroGradeCount} zeros `}
              notas abaixo do limite
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 border-orange-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Alunos Afetados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">{data.affectedStudents}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              de {data.totalStudentsCount} ({data.affectedPercentage}%)
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 border-amber-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Disciplinas Cr&iacute;ticas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">
                {data.subjectAnalysis.filter((s) => s.percentage >= 50).length}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">com &ge;50% de notas baixas</p>
          </CardContent>
        </Card>
        <Card className="gap-0 border-blue-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              M&eacute;dia Geral (afetados)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold">
                {data.students.length > 0
                  ? (data.students.reduce((a, b) => a + b.average, 0) / data.students.length).toFixed(1)
                  : '-'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">m&eacute;dia entre alunos afetados</p>
          </CardContent>
        </Card>
        <Card className="gap-0 border-purple-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Mais Cr&iacute;tico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold">
                {data.students.length > 0
                  ? (data.students[0].studentName.length > 12
                      ? data.students[0].studentName.slice(0, 10) + '...'
                      : data.students[0].studentName)
                  : '-'}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.students.length > 0
                ? `${data.students[0].lowGradeCount} disciplinas abaixo`
                : 'sem dados'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart - students with most low grades */}
        <Card className="lg:col-span-2 gap-0">
          <CardHeader>
            <CardTitle className="text-base">Alunos - Disciplinas Abaixo da M&eacute;dia</CardTitle>
            <CardDescription>
              Primeiros {Math.min(15, data.students.length)} alunos em ordem alfab&eacute;tica
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topStudentsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.min(400, topStudentsChart.length * 28 + 40)}>
                <BarChart data={topStudentsChart} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    fontSize={10}
                    width={95}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    formatter={(value: number, name: string) => {
                      if (name === 'Média Geral') return [value.toFixed(1), name];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="Disciplinas < 15" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Média Geral" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span style={{ fontSize: 11 }}>{value}</span>
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                Nenhuma nota abaixo da m&eacute;dia encontrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - score distribution */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Distribui&ccedil;&atilde;o por Faixa de Nota</CardTitle>
            <CardDescription>Notas abaixo de {data.threshold} por faixa</CardDescription>
          </CardHeader>
          <CardContent>
            {data.scoreDistribution.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={data.scoreDistribution.filter((d) => d.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {data.scoreDistribution.filter((d) => d.count > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                    }}
                    formatter={(value: number, name: string) => [`${value} notas`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={50}
                    formatter={(value: string) => (
                      <span style={{ fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                Nenhuma nota baixa encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second row: Subject chart + Student distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject analysis bar chart */}
        <Card className="lg:col-span-2 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Alunos Abaixo da M&eacute;dia por Disciplina</CardTitle>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
              Turma: {(() => {
                if (selectedClassId && data.students.length > 0) {
                  return data.students[0].className;
                }
                return data.classAnalysis.map(c => c.className).join(', ') || 'Geral';
              })()} | Total de Alunos: {data.totalStudentsCount}
            </div>
            <CardDescription className="mt-1">
              Porcentagem de alunos com notas &lt; {data.threshold} em cada disciplina
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subjectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectChartData} margin={{ top: 28, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    fontSize={10}
                    height={80}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    fontSize={11}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    labelFormatter={(label: any, payload: any[]) => payload?.[0]?.payload?.fullName || ''}
                    formatter={(value: any, name: any, props: any) => {
                      const count = props?.payload?.['Alunos abaixo'] || 0;
                      return [`${Number(value).toFixed(1)}% (${count} de ${data.totalStudentsCount} alunos)`, 'Alunos Abaixo'];
                    }}
                  />
                  <Bar dataKey="% abaixo" fill="#f97316" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="% abaixo"
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        if (value === undefined || value === 0) return null;
                        const rawData = subjectChartData[index];
                        const count = rawData ? rawData['Alunos abaixo'] : 0;
                        const cx = x + width / 2;
                        return (
                          <g>
                            {/* Linha superior: Qtd de alunos */}
                            <text
                              x={cx}
                              y={y - 14}
                              fill="hsl(var(--foreground))"
                              textAnchor="middle"
                              fontSize={9.5}
                              fontWeight="bold"
                            >
                              {count} {count === 1 ? 'aluno' : 'alunos'}
                            </text>
                            {/* Linha inferior: Porcentagem */}
                            <text
                              x={cx}
                              y={y - 3}
                              fill="hsl(var(--muted-foreground))"
                              textAnchor="middle"
                              fontSize={8.5}
                              fontWeight="medium"
                            >
                              {Number(value).toFixed(1)}%
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhuma nota baixa encontrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student distribution pie */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Alunos por Qtd. de Disciplinas</CardTitle>
            <CardDescription>Distribui&ccedil;&atilde;o dos alunos afetados</CardDescription>
          </CardHeader>
          <CardContent>
            {studentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={studentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {studentDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                    }}
                    formatter={(value: number, name: string) => [`${value} alunos`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={50}
                    formatter={(value: string) => (
                      <span style={{ fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum aluno afetado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student list with detailed low grades */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Detalhamento Completo dos Alunos
          </CardTitle>
          <CardDescription>
            Todos os {data.students.length} alunos com pelo menos uma nota abaixo de {data.threshold}.
            Clique em um aluno para expandir os detalhes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum aluno com notas abaixo de {data.threshold}
              </p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="hidden sm:table-cell">Turma</TableHead>
                    <TableHead className="hidden md:table-cell text-center">M&eacute;dia</TableHead>
                    <TableHead className="text-center">Abaixo</TableHead>
                    <TableHead className="hidden lg:table-cell">Resultado</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Nota Mais Baixa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.students.map((student) => {
                    const isExpanded = expandedStudent === student.studentId;
                    const lowestGrade = student.lowGradeSubjects.length > 0
                      ? Math.min(...student.lowGradeSubjects.map((g) => g.score))
                      : 0;
                    const sortedAllGrades = [...(student.allGrades || [])].sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR'));
                    const gradesAboveThreshold = sortedAllGrades.filter((g) => !isLowGrade(g.score));

                    return (
                      <Fragment key={student.studentId}>
                        <TableRow
                          className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                          onClick={() => setExpandedStudent(isExpanded ? null : student.studentId)}
                        >
                          <TableCell className="w-8 text-center text-xs text-muted-foreground">
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{student.studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {student.lowGradeCount} de {student.totalGrades} disciplinas abaixo
                            </p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-sm">{student.className}</span>
                            <span className="text-xs text-muted-foreground block">{student.shift}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center">
                            <span className={`text-sm font-bold ${student.average < 10 ? 'text-red-600' : student.average < 15 ? 'text-orange-600' : 'text-blue-600'}`}>
                              {student.average.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                student.lowGradeCount >= 7
                                  ? 'text-red-600 bg-red-50 border-red-200'
                                  : student.lowGradeCount >= 4
                                    ? 'text-orange-600 bg-orange-50 border-orange-200'
                                    : 'text-amber-600 bg-amber-50 border-amber-200'
                              }
                            >
                              {student.lowGradeCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge
                              variant="outline"
                              className={
                                student.finalResult === 'APROVADO' || student.finalResult === 'APROVADO POR CONSELHO'
                                  ? 'text-blue-600 bg-blue-50 border-blue-200'
                                  : student.finalResult === 'EMC'
                                    ? 'text-blue-600 bg-blue-50 border-blue-200'
                                    : 'text-red-600 bg-red-50 border-red-200'
                              }
                            >
                              {student.finalResult}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${scoreColor(lowestGrade)}`}>
                              {lowestGrade.toFixed(1)}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${student.studentId}-detail`}>
                            <TableCell colSpan={7} className="bg-muted/20 px-6 py-4">
                              <div className="space-y-4">
                                {/* All grades header */}
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Todas as Notas - {student.studentName}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-2.5 rounded bg-red-200 border border-red-300 inline-block"></span>
                                      Abaixo de {data.threshold}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300 inline-block"></span>
                                      Igual ou acima
                                    </span>
                                  </div>
                                </div>

                                {/* All grades grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                                  {sortedAllGrades.map((g, i) => (
                                    <div
                                      key={i}
                                      className={`inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                                        isLowGrade(g.score)
                                          ? 'border-red-200 bg-red-50'
                                          : 'border-blue-200 bg-blue-50'
                                      }`}
                                    >
                                      <span className={`font-semibold truncate max-w-[120px] ${
                                        isLowGrade(g.score) ? 'text-red-700' : 'text-blue-700'
                                      }`}>
                                        {g.subject}
                                      </span>
                                      <span className={`font-bold text-sm min-w-[36px] text-right ${
                                        g.score === 0 ? 'text-gray-600' : isLowGrade(g.score) ? 'text-red-600' : 'text-blue-600'
                                      }`}>
                                        {g.score.toFixed(1)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Summary line */}
                                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                                  <span>M&eacute;dia: <strong className={student.average < 10 ? 'text-red-600' : student.average < 15 ? 'text-orange-600' : 'text-blue-600'}>{student.average.toFixed(1)}</strong></span>
                                  <span>Abaixo: <strong className="text-red-600">{student.lowGradeCount}</strong></span>
                                  <span>Acima: <strong className="text-blue-600">{student.totalGrades - student.lowGradeCount}</strong></span>
                                  <span>Mais alta: <strong className="text-blue-600">{sortedAllGrades.length > 0 ? sortedAllGrades[sortedAllGrades.length - 1].score.toFixed(1) : '-'}</strong></span>
                                  <span>Mais baixa: <strong className="text-red-600">{sortedAllGrades.length > 0 ? sortedAllGrades[0].score.toFixed(1) : '-'}</strong></span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject analysis table */}
      {data.subjectAnalysis.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              An&aacute;lise por Disciplina
            </CardTitle>
            <CardDescription>Resumo de notas abaixo de {data.threshold} por disciplina</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[350px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    <TableHead className="text-center">Notas &lt; {data.threshold}</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Zeros</TableHead>
                    <TableHead className="text-center">Total de Alunos</TableHead>
                    <TableHead className="text-center">% Abaixo</TableHead>
                    <TableHead className="hidden md:table-cell text-center">M&eacute;dia (baixas)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subjectAnalysis.map((subject, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{subject.subject}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                          {subject.lowCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        {subject.zeroCount > 0 && (
                          <Badge variant="outline" className="text-gray-600 bg-gray-100 border-gray-300">
                            {subject.zeroCount}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{subject.totalCount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(subject.percentage, 100)}%`,
                                backgroundColor: subject.percentage >= 80 ? '#dc2626' : subject.percentage >= 50 ? '#f97316' : '#eab308',
                              }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${subject.percentage >= 80 ? 'text-red-600' : subject.percentage >= 50 ? 'text-orange-600' : 'text-amber-600'}`}>
                            {subject.percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center text-sm font-medium">
                        {subject.avgLowScore}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class analysis */}
      {data.classAnalysis.length > 0 && (
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5" />
              Impacto por Turma
            </CardTitle>
            <CardDescription>Quantidade de alunos afetados por turma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead className="hidden sm:table-cell">Turno</TableHead>
                    <TableHead className="hidden md:table-cell">Escola</TableHead>
                    <TableHead className="text-center">Total Alunos</TableHead>
                    <TableHead className="text-center">Alunos Afetados</TableHead>
                    <TableHead className="text-center">% Afetados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.classAnalysis.map((cls, i) => {
                    const pct = cls.totalStudents > 0 ? Math.round((cls.affectedCount / cls.totalStudents) * 10000) / 100 : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{cls.className}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{cls.shift}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{cls.schoolName}</TableCell>
                        <TableCell className="text-center text-sm">{cls.totalStudents}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                            {cls.affectedCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
