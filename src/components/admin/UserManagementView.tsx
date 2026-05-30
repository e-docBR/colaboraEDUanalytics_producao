'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
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
  UserPlus,
  Pencil,
  Trash2,
  Search,
  Shield,
  Eye,
  GraduationCap,
  BookOpen,
  Building2,
  Users,
  Mail,
  Phone,
  Save,
  X,
  Check,
  Key,
  ClipboardCheck,
  HeartHandshake,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserSchoolLink {
  schoolId: string;
  schoolName: string;
  role: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  schools: UserSchoolLink[];
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  schoolIds: string[];
}

interface SchoolOption {
  id: string;
  name: string;
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'VIEWER',
  phone: '',
  schoolIds: [],
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  DIRECAO: 'Direção',
  COORDINATOR: 'Coordenador',
  ADVISOR: 'Orientador',
  MANAGER: 'Gerente',
  TEACHER: 'Professor',
  VIEWER: 'Observador',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-300',
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-300',
  DIRECAO: 'bg-blue-100 text-blue-700 border-blue-300',
  COORDINATOR: 'bg-amber-100 text-amber-700 border-amber-300',
  ADVISOR: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  MANAGER: 'bg-blue-100 text-blue-700 border-blue-300',
  TEACHER: 'bg-blue-100 text-blue-700 border-blue-300',
  VIEWER: 'bg-gray-100 text-gray-700 border-gray-300',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  SUPER_ADMIN: Shield,
  ADMIN: Shield,
  DIRECAO: Building2,
  COORDINATOR: ClipboardCheck,
  ADVISOR: HeartHandshake,
  MANAGER: Users,
  TEACHER: GraduationCap,
  VIEWER: Eye,
};

export function UserManagementView() {
  const { triggerRefresh } = useAppStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, schoolsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/schools'),
      ]);
      const usersData = await usersRes.json();
      const schoolsData = await schoolsRes.json();
      setUsers(usersData.users || []);
      setSchools((schoolsData.schools || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch {
      setUsers([]);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      schoolIds: user.schools.map((s) => s.schoolId),
    });
    setDialogOpen(true);
  };

  const toggleSchool = (schoolId: string) => {
    setForm((prev) => ({
      ...prev,
      schoolIds: prev.schoolIds.includes(schoolId)
        ? prev.schoolIds.filter((id) => id !== schoolId)
        : [...prev.schoolIds, schoolId],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    if (!editingUser && !form.password) {
      toast.error('Senha é obrigatória para novos usuários');
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: Record<string, unknown> = { ...form };
      if (!form.password) delete body.password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(editingUser ? 'Usuário atualizado' : 'Usuário criado');
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Usuário excluído');
        setDeleteDialogOpen(false);
        setDeletingUser(null);
        fetchData();
      } else {
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const roleIcon = (role: string) => {
    const Icon = ROLE_ICONS[role] || Eye;
    return <Icon className="w-3.5 h-3.5" />;
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
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Usuários</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} usuário(s) · Multi-tenancy com vinculação a escolas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openCreate} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <Card key={role} className="gap-0">
              <CardContent className="pt-3 pb-3 px-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${ROLE_COLORS[role]}`}>{label}</Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card className="gap-0">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}</p>
              {!searchQuery && <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}><UserPlus className="w-4 h-4" />Criar Usuário</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="hidden sm:table-cell">Perfil</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell">Escolas Vinculadas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={`text-xs gap-1 ${ROLE_COLORS[user.role]}`}>
                          {roleIcon(user.role)} {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {user.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span> : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.schools.length > 0 ? (
                            <>
                              {user.schools.slice(0, 2).map((s) => (
                                <Badge key={s.schoolId} variant="outline" className="text-[10px] px-1.5">{s.schoolName}</Badge>
                              ))}
                              {user.schools.length > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5">+{user.schools.length - 2}</Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Nenhuma</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={user.isActive ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50'}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(user)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => { setDeletingUser(user); setDeleteDialogOpen(true); }} title="Excluir">
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
          <DialogTitle className="sr-only">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          <DialogDescription className="sr-only">Formulário de cadastro de usuário</DialogDescription>

          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {editingUser ? 'Atualize os dados do usuário' : 'Preencha os dados do novo usuário'}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div>
                <Label htmlFor="password">{editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="********" className="pl-9" />
                </div>
              </div>
              <div>
                <Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <SelectItem key={role} value={role}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {/* School Linking */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Escolas Vinculadas (Multi-tenancy)</Label>
                <Badge variant="outline" className="text-xs">{form.schoolIds.length} selecionada(s)</Badge>
              </div>
              {schools.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">Nenhuma escola cadastrada. Cadastre escolas primeiro.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                  {schools.map((school) => {
                    const isSelected = form.schoolIds.includes(school.id);
                    return (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => toggleSchool(school.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-border hover:bg-muted'
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <div className="w-4 h-4 border-2 border-muted-foreground/30 rounded-sm flex-shrink-0" />}
                        <span className="truncate">{school.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim()} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : editingUser ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle className="sr-only">Confirmar exclusão</DialogTitle>
          <DialogDescription className="sr-only">Confirmação de exclusão de usuário</DialogDescription>
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Excluir Usuário</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Tem certeza que deseja excluir <strong>{deletingUser?.name}</strong>?
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="w-4 h-4" />Excluir</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
