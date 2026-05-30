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
  AlertTriangle,
  AlertCircle,
  FileWarning,
  Users,
  BookOpen,
  XCircle,
} from 'lucide-react';

interface InconsistencyRecord {
  id: string;
  type: string;
  message: string;
  details: string | null;
  createdAt: string;
  upload: { originalName: string } | null;
  student: { name: string } | null;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  missing_grade: { label: 'Sem Nota', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  zero_grades: { label: 'Notas Zeradas', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  class_all_failed: { label: 'Turma 100% Reprovada', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  critical_subject: { label: 'Disciplina Crítica', icon: BookOpen, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  missing_field: { label: 'Campo Ausente', icon: FileWarning, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  duplicate_student: { label: 'Aluno Duplicado', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
};

export function InconsistenciesView() {
  const { refreshTrigger } = useAppStore();
  const [inconsistencies, setInconsistencies] = useState<InconsistencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchInconsistencies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);

    try {
      const res = await fetch(`/api/inconsistencies?${params}`);
      const data = await res.json();
      setInconsistencies(data.inconsistencies || []);
    } catch {
      setInconsistencies([]);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchInconsistencies();
  }, [fetchInconsistencies, refreshTrigger]);

  const uniqueTypes = [...new Set(inconsistencies.map((i) => i.type))];

  const filteredInconsistencies = filterType
    ? inconsistencies.filter((i) => i.type === filterType)
    : inconsistencies;

  // Count by type
  const countsByType = inconsistencies.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card className="gap-0 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType(null)}>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Total de Alertas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inconsistencies.length}</p>
            {!filterType && <p className="text-xs text-blue-500 mt-1">Filtrando: Todos</p>}
          </CardContent>
        </Card>
        {uniqueTypes.map((type) => {
          const config = typeConfig[type] || { label: type, icon: AlertTriangle, color: 'text-gray-600', bgColor: 'bg-gray-50' };
          const Icon = config.icon;
          return (
            <Card
              key={type}
              className={`gap-0 cursor-pointer hover:shadow-md transition-shadow ${filterType === type ? 'ring-2 ring-blue-400' : ''}`}
              onClick={() => setFilterType(filterType === type ? null : type)}
            >
              <CardHeader className="pb-1">
                <CardDescription className="text-xs flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {config.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{countsByType[type] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* List */}
      <Card className="gap-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {filterType
                  ? `${typeConfig[filterType]?.label || filterType} (${filteredInconsistencies.length})`
                  : `Todas as Inconsistências (${filteredInconsistencies.length})`}
              </CardTitle>
              <CardDescription>
                Problemas detectados durante o processamento dos PDFs
              </CardDescription>
            </div>
            {filterType && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setFilterType(null)}
              >
                Limpar filtro
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredInconsistencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma inconsistência encontrada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Os dados processados estão consistentes
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {filteredInconsistencies.map((inc) => {
                const config = typeConfig[inc.type] || { label: inc.type, icon: AlertTriangle, color: 'text-gray-600', bgColor: 'bg-gray-50' };
                const Icon = config.icon;
                return (
                  <div
                    key={inc.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} border-border`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inc.message}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {inc.student && (
                          <span className="text-xs text-muted-foreground">
                            Aluno: {inc.student.name}
                          </span>
                        )}
                        {inc.upload && (
                          <span className="text-xs text-muted-foreground">
                            Arquivo: {inc.upload.originalName}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(inc.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
