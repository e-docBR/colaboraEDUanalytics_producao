'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { UserCircle } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { formatGender } from '@/lib/gender';

interface StudentRecord {
  id: string;
  name: string;
  birthDate: string | null;
  gender: string | null;
  finalResult: string;
  schoolClass: { grade: string; name: string; shift: string } | null;
  grades: Array<{ subject: { name: string }; score: number }>;
}

export function StudentsView() {
  const { selectedSchoolId, selectedClassId, selectedShift, selectedResult, searchQuery, refreshTrigger, openStudentProfile } =
    useAppStore();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedShift) params.set('shift', selectedShift);
    if (selectedResult) params.set('result', selectedResult);

    try {
      // Fetch classes matching filters
      const classRes = await fetch(`/api/classes?${params}`);
      const classData = await classRes.json();
      const classes = classData.classes || [];

      if (classes.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch students from all matching classes in parallel
      const promises = classes.map((c: { id: string }) =>
        fetch(`/api/reports/class/${c.id}`)
          .then((r) => r.json())
          .then((report) => {
            const r = report.students || [];
            return r.map((s: any) => ({
              ...s,
              schoolClass: s.schoolClass || {
                grade: classes.find((cl: { id: string }) => cl.id === c.id)?.grade || '',
                name: classes.find((cl: { id: string }) => cl.id === c.id)?.name || '',
                shift: classes.find((cl: { id: string }) => cl.id === c.id)?.shift || '',
              },
              // Convert grades from Record<string, number> to Array format
              grades: Array.isArray(s.grades)
                ? s.grades
                : Object.entries(s.grades || {}).map(([subjectName, score]) => ({
                    subject: { name: subjectName },
                    score: score as number,
                  })),
            }));
          })
          .catch(() => [] as StudentRecord[])
      );

      const allStudents = await Promise.all(promises);
      setStudents(allStudents.flat());
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId, selectedClassId, selectedShift, selectedResult]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents, refreshTrigger]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (selectedResult) {
      result = result.filter((s) => s.finalResult === selectedResult);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [students, selectedResult, searchQuery]);

  const resultColor = (result: string) => {
    switch (result) {
      case 'APROVADO':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'REPROVADO':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'EMC':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{filteredStudents.length} alunos encontrados</h3>
          <p className="text-sm text-muted-foreground">
            {students.length !== filteredStudents.length
              ? `${students.length - filteredStudents.length} aluno(s) filtrado(s)`
              : 'Clique em um aluno para ver detalhes'}
          </p>
        </div>
      </div>

      <Card className="gap-0">
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Faça upload de atas de resultado ou ajuste os filtros
              </p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="hidden sm:table-cell">Turma</TableHead>
                    <TableHead className="hidden md:table-cell">Sexo</TableHead>
                    <TableHead className="hidden lg:table-cell">Média</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const isExpanded = expandedStudent === student.id;
                    const gradesArr = Array.isArray(student.grades) ? student.grades : [];
                    const avg = gradesArr.length > 0
                      ? (gradesArr.reduce((sum, g) => sum + g.score, 0) / gradesArr.length).toFixed(1)
                      : '-';

                    return (
                      <TableRow
                        key={student.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 hover:bg-blue-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                openStudentProfile(student.id);
                              }}
                              title="Ver perfil completo"
                            >
                              <UserCircle className="w-4 h-4" />
                            </button>
                            <div>
                              <button
                                className="font-medium text-sm hover:text-blue-600 hover:underline transition-colors text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStudentProfile(student.id);
                                }}
                              >
                                {student.name}
                              </button>
                              {student.birthDate && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(student.birthDate).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {student.schoolClass
                            ? `${student.schoolClass.grade} ${student.schoolClass.name} - ${student.schoolClass.shift}`
                            : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{formatGender(student.gender) || '-'}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm font-medium">{avg}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={resultColor(student.finalResult)}>
                            {student.finalResult}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Expanded detail row */}
                  {expandedStudent && (() => {
                    const student = filteredStudents.find((s) => s.id === expandedStudent);
                    if (!student || !Array.isArray(student.grades) || student.grades.length === 0) return null;
                    return (
                      <TableRow key={`${student.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/20 px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground">Notas por Disciplina</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                              {student.grades.map((g, i) => (
                                <div
                                  key={i}
                                  className={`p-2 rounded-lg border text-center ${
                                    g.score === 0
                                      ? 'bg-red-50 border-red-200'
                                      : g.score >= 15
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-amber-50 border-amber-200'
                                  }`}
                                >
                                  <p className="text-xs text-muted-foreground truncate">{g.subject.name}</p>
                                  <p className={`text-lg font-bold ${g.score === 0 ? 'text-red-600' : g.score >= 15 ? 'text-blue-600' : 'text-amber-600'}`}>
                                    {g.score.toFixed(1)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
