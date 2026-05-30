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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  MapPin,
  Phone,
  Mail,
  Search,
  Users,
  GraduationCap,
  Image as ImageIcon,
  X,
  Save,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

interface SchoolItem {
  id: string;
  name: string;
  inep: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  principal: string | null;
  createdAt: string;
  _count: { classes: number; students: number; uploads: number };
}

interface SchoolFormData {
  name: string;
  inep: string;
  city: string;
  state: string;
  address: string;
  cnpj: string;
  phone: string;
  email: string;
  logoUrl: string;
  principal: string;
}

const emptyForm: SchoolFormData = {
  name: '',
  inep: '',
  city: '',
  state: '',
  address: '',
  cnpj: '',
  phone: '',
  email: '',
  logoUrl: '',
  principal: '',
};

const STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

export function SchoolManagementView() {
  const { triggerRefresh } = useAppStore();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [form, setForm] = useState<SchoolFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState<SchoolItem | null>(null);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schools');
      const data = await res.json();
      setSchools(data.schools || []);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  const filtered = schools.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.state && s.state.toLowerCase().includes(q)) ||
      (s.inep && s.inep.includes(q));
  });

  const openCreate = () => {
    setEditingSchool(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (school: SchoolItem) => {
    setEditingSchool(school);
    setForm({
      name: school.name,
      inep: school.inep || '',
      city: school.city || '',
      state: school.state || '',
      address: school.address || '',
      cnpj: school.cnpj || '',
      phone: school.phone || '',
      email: school.email || '',
      logoUrl: school.logoUrl || '',
      principal: school.principal || '',
    });
    setDialogOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo inválido. Use JPG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2MB.');
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/upload-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, logoUrl: data.logoUrl }));
        toast.success('Logo enviado com sucesso');
      } else {
        toast.error(data.error || 'Erro ao enviar logo');
      }
    } catch {
      toast.error('Erro ao enviar logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da escola é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingSchool) {
        const res = await fetch(`/api/schools/${editingSchool.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Escola atualizada com sucesso');
          setDialogOpen(false);
          fetchSchools();
          triggerRefresh();
        } else {
          toast.error(data.error || 'Erro ao atualizar');
        }
      } else {
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Escola criada com sucesso');
          setDialogOpen(false);
          fetchSchools();
          triggerRefresh();
        } else {
          toast.error(data.error || 'Erro ao criar');
        }
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchool) return;
    try {
      const res = await fetch(`/api/schools/${deletingSchool.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Escola excluída com sucesso');
        setDeleteDialogOpen(false);
        setDeletingSchool(null);
        fetchSchools();
        triggerRefresh();
      } else {
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Escolas</h2>
            <p className="text-sm text-muted-foreground">
              {schools.length} escola(s) cadastrada(s) · Cadastre, edite e gerencie
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar escola..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Escola
          </Button>
        </div>
      </div>

      {/* Schools Table */}
      <Card className="gap-0">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Nenhuma escola encontrada' : 'Nenhuma escola cadastrada'}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Cadastrar Escola
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Logo</TableHead>
                    <TableHead>Escola</TableHead>
                    <TableHead className="hidden md:table-cell">Localização</TableHead>
                    <TableHead className="hidden lg:table-cell">INEP</TableHead>
                    <TableHead className="hidden lg:table-cell">Diretor</TableHead>
                    <TableHead className="text-center">Turmas</TableHead>
                    <TableHead className="text-center">Alunos</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((school) => (
                    <TableRow key={school.id} className="hover:bg-muted/30">
                      <TableCell>
                        {school.logoUrl ? (
                          <img src={school.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                            {school.name.charAt(0)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{school.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {school.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />{school.phone}
                              </span>
                            )}
                            {school.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Mail className="w-2.5 h-2.5" />{school.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {school.city || '-'}
                        {school.state && <span className="text-muted-foreground"> - {school.state}</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{school.inep || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{school.principal || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">{school._count.classes}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-blue-600 bg-blue-50 text-xs">{school._count.students}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(school)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => { setDeletingSchool(school); setDeleteDialogOpen(true); }} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">{editingSchool ? 'Editar Escola' : 'Nova Escola'}</DialogTitle>
          <DialogDescription className="sr-only">Formulário de dados da escola</DialogDescription>

          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{editingSchool ? 'Editar Escola' : 'Nova Escola'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {editingSchool ? 'Atualize os dados da escola' : 'Preencha os dados da nova escola'}
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="flex items-center gap-4">
              {form.logoUrl ? (
                <div className="relative">
                  <img src={form.logoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-purple-200" />
                  <button
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                    onClick={() => setForm((p) => ({ ...p, logoUrl: '' }))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1">
                <Label className="text-sm font-medium">Logo da Escola</Label>
                <p className="text-xs text-muted-foreground mb-2">JPG, PNG, WebP ou GIF (máx. 2MB)</p>
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="text-xs"
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Skeleton className="h-full w-full" /></div>}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome da Escola *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Escola Municipal João da Silva" />
              </div>

              <div>
                <Label htmlFor="inep">INEP</Label>
                <Input id="inep" value={form.inep} onChange={(e) => setForm((p) => ({ ...p, inep: e.target.value }))} placeholder="Código INEP" />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>

              <div>
                <Label htmlFor="principal">Diretor(a)</Label>
                <Input id="principal" value={form.principal} onChange={(e) => setForm((p) => ({ ...p, principal: e.target.value }))} placeholder="Nome do(a) diretor(a)" />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contato@escola.com" />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Select value={form.state} onValueChange={(v) => setForm((p) => ({ ...p, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Nome da cidade" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Rua, número, bairro" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : editingSchool ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle className="sr-only">Confirmar exclusão</DialogTitle>
          <DialogDescription className="sr-only">Confirmação de exclusão da escola</DialogDescription>
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Excluir Escola</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Tem certeza que deseja excluir <strong>{deletingSchool?.name}</strong>?
              <br />Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
