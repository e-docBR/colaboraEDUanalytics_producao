'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, RefreshCw, LogOut, User as UserIcon, Shield, ShieldCheck, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const viewLabels: Record<string, string> = {
  dashboard: 'Painel Geral',
  uploads: 'Gerenciar Uploads',
  students: 'Gestão de Alunos',
  'low-grades': 'Alunos Abaixo da Média',
  reports: 'Relatórios por Turma',
  comparison: 'Comparativo entre Turmas',
  ranking: 'Ranking Geral de Alunos',
  performance: 'Análise por Disciplina',
  heatmap: 'Mapa de Calor de Notas',
  'student-profile': 'Perfil do Aluno',
  inconsistencies: 'Inconsistências',
  'pdf-export': 'Exportar PDF',
  'class-profile': 'Perfil da Turma',
  'school-profile': 'Perfil da Escola',
  'school-management': 'Gestão de Escolas',
  'user-management': 'Gestão de Usuários',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  DIRECAO: 'Direção',
  COORDINATOR: 'Coordenador',
  ADVISOR: 'Orientador',
  MANAGER: 'Gerente',
  TEACHER: 'Professor',
  VIEWER: 'Visualizador',
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  DIRECAO: 'bg-blue-100 text-blue-700 border-blue-200',
  COORDINATOR: 'bg-amber-100 text-amber-700 border-amber-200',
  ADVISOR: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
  TEACHER: 'bg-blue-100 text-blue-700 border-blue-200',
  VIEWER: 'bg-gray-100 text-gray-600 border-gray-200',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Header() {
  const router = useRouter();
  const { activeView, setSidebarOpen, triggerRefresh, currentUser, setCurrentUser } = useAppStore();
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
        } else {
          // No valid session - redirect to login
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    }
    fetchUser();
  }, [setCurrentUser, router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      router.push('/login');
    } catch {
      // Even if the API call fails, redirect to login
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 border-b border-border bg-white/95 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {viewLabels[activeView] || 'Dashboard'}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={triggerRefresh}
          className="gap-2"
          aria-label="Atualizar dados"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>

        {/* User Menu */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 pl-2 pr-3"
                aria-label="Abrir menu do usuário"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline max-w-[120px] truncate text-sm">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  <span className={`inline-flex items-center gap-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-medium mt-1 ${roleColors[currentUser.role] || roleColors.VIEWER}`}>
                    {currentUser.role === 'SUPER_ADMIN' && <ShieldCheck className="w-3 h-3" />}
                    {currentUser.role !== 'SUPER_ADMIN' && currentUser.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                    {roleLabels[currentUser.role] || currentUser.role}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {currentUser.schools && currentUser.schools.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Escolas vinculadas ({currentUser.schools.length})
                  </DropdownMenuLabel>
                  {currentUser.schools.slice(0, 3).map((school) => (
                    <DropdownMenuItem key={school.id} disabled className="text-xs">
                      <UserIcon className="w-3 h-3 mr-2 text-muted-foreground" />
                      <span className="truncate">{school.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{school.role}</span>
                    </DropdownMenuItem>
                  ))}
                  {currentUser.schools.length > 3 && (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      +{currentUser.schools.length - 3} mais...
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loggingOut ? 'Saindo...' : 'Sair do sistema'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
