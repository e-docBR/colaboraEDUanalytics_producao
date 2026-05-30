'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Upload,
  Users,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  BarChart3,
  GitCompareArrows,
  Trophy,
  BookOpen,
  Grid3X3,
  UserCircle,
  FileDown,
  School,
  Building2,
  Settings,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore, type ActiveView } from '@/store/useAppStore';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';

interface NavItemBase {
  id?: ActiveView;
  label: string;
  icon: React.ElementType;
}

interface NavItemSingle extends NavItemBase {
  id: ActiveView;
  children?: undefined;
}

interface NavItemWithChildren extends NavItemBase {
  id?: undefined;
  children: Array<{
    id: ActiveView;
    label: string;
    icon: React.ElementType;
  }>;
}

type NavItem = NavItemSingle | NavItemWithChildren;

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'uploads', label: 'Uploads', icon: Upload },
  { id: 'students', label: 'Alunos', icon: Users },
  {
    label: 'Relatórios',
    icon: FileText,
    children: [
      { id: 'reports', label: 'Por Turma', icon: BarChart3 },
      { id: 'comparison', label: 'Comparativo', icon: GitCompareArrows },
      { id: 'ranking', label: 'Ranking', icon: Trophy },
      { id: 'performance', label: 'Por Disciplina', icon: BookOpen },
      { id: 'heatmap', label: 'Mapa de Calor', icon: Grid3X3 },
      { id: 'low-grades', label: 'Abaixo da Média', icon: TrendingDown },
      { id: 'pdf-export', label: 'Exportar PDF', icon: FileDown },
    ],
  },
  {
    label: 'Perfis',
    icon: UserCircle,
    children: [
      { id: 'student-profile', label: 'Perfil do Aluno', icon: UserCircle },
      { id: 'class-profile', label: 'Perfil da Turma', icon: School },
      { id: 'school-profile', label: 'Perfil da Escola', icon: Building2 },
    ],
  },
  { id: 'inconsistencies', label: 'Inconsistências', icon: AlertTriangle },
];

const adminItems: NavItem[] = [
  {
    label: 'Administração',
    icon: Settings,
    children: [
      { id: 'school-management', label: 'Gestão de Escolas', icon: Building2 },
      { id: 'user-management', label: 'Gestão de Usuários', icon: Shield },
    ],
  },
];

function useMenuState(menuLabel: string, activeView: ActiveView, items: NavItemWithChildren[]) {
  const item = items.find((i) => i.label === menuLabel);
  const shouldOpen = item?.children?.some((c) => c.id === activeView) ?? false;
  const [open, setOpen] = useState(shouldOpen);

  useEffect(() => {
    if (shouldOpen && !open) setOpen(true);
  }, [shouldOpen, open]);

  return [open, setOpen] as const;
}

export function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, setSidebarOpen, reportsMenuOpen, setReportsMenuOpen, currentUser } = useAppStore();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const profilesMenuItems = navItems.filter((i) => i.label === 'Perfis') as NavItemWithChildren[];
  const [profilesOpen, setProfilesOpen] = useMenuState('Perfis', activeView, profilesMenuItems);

  useEffect(() => {
    if (['reports', 'low-grades', 'comparison', 'ranking', 'performance', 'heatmap', 'pdf-export'].includes(activeView)) {
      if (!reportsMenuOpen) setReportsMenuOpen(true);
    }
  }, [activeView, reportsMenuOpen, setReportsMenuOpen]);

  const adminMenuItems = adminItems.filter((i) => i.label === 'Administração') as NavItemWithChildren[];
  const [adminOpen, setAdminOpen] = useMenuState('Administração', activeView, adminMenuItems);

  const getIsLocalOpen = (item: NavItem) => {
    if (item.label === 'Relatórios') return reportsMenuOpen;
    if (item.label === 'Perfis') return profilesOpen;
    if (item.label === 'Administração') return adminOpen;
    return false;
  };

  const toggleLocalOpen = (item: NavItem) => {
    if (item.label === 'Relatórios') return setReportsMenuOpen(!reportsMenuOpen);
    if (item.label === 'Perfis') return setProfilesOpen(!profilesOpen);
    if (item.label === 'Administração') return setAdminOpen(!adminOpen);
  };

  const allItems = isSuperAdmin ? [...navItems, ...adminItems] : navItems;

  const handleNavClick = (item: NavItem) => {
    if ('children' in item && item.children) {
      toggleLocalOpen(item);
      return;
    }
    if (item.id) {
      setActiveView(item.id);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    }
  };

  const handleChildClick = (id: ActiveView) => {
    setActiveView(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const isActiveParent = (item: NavItem) => {
    if ('children' in item && item.children) {
      return item.children.some((child) => activeView === child.id);
    }
    return false;
  };

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 z-50 h-full bg-white border-r border-border flex flex-col transition-all duration-300 max-lg:shadow-xl',
        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 w-64 lg:w-16'
      )}>
        <div className={cn('flex items-center h-16 border-b border-border', sidebarOpen ? 'px-3' : 'justify-center px-2')}>
          {sidebarOpen ? (
            <img
              src="/brand/logo-horizontal.svg"
              alt="colaboraEDU Analytics"
              className="h-11 w-full object-contain object-left"
            />
          ) : (
            <img
              src="/brand/logo-symbol.svg"
              alt="colaboraEDU Analytics"
              className="size-9 flex-shrink-0"
            />
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {allItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = 'children' in item && item.children;
            const isParentActive = isActiveParent(item);
            const isDirectActive = !hasChildren && item.id === activeView;
            const isLocalOpen = getIsLocalOpen(item);

            if (sidebarOpen) {
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(item)}
                    aria-expanded={hasChildren ? isLocalOpen : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isDirectActive ? 'bg-blue-50 text-blue-700 border border-blue-200' : isParentActive ? 'bg-blue-50/60 text-blue-700 border border-blue-100' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('w-5 h-5 flex-shrink-0', (isDirectActive || isParentActive) && 'text-blue-600')} />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {hasChildren && <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform duration-200', isLocalOpen && 'rotate-180')} />}
                  </button>
                  {hasChildren && isLocalOpen && (
                    <div className={cn('ml-4 mt-1 space-y-1 border-l-2 pl-3', item.label === 'Administração' ? 'border-orange-100' : 'border-blue-100')}>
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeView === child.id;
                        const colorClass = item.label === 'Administração' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
                        return (
                          <button key={child.id} type="button" onClick={() => handleChildClick(child.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200', isChildActive ? `${colorClass} font-medium` : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                            <ChildIcon className={cn('w-4 h-4 flex-shrink-0', isChildActive && (item.label === 'Administração' ? 'text-orange-600' : 'text-blue-600'))} />
                            <span className="truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Collapsed
            if (hasChildren) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => toggleLocalOpen(item)} aria-label={item.label} aria-expanded={isLocalOpen} className={cn('w-full flex items-center justify-center px-3 py-2.5 rounded-lg transition-all duration-200', isParentActive ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                      <Icon className={cn('w-5 h-5', isParentActive && 'text-blue-600')} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => setActiveView(item.id!)} aria-label={item.label} className={cn('w-full flex items-center justify-center px-3 py-2.5 rounded-lg transition-all duration-200', isDirectActive ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    <Icon className={cn('w-5 h-5', isDirectActive && 'text-blue-600')} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <Separator />

        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}>
            {sidebarOpen ? (<><ChevronLeft className="w-4 h-4 mr-2" /><span className="text-xs">Recolher</span></>) : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </aside>
    </>
  );
}
