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
import { Button } from '@/components/ui/button';
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
  FileText,
  Download,
  BarChart3,
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
} from 'recharts';
import { toast } from 'sonner';

interface ClassInfo {
  id: string;
  grade: string;
  name: string;
  shift: string;
  school: { name: string } | null;
  studentCount?: number;
}

interface ClassReport {
  classInfo: ClassInfo;
  students: Array<{
    id: string;
    name: string;
    birthDate: string | null;
    gender: string | null;
    finalResult: string;
    grades: Array<{ subject: { name: string }; score: number }>;
  }>;
  subjectAverages: Array<{ subject: string; average: number; count: number; zeroCount: number }>;
  stats: {
    totalStudents: number;
    approvedCount: number;
    failedCount: number;
    approvalRate: number;
    overallAverage: number;
  };
}

export function ReportsView() {
  const { selectedSchoolId, selectedClassId, refreshTrigger } = useAppStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);

    fetch(`/api/classes?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClasses(data.classes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedSchoolId, refreshTrigger]);

  const loadReport = async (classId: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/reports/class/${classId}`);
      const data = await res.json();
      // Map API response fields to component interface
      setSelectedReport({
        classInfo: {
          id: data.class?.id || '',
          grade: data.class?.grade || '',
          name: data.class?.name || '',
          shift: data.class?.shift || '',
          school: data.school ? { name: data.school.name } : null,
        },
        students: (data.students || []).map((s: Record<string, unknown>) => {
          const rawGrades = s.grades || {};
          const gradesArray = typeof rawGrades === 'object' && !Array.isArray(rawGrades)
            ? Object.entries(rawGrades).map(([subject, score]) => ({
                subject: { name: subject },
                score: score as number,
              }))
            : (rawGrades as Array<Record<string, unknown>>);
          return {
            id: s.id as string,
            name: s.name as string,
            birthDate: (s.birthDate as string) || null,
            gender: (s.gender as string) || null,
            finalResult: (s.finalResult as string) || '',
            grades: gradesArray,
          };
        }),
        subjectAverages: (data.subjectAverages || []),
        stats: {
          totalStudents: data.statistics?.totalStudents || 0,
          approvedCount: data.statistics?.approvedCount || 0,
          failedCount: data.statistics?.failedCount || 0,
          approvalRate: data.statistics?.approvalRate || 0,
          overallAverage: data.statistics?.overallAverage || 0,
        },
      });
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setReportLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
      if (selectedClassId) params.set('classId', selectedClassId);

      const res = await fetch(`/api/exports/csv?${params}`);
      if (!res.ok) throw new Error('Erro ao exportar');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_alunos.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
      if (selectedClassId) params.set('classId', selectedClassId);

      const res = await fetch(`/api/exports/excel?${params}`);
      if (!res.ok) throw new Error('Erro ao exportar');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_alunos.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar Excel');
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Export buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
        <Button variant="outline" onClick={exportExcel} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Class list */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base">Relatórios por Turma</CardTitle>
          <CardDescription>
            Selecione uma turma para ver o relatório detalhado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma turma encontrada. Faça upload de atas primeiro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => loadReport(cls.id)}
                  className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                    selectedReport?.classInfo?.id === cls.id
                      ? 'border-blue-400 bg-blue-50 shadow-md'
                      : 'border-border hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {cls.grade} {cls.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{cls.shift}</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {cls.school && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      {cls.school.name}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected report */}
      {reportLoading && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-60" />
        </div>
      )}

      {selectedReport && !reportLoading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="gap-0">
              <CardHeader className="pb-1"><CardDescription className="text-xs">Turma</CardDescription></CardHeader>
              <CardContent>
                <p className="text-lg font-bold">
                  {selectedReport.classInfo.grade} {selectedReport.classInfo.name}
                </p>
                <p className="text-xs text-muted-foreground">{selectedReport.classInfo.shift}</p>
              </CardContent>
            </Card>
            <Card className="gap-0">
              <CardHeader className="pb-1"><CardDescription className="text-xs">Total Alunos</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-bold">{selectedReport.stats.totalStudents}</p></CardContent>
            </Card>
            <Card className="gap-0">
              <CardHeader className="pb-1"><CardDescription className="text-xs">Aprovação</CardDescription></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{selectedReport.stats.approvalRate}%</p>
                <p className="text-xs text-muted-foreground">{selectedReport.stats.approvedCount} aprovados</p>
              </CardContent>
            </Card>
            <Card className="gap-0">
              <CardHeader className="pb-1"><CardDescription className="text-xs">Reprovação</CardDescription></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{100 - selectedReport.stats.approvalRate}%</p>
                <p className="text-xs text-muted-foreground">{selectedReport.stats.failedCount} reprovados</p>
              </CardContent>
            </Card>
            <Card className="gap-0">
              <CardHeader className="pb-1"><CardDescription className="text-xs">Média Geral</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-bold text-amber-600">{selectedReport.stats.overallAverage}</p></CardContent>
            </Card>
          </div>

          {/* Subject chart */}
          <Card className="gap-0">
            <CardHeader>
              <CardTitle className="text-base">Média por Disciplina</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedReport.subjectAverages.length > 0 && (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={selectedReport.subjectAverages} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="subject" angle={-45} textAnchor="end" fontSize={10} height={80} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip formatter={(value: number) => [value.toFixed(1), 'Média']} />
                    <Bar dataKey="average" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Student table */}
          <Card className="gap-0">
            <CardHeader>
              <CardTitle className="text-base">Alunos da Turma</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="hidden sm:table-cell">Média</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReport.students.map((student) => {
                      const avg = student.grades.length > 0
                        ? (student.grades.reduce((s, g) => s + g.score, 0) / student.grades.length).toFixed(1)
                        : '-';
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="text-sm">{student.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm font-medium">{avg}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                student.finalResult === 'APROVADO'
                                  ? 'text-blue-600 bg-blue-50 border-blue-200'
                                  : 'text-red-600 bg-red-50 border-red-200'
                              }
                            >
                              {student.finalResult}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
