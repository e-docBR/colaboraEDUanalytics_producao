'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface School {
  id: string;
  name: string;
}

interface SchoolClass {
  id: string;
  grade: string;
  name: string;
  shift: string;
  schoolId: string;
}

export function FiltersBar() {
  const {
    selectedSchoolId,
    setSelectedSchoolId,
    selectedClassId,
    setSelectedClassId,
    selectedShift,
    setSelectedShift,
    selectedResult,
    setSelectedResult,
    searchQuery,
    setSearchQuery,
    activeView,
    refreshTrigger,
  } = useAppStore();

  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  useEffect(() => {
    fetch('/api/schools')
      .then((r) => r.json())
      .then((data) => setSchools(data.schools || []))
      .catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSchoolId) params.set('schoolId', selectedSchoolId);
    if (selectedShift) params.set('shift', selectedShift);
    fetch(`/api/classes?${params}`)
      .then((r) => r.json())
      .then((data) => setClasses(data.classes || []))
      .catch(() => {});
  }, [selectedSchoolId, selectedShift, refreshTrigger]);

  const showFilters = ['dashboard', 'students', 'low-grades', 'reports', 'heatmap', 'ranking', 'comparison', 'performance', 'inconsistencies', 'student-profile'].includes(activeView);

  if (!showFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 border-b border-border">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          aria-label="Buscar aluno"
          placeholder="Buscar aluno..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* School filter */}
      {schools.length > 0 && (
        <Select
          value={selectedSchoolId || 'all'}
          onValueChange={(val) => {
            setSelectedSchoolId(val === 'all' ? null : val);
            setSelectedClassId(null);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as Escolas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Escolas</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Class filter */}
      {classes.length > 0 && (
        <Select
          value={selectedClassId || 'all'}
          onValueChange={(val) => setSelectedClassId(val === 'all' ? null : val)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as Turmas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Turmas</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.grade} {c.name} - {c.shift}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Shift filter */}
      <Select
        value={selectedShift || 'all'}
        onValueChange={(val) => {
          setSelectedShift(val === 'all' ? null : val);
          setSelectedClassId(null);
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Todos os Turnos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Turnos</SelectItem>
          <SelectItem value="MATUTINO">Matutino</SelectItem>
          <SelectItem value="VESPERTINO">Vespertino</SelectItem>
          <SelectItem value="NOTURNO">Noturno</SelectItem>
          <SelectItem value="INTEGRAL">Integral</SelectItem>
        </SelectContent>
      </Select>

      {/* Result filter */}
      <Select
        value={selectedResult || 'all'}
        onValueChange={(val) => setSelectedResult(val === 'all' ? null : val)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Todos os Resultados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Resultados</SelectItem>
          <SelectItem value="APROVADO">Aprovado</SelectItem>
          <SelectItem value="EMC">EMC (Em Curso)</SelectItem>
          <SelectItem value="REPROVADO">Reprovado</SelectItem>
          <SelectItem value="APROVADO POR CONSELHO">Aprovado por Conselho</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
