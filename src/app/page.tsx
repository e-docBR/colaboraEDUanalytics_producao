'use client';

import { useAppStore } from '@/store/useAppStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { FiltersBar } from '@/components/layout/FiltersBar';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { UploadView } from '@/components/uploads/UploadView';
import { StudentsView } from '@/components/students/StudentsView';
import { StudentProfileModal } from '@/components/students/StudentProfileModal';
import { LowGradesView } from '@/components/low-grades/LowGradesView';
import { ReportsView } from '@/components/reports/ReportsView';
import { ComparisonView } from '@/components/reports/comparison/ComparisonView';
import { RankingView } from '@/components/reports/ranking/RankingView';
import { PerformanceView } from '@/components/reports/performance/PerformanceView';
import { InconsistenciesView } from '@/components/inconsistencies/InconsistenciesView';
import { HeatmapView } from '@/components/reports/heatmap/HeatmapView';
import { StudentProfileView } from '@/components/students/StudentProfileView';
import { PdfConfigDialog } from '@/components/reports/pdf/PdfConfigDialog';
import { ClassProfileView } from '@/components/profiles/ClassProfileView';
import { SchoolProfileView } from '@/components/profiles/SchoolProfileView';
import { SchoolManagementView } from '@/components/admin/SchoolManagementView';
import { UserManagementView } from '@/components/admin/UserManagementView';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  const { activeView, sidebarOpen } = useAppStore();

  return (
    <div className="min-h-dvh bg-background">
      <Toaster richColors position="top-right" />
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        <Header />
        <FiltersBar />
        <main>
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'uploads' && <UploadView />}
          {activeView === 'students' && <StudentsView />}
          {activeView === 'reports' && <ReportsView />}
          {activeView === 'comparison' && <ComparisonView />}
          {activeView === 'ranking' && <RankingView />}
          {activeView === 'performance' && <PerformanceView />}
          {activeView === 'low-grades' && <LowGradesView />}
          {activeView === 'heatmap' && <HeatmapView />}
          {activeView === 'student-profile' && <StudentProfileView />}
          {activeView === 'inconsistencies' && <InconsistenciesView />}
          {activeView === 'pdf-export' && <PdfConfigDialog />}
          {activeView === 'class-profile' && <ClassProfileView />}
          {activeView === 'school-profile' && <SchoolProfileView />}
          {activeView === 'school-management' && <SchoolManagementView />}
          {activeView === 'user-management' && <UserManagementView />}
        </main>
      </div>
      <StudentProfileModal />
    </div>
  );
}
