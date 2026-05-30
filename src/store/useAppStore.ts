import { create } from 'zustand';

export type ActiveView =
  | 'dashboard'
  | 'uploads'
  | 'students'
  | 'reports'
  | 'low-grades'
  | 'comparison'
  | 'ranking'
  | 'performance'
  | 'inconsistencies'
  | 'heatmap'
  | 'student-profile'
  | 'pdf-export'
  | 'class-profile'
  | 'school-profile'
  | 'school-management'
  | 'user-management';

interface AppState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedSchoolId: string | null;
  setSelectedSchoolId: (id: string | null) => void;
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
  selectedShift: string | null;
  setSelectedShift: (shift: string | null) => void;
  selectedResult: string | null;
  setSelectedResult: (result: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  reportsMenuOpen: boolean;
  setReportsMenuOpen: (open: boolean) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  // Modal state
  studentModalOpen: boolean;
  setStudentModalOpen: (open: boolean) => void;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  openStudentProfile: (studentId: string) => void;
  // Current user
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    schools: Array<{ id: string; name: string; role: string }>;
  } | null;
  setCurrentUser: (user: AppState['currentUser']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
  selectedSchoolId: null,
  setSelectedSchoolId: (id) => set({ selectedSchoolId: id }),
  selectedClassId: null,
  setSelectedClassId: (id) => set({ selectedClassId: id }),
  selectedShift: null,
  setSelectedShift: (shift) => set({ selectedShift: shift }),
  selectedResult: null,
  setSelectedResult: (result) => set({ selectedResult: result }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  reportsMenuOpen: false,
  setReportsMenuOpen: (open) => set({ reportsMenuOpen: open }),
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
  studentModalOpen: false,
  setStudentModalOpen: (open) => set({ studentModalOpen: open }),
  selectedStudentId: null,
  setSelectedStudentId: (id) => set({ selectedStudentId: id }),
  openStudentProfile: (studentId) => set({ studentModalOpen: true, selectedStudentId: studentId }),
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
}));
