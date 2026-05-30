'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface UploadRecord {
  id: string;
  filename: string;
  originalName: string;
  status: string;
  errorMessage: string | null;
  schoolId: string | null;
  classId: string | null;
  createdAt: string;
  school: { id: string; name: string } | null;
  schoolClass: { id: string; grade: string; name: string; shift: string } | null;
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Pendente
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processando
        </Badge>
      );
    case 'processed':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Processado
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Erro
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function UploadView() {
  const { refreshTrigger } = useAppStore();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUploads = useCallback(() => {
    setLoading(true);
    fetch('/api/uploads?limit=50')
      .then((r) => r.json())
      .then((data) => {
        setUploads(data.uploads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads, refreshTrigger]);

  const handleFiles = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      toast.error('Selecione apenas arquivos PDF');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    pdfFiles.forEach((f) => formData.append('files', f));

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`${data.uploads.length} arquivo(s) enviado(s) com sucesso`);
        fetchUploads();
        // Auto-process uploaded files
        for (const upload of data.uploads) {
          await processUpload(upload.id);
        }
      } else {
        toast.error(data.error || 'Erro ao enviar arquivos');
      }
    } catch {
      toast.error('Erro ao enviar arquivos');
    } finally {
      setUploading(false);
    }
  };

  const processUpload = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/uploads/${id}/process`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'PDF processado com sucesso');
        if (data.data?.warnings && data.data.warnings > 0) {
          toast.info(`${data.data.warnings} alerta(s) encontrado(s)`);
        }
      } else {
        toast.error(data.error || 'Erro ao processar PDF');
      }
    } catch {
      toast.error('Erro ao processar PDF');
    } finally {
      setProcessingId(null);
      fetchUploads();
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Upload area */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="text-base">Enviar Atas de Resultado</CardTitle>
          <CardDescription>
            Arraste e solte arquivos PDF de atas escolares ou clique para selecionar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-blue-400 bg-blue-50/50'
                : 'border-muted-foreground/25 hover:border-blue-300 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-sm font-medium">Enviando e processando...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-full bg-blue-50">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Clique para selecionar ou arraste arquivos
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas arquivos PDF são aceitos
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload history */}
      <Card className="gap-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Histórico de Uploads</CardTitle>
              <CardDescription>
                {uploads.length} arquivo(s) registrado(s)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUploads}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum upload realizado ainda
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="hidden sm:table-cell">Escola</TableHead>
                    <TableHead className="hidden md:table-cell">Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[200px] text-sm">
                            {upload.originalName}
                          </span>
                        </div>
                        {upload.status === 'error' && upload.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 truncate max-w-[250px]">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            {upload.errorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">
                          {upload.school?.name || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">
                          {upload.schoolClass
                            ? `${upload.schoolClass.grade} ${upload.schoolClass.name} - ${upload.schoolClass.shift}`
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(upload.status)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {new Date(upload.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(upload.status === 'pending' || upload.status === 'error') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => processUpload(upload.id)}
                              disabled={processingId !== null}
                              className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              {processingId === upload.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span className="hidden sm:inline">Processar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
