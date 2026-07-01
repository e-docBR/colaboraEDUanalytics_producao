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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

interface ClassInfo {
  id: string;
  grade: string;
  name: string;
  shift: string;
  school: { name: string; logoUrl?: string | null } | null;
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
  const { selectedSchoolId, selectedClassId, selectedGrade, refreshTrigger } = useAppStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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
    setModalOpen(true);
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
          school: data.school ? { name: data.school.name, logoUrl: data.school.logoUrl } : null,
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
      setModalOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!selectedReport) return;
    setExportingPdf(true);
    try {
      const schoolLogo = selectedReport.classInfo.school?.logoUrl || undefined;
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedReport.classInfo.id,
          includeKPIs: true,
          includeStudentTable: true,
          includeCharts: true,
          includeSubjectAnalysis: true,
          includeLowGrades: false,
          title: `Relatório - ${selectedReport.classInfo.grade}`,
          schoolLogo,
        }),
      });
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = `${selectedReport.classInfo.grade}`.replace(/\s+/g, '_');
      a.download = `relatorio_${safeName}_${new Date().getFullYear()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
      if (selectedClassId) params.set('classId', selectedClassId);
      if (selectedGrade) params.set('grade', selectedGrade);

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
      if (selectedGrade) params.set('grade', selectedGrade);

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
              {(selectedGrade ? classes.filter((c) => c.grade.startsWith(selectedGrade)) : classes).map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => loadReport(cls.id)}
                  className="p-4 rounded-xl border text-left transition-all hover:shadow-md border-border hover:border-blue-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {cls.grade}
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

      {/* Report Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setSelectedReport(null); }}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[85vw] max-h-[92vh] flex flex-col p-0" showCloseButton={true}>
          {/* Modal header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                {selectedReport?.classInfo.school?.logoUrl && (
                  <img
                    src={selectedReport.classInfo.school.logoUrl}
                    alt="Logo da escola"
                    className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
                  />
                )}
                <div>
                  <DialogTitle className="text-lg">
                    {selectedReport
                      ? `${selectedReport.classInfo.grade}`
                      : 'Carregando...'}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {selectedReport
                      ? `${selectedReport.classInfo.shift} — ${selectedReport.classInfo.school?.name || ''}`
                      : 'Buscando dados do relatório...'}
                  </DialogDescription>
                </div>
              </div>
              {selectedReport && !reportLoading && (
                <Button
                  onClick={exportPdf}
                  disabled={exportingPdf}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                >
                  {exportingPdf ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Exportar PDF</>
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Modal body with scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {reportLoading && (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Carregando relatório...</span>
                </div>
                <Skeleton className="h-24" />
                <Skeleton className="h-48" />
                <Skeleton className="h-32" />
              </div>
            )}

            {selectedReport && !reportLoading && (
              <>
                {/* Stats KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <Card className="gap-0">
                    <CardHeader className="pb-1"><CardDescription className="text-xs">Turma</CardDescription></CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {selectedReport.classInfo.grade}
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
                      <ResponsiveContainer width="100%" height={280}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
