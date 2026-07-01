'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { generateReportPDF } from '@/lib/pdfGenerator';
import type { PDFReportOptions } from '@/lib/pdfGenerator';

interface SchoolOption {
  id: string;
  name: string;
  logoUrl?: string | null;
}

interface ClassOption {
  id: string;
  grade: string;
  name: string;
  shift: string;
  school: { id: string; name: string };
  _count: { students: number };
}

export function PdfConfigDialog() {
  const { setActiveView } = useAppStore();

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [selectedResult, setSelectedResult] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');

  // Section toggles
  const [includeKPIs, setIncludeKPIs] = useState(true);
  const [includeStudentTable, setIncludeStudentTable] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSubjectAnalysis, setIncludeSubjectAnalysis] = useState(true);
  const [includeLowGrades, setIncludeLowGrades] = useState(false);

  // Fetch schools on mount
  useEffect(() => {
    async function fetchSchools() {
      try {
        const res = await fetch('/api/schools');
        const data = await res.json();
        setSchools(data.schools || []);
      } catch {
        setSchools([]);
      }
    }
    fetchSchools();
  }, []);

  // Fetch classes when school changes
  useEffect(() => {
    async function fetchClasses() {
      try {
        const params = new URLSearchParams();
        if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
        const res = await fetch(`/api/classes?${params}`);
        const data = await res.json();
        setClasses(data.classes || []);
      } catch {
        setClasses([]);
      }
    }
    fetchClasses();
  }, [selectedSchoolId]);

  // When school changes, reset class selection if it's no longer valid
  useEffect(() => {
    if (selectedSchoolId && !classes.find(c => c.id === selectedClassId)) {
      setSelectedClassId('');
    }
  }, [selectedSchoolId, classes, selectedClassId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setActiveView('dashboard');
  }, [setActiveView]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const activeSchool = schools.find(s => s.id === selectedSchoolId);
      const schoolLogo = activeSchool?.logoUrl || undefined;

      const options: PDFReportOptions = {
        schoolId: selectedSchoolId || undefined,
        classId: selectedClassId || undefined,
        shift: selectedShift || undefined,
        result: selectedResult || undefined,
        title: customTitle || undefined,
        includeKPIs,
        includeStudentTable,
        includeCharts,
        includeSubjectAnalysis,
        includeLowGrades,
        schoolLogo,
      };

      await generateReportPDF(options);

      // Close dialog after successful generation
      handleClose();
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Check if at least one section is selected
  const hasAnySection = includeKPIs || includeStudentTable || includeCharts || includeSubjectAnalysis || includeLowGrades;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" />
            Exportar Relatório PDF
          </DialogTitle>
          <DialogDescription>
            Configure as seções e filtros do relatório que será gerado em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="pdf-title">Título do Relatório</Label>
            <Input
              id="pdf-title"
              placeholder="Relatório de Desempenho Escolar"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </div>

          {/* Filters section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Filtros</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* School selector */}
              <div className="space-y-1.5">
                <Label>Escola</Label>
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as escolas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as escolas</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Class selector */}
              <div className="space-y-1.5">
                <Label>Turma</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as turmas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as turmas</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.grade} — {cls.shift} ({cls._count.students} alunos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shift selector */}
              <div className="space-y-1.5">
                <Label>Turno</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os turnos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os turnos</SelectItem>
                    <SelectItem value="MANHÃ">Manhã</SelectItem>
                    <SelectItem value="TARDE">Tarde</SelectItem>
                    <SelectItem value="NOITE">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Result selector */}
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                <Select value={selectedResult} onValueChange={setSelectedResult}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="APROVADO">Aprovados</SelectItem>
                    <SelectItem value="EMC">EMC (Em Curso)</SelectItem>
                    <SelectItem value="REPROVADO">Reprovados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Seções do Relatório</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sec-kpis"
                  checked={includeKPIs}
                  onCheckedChange={(checked) => setIncludeKPIs(checked === true)}
                />
                <Label htmlFor="sec-kpis" className="font-normal cursor-pointer">
                  Indicadores Gerais (KPIs)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sec-students"
                  checked={includeStudentTable}
                  onCheckedChange={(checked) => setIncludeStudentTable(checked === true)}
                />
                <Label htmlFor="sec-students" className="font-normal cursor-pointer">
                  Quadro de Alunos
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sec-charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked === true)}
                />
                <Label htmlFor="sec-charts" className="font-normal cursor-pointer">
                  Resumo Visual (Gráficos)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sec-subjects"
                  checked={includeSubjectAnalysis}
                  onCheckedChange={(checked) => setIncludeSubjectAnalysis(checked === true)}
                />
                <Label htmlFor="sec-subjects" className="font-normal cursor-pointer">
                  Análise por Disciplina
                </Label>
              </div>

              <div className="flex items-center space-x-2 sm:col-span-2">
                <Checkbox
                  id="sec-lowgrades"
                  checked={includeLowGrades}
                  onCheckedChange={(checked) => setIncludeLowGrades(checked === true)}
                />
                <Label htmlFor="sec-lowgrades" className="font-normal cursor-pointer">
                  Alunos Abaixo da Média
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || !hasAnySection}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
