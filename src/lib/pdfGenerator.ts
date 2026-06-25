import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFReportOptions {
  schoolId?: string;
  classId?: string;
  shift?: string;
  result?: string;
  title?: string;
  includeKPIs: boolean;
  includeStudentTable: boolean;
  includeCharts: boolean;
  includeSubjectAnalysis: boolean;
  includeLowGrades: boolean;
}

// --- Types for fetched data ---

interface KPIData {
  totalStudents: number;
  approvedCount: number;
  failedCount: number;
  approvalRate: number;
  failureRate: number;
  overallAverage: number;
  totalZeros: number;
  criticalSubjects: Array<{ subject: string; average: number; count: number; zeroCount: number }>;
}

interface ClassData {
  id: string;
  grade: string;
  name: string;
  shift: string;
  school: { id: string; name: string };
  _count: { students: number };
}

interface ClassReportData {
  class: { id: string; grade: string; name: string; shift: string; year: number; minimumAverage: number };
  school: { id: string; name: string; city: string; state: string };
  statistics: {
    totalStudents: number;
    approvedCount: number;
    failedCount: number;
    approvalRate: number;
    failureRate: number;
    overallAverage: number;
    zeroCount: number;
  };
  subjectAverages: Array<{ subjectId: string; subject: string; average: number; count: number; zeroCount: number }>;
  students: Array<{
    id: string;
    name: string;
    finalResult: string;
    average: number;
    grades: Record<string, number>;
  }>;
}

interface RankingStudent {
  studentId: string;
  name: string;
  className: string;
  shift: string;
  finalResult: string;
  average: number;
  position: number;
  grades: Record<string, number>;
}

interface SubjectPerformance {
  subject: string;
  count: number;
  average: number;
  median: number;
  min: number;
  max: number;
  zeros: number;
  below10: number;
  above20: number;
  passRate: number;
}

interface LowGradeStudent {
  studentName: string;
  className: string;
  shift: string;
  schoolName: string;
  finalResult: string;
  lowGradeCount: number;
  totalGrades: number;
  average: number;
  lowGradeSubjects: Array<{ subject: string; score: number }>;
}

interface LowGradesData {
  threshold: number;
  totalLowGrades: number;
  zeroGradeCount: number;
  affectedStudents: number;
  affectedPercentage: number;
  students: LowGradeStudent[];
  subjectAnalysis: Array<{
    subject: string;
    lowCount: number;
    zeroCount: number;
    totalCount: number;
    percentage: number;
    avgLowScore: number;
  }>;
}

// --- Color palette ---
const COLORS = {
  primary: [37, 99, 235] as [number, number, number],      // blue-700
  primaryLight: [59, 130, 246] as [number, number, number], // blue-600
  headerBg: [7, 22, 47] as [number, number, number],
  headerText: [255, 255, 255] as [number, number, number],
  approved: [22, 163, 74] as [number, number, number],     // green
  failed: [220, 38, 38] as [number, number, number],         // red
  warning: [234, 88, 12] as [number, number, number],        // orange
  dark: [17, 24, 39] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  lightBg: [243, 244, 246] as [number, number, number],     // gray-100
  white: [255, 255, 255] as [number, number, number],
};

// --- Utility functions ---
function getScoreColor(score: number): [number, number, number] {
  if (score < 10) return COLORS.failed;
  if (score < 15) return COLORS.warning;
  return COLORS.approved;
}

function getResultColor(result: string): [number, number, number] {
  if (result === 'REPROVADO') return COLORS.failed;
  return COLORS.approved;
}

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Main generation function ---
export async function generateReportPDF(options: PDFReportOptions): Promise<void> {
  const {
    schoolId,
    classId,
    shift,
    result,
    title,
    includeKPIs,
    includeStudentTable,
    includeCharts,
    includeSubjectAnalysis,
    includeLowGrades,
  } = options;

  // Build query params
  const params = new URLSearchParams();
  if (schoolId) params.set('schoolId', schoolId);
  if (classId) params.set('classId', classId);
  if (shift) params.set('shift', shift);
  if (result) params.set('result', result);
  const qs = params.toString();

  // Fetch data from existing APIs
  const fetchJSON = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ao buscar dados de ${url}`);
    return res.json();
  };

  // Fetch all needed data in parallel
  const [summaryData, classesData, performanceData, lowGradesData] = await Promise.all([
    includeKPIs ? fetchJSON(`/api/dashboard/summary?${qs}`).catch(() => null) : Promise.resolve(null),
    fetchJSON(`/api/classes?${qs}`).catch(() => ({ classes: [] })),
    includeSubjectAnalysis ? fetchJSON(`/api/reports/performance?${qs}`).catch(() => null) : Promise.resolve(null),
    includeLowGrades ? fetchJSON(`/api/dashboard/low-grades?${qs}`).catch(() => null) : Promise.resolve(null),
  ]);

  // Fetch class reports for student table
  let classReports: ClassReportData[] = [];
  let allStudents: RankingStudent[] = [];
  let schoolName = '';
  let className = '';

  if (includeStudentTable) {
    const classes: ClassData[] = classesData?.classes || [];

    // Determine school name from first class
    if (classes.length > 0 && !schoolName) {
      schoolName = classes[0].school?.name || '';
    }

    // Fetch class reports in parallel (max 5 at a time to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < classes.length; i += batchSize) {
      const batch = classes.slice(i, i + batchSize);
      const reports = await Promise.all(
        batch.map((c) => fetchJSON(`/api/reports/class/${c.id}?${qs}`).catch(() => null))
      );
      classReports.push(...reports.filter(Boolean));
    }

    // Also get ranking data for all students
    try {
      const rankingData = await fetchJSON(`/api/reports/ranking?${qs}`);
      allStudents = rankingData.ranking || [];
    } catch {
      // fallback to class report students
    }

    // Determine class name
    if (classId) {
      const targetClass = classes.find(c => c.id === classId);
      if (targetClass) className = `${targetClass.grade} ${targetClass.name}`;
    }
  }

  // Collect all unique subjects from class reports
  const subjectNames = new Set<string>();
  classReports.forEach((cr) => {
    cr.subjectAverages.forEach((sa) => subjectNames.add(sa.subject));
  });
  const sortedSubjects = [...subjectNames].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Apply result filter to students
  let filteredStudents = allStudents;
  if (result === 'APROVADO') {
    filteredStudents = allStudents.filter(
      (s) => s.finalResult !== 'REPROVADO'
    );
  } else if (result === 'REPROVADO') {
    filteredStudents = allStudents.filter(
      (s) => s.finalResult === 'REPROVADO'
    );
  }

  // Get school name from summary if available
  if (!schoolName && classesData?.classes?.length > 0) {
    schoolName = classesData.classes[0].school?.name || '';
  }

  // Sort students by name
  filteredStudents.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // --- Create PDF ---
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let yPos = margin;

  // ===== HEADER =====
  // Green header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // School icon area
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin, 5, 18, 18, 3, 3, 'F');
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EDU', margin + 9, 17.5, { align: 'center' });

  // Title text
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName || 'colaboraEDU Analytics', margin + 22, 13);

  // Report title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const reportTitle = title || 'Relatório de Desempenho Escolar';
  const subtitleParts: string[] = [];
  if (className) subtitleParts.push(`Turma: ${className}`);
  if (shift) subtitleParts.push(`Turno: ${shift}`);
  const subtitle = subtitleParts.length > 0 ? `${reportTitle} — ${subtitleParts.join(' | ')}` : reportTitle;
  doc.text(subtitle, margin + 22, 20);

  // Date on the right
  doc.setFontSize(8);
  doc.text(`Gerado em: ${formatDate()}`, pageWidth - margin, 13, { align: 'right' });
  doc.text(`Ano Letivo: ${new Date().getFullYear()}`, pageWidth - margin, 19, { align: 'right' });

  yPos = 34;

  // ===== KPIs SECTION =====
  if (includeKPIs && summaryData) {
    const kpi = summaryData as KPIData;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Indicadores Gerais', margin, yPos);
    yPos += 2;

    // KPI boxes
    const kpiItems = [
      { label: 'Total de Alunos', value: kpi.totalStudents.toString(), color: COLORS.primary },
      { label: 'Taxa de Aprovação', value: `${kpi.approvalRate}%`, color: COLORS.approved },
      { label: 'Média Geral', value: kpi.overallAverage.toString(), color: COLORS.primaryLight },
      { label: 'Notas Zero', value: kpi.totalZeros.toString(), color: kpi.totalZeros > 0 ? COLORS.failed : COLORS.approved },
    ];

    const kpiBoxWidth = (pageWidth - margin * 2 - 12) / 4;
    const kpiBoxHeight = 18;

    kpiItems.forEach((item, i) => {
      const xPos = margin + i * (kpiBoxWidth + 4);

      // Box background
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(xPos, yPos, kpiBoxWidth, kpiBoxHeight, 2, 2, 'F');

      // Value
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, xPos + kpiBoxWidth / 2, yPos + 9, { align: 'center' });

      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, xPos + kpiBoxWidth / 2, yPos + 15, { align: 'center' });
    });

    yPos += kpiBoxHeight + 6;
  }

  // ===== CHARTS DESCRIPTION SECTION =====
  if (includeCharts) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Resumo Visual', margin, yPos);
    yPos += 2;

    // Draw approval vs failure pie chart representation
    const summaryForChart = summaryData as KPIData | null;
    const approvedCount = summaryForChart?.approvedCount || classReports.reduce((a, c) => a + c.statistics.approvedCount, 0);
    const failedCount = summaryForChart?.failedCount || classReports.reduce((a, c) => a + c.statistics.failedCount, 0);
    const total = approvedCount + failedCount;

    if (total > 0) {
      const approvalPct = (approvedCount / total) * 100;
      const failurePct = (failedCount / total) * 100;

      // Draw bar chart
      const barX = margin;
      const barWidth = pageWidth - margin * 2;
      const barHeight = 8;

      doc.setFillColor(...COLORS.failed);
      doc.roundedRect(barX, yPos, barWidth, barHeight, 2, 2, 'F');

      doc.setFillColor(...COLORS.approved);
      const approvedWidth = (approvalPct / 100) * barWidth;
      if (approvedWidth > 4) {
        doc.roundedRect(barX, yPos, approvedWidth, barHeight, 2, 2, 'F');
        // Fix right side if not full width
        if (approvedWidth < barWidth - 4) {
          doc.rect(barX + approvedWidth - 2, yPos, 2, barHeight, 'F');
        }
      }

      doc.setTextColor(...COLORS.white);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      if (approvalPct > 15) {
        doc.text(`Aprovados: ${approvalPct.toFixed(1)}%`, barX + approvedWidth / 2, yPos + 5, { align: 'center' });
      }
      if (failurePct > 15) {
        doc.text(`Reprovados: ${failurePct.toFixed(1)}%`, barX + approvedWidth + (barWidth - approvedWidth) / 2, yPos + 5, { align: 'center' });
      }
      yPos += barHeight + 3;

      // Legend
      doc.setFillColor(...COLORS.approved);
      doc.rect(barX, yPos, 3, 3, 'F');
      doc.setTextColor(...COLORS.muted);
      doc.setFontSize(7);
      doc.text(`Aprovados (${approvedCount})`, barX + 5, yPos + 2.5);

      doc.setFillColor(...COLORS.failed);
      doc.rect(barX + 40, yPos, 3, 3, 'F');
      doc.text(`Reprovados (${failedCount})`, barX + 45, yPos + 2.5);

      yPos += 6;
    }

    // Subject averages bar chart
    const allSubjectAvgs = classReports.length > 0
      ? classReports.flatMap((cr) => cr.subjectAverages)
      : summaryData?.averageBySubject || [];

    if (allSubjectAvgs.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Média por Disciplina', margin, yPos);
      yPos += 2;

      const maxSubjects = Math.min(allSubjectAvgs.length, 12);
      const displaySubjects = allSubjectAvgs.slice(0, maxSubjects);
      const chartWidth = pageWidth - margin * 2;
      const barH = 5;
      const barGap = 2;
      const labelWidth = 50;

      displaySubjects.forEach((sa, i) => {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = margin;
        }

        const subjectLabel = sa.subject.length > 20 ? sa.subject.substring(0, 18) + '...' : sa.subject;
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.muted);
        doc.text(subjectLabel, margin, yPos + 3);

        const maxScore = 40;
        const barPct = Math.min(sa.average / maxScore, 1);
        const barLen = (chartWidth - labelWidth - 20) * barPct;
        const scoreColor = getScoreColor(sa.average);

        // Background bar
        doc.setFillColor(...COLORS.lightBg);
        doc.roundedRect(margin + labelWidth, yPos, chartWidth - labelWidth - 20, barH, 1, 1, 'F');

        // Value bar
        doc.setFillColor(...scoreColor);
        if (barLen > 1) {
          doc.roundedRect(margin + labelWidth, yPos, barLen, barH, 1, 1, 'F');
        }

        // Score text
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...scoreColor);
        doc.text(sa.average.toFixed(1), margin + labelWidth + barLen + 3, yPos + 3);

        yPos += barH + barGap;
      });
      yPos += 4;
    }
  }

  // ===== STUDENT TABLE =====
  if (includeStudentTable && filteredStudents.length > 0) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Quadro de Alunos', margin, yPos);
    yPos += 2;

    const headerRow: string[] = ['#', 'Nome', 'Turma', 'Turno', 'Média', 'Resultado'];
    sortedSubjects.forEach((s) => headerRow.push(s.length > 8 ? s.substring(0, 7) + '.' : s));

    const bodyRows: Array<string[]> = filteredStudents.map((student, idx) => {
      const resultStr = student.finalResult || '-';
      const row: string[] = [
        (idx + 1).toString(),
        student.name.length > 30 ? student.name.substring(0, 28) + '...' : student.name,
        student.className || '-',
        student.shift || '-',
        student.average.toFixed(1),
        resultStr,
      ];
      sortedSubjects.forEach((s) => {
        const score = student.grades?.[s];
        row.push(score !== undefined ? score.toFixed(1) : '-');
      });
      return row;
    });

    autoTable(doc, {
      startY: yPos,
      head: [headerRow],
      body: bodyRows,
      margin: { left: margin, right: margin, bottom: margin },
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: COLORS.headerBg,
        textColor: COLORS.headerText,
        fontStyle: 'bold',
        fontSize: 6,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 45 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 22 },
      },
      didParseCell: (data) => {
        // Color the result column
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val === 'REPROVADO') {
            data.cell.styles.textColor = COLORS.failed;
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('APROVADO')) {
            data.cell.styles.textColor = COLORS.approved;
          }
        }
        // Color the average column
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseFloat(data.cell.raw as string);
          if (!isNaN(val)) {
            data.cell.styles.textColor = getScoreColor(val);
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Color individual score columns
        if (data.section === 'body' && data.column.index > 5) {
          const val = parseFloat(data.cell.raw as string);
          if (!isNaN(val)) {
            data.cell.styles.textColor = getScoreColor(val);
          }
        }
      },
      didDrawPage: (data) => {
        // Footer on each page
        const pageNum = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${data.pageNumber} de ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        doc.text(`Relatório gerado em ${formatDate()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== SUBJECT ANALYSIS =====
  if (includeSubjectAnalysis && performanceData) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Análise por Disciplina', margin, yPos);
    yPos += 2;

    const subjects: SubjectPerformance[] = performanceData.subjects || [];

    const sHeader = ['Disciplina', 'Alunos', 'Média', 'Mediana', 'Mín', 'Máx', 'Zeros', 'Abaixo 10', 'Taxa Aprovação'];
    const sBody = subjects.map((s) => [
      s.subject,
      s.count.toString(),
      s.average.toFixed(1),
      s.median.toFixed(1),
      s.min.toFixed(1),
      s.max.toFixed(1),
      s.zeros.toString(),
      s.below10.toString(),
      `${s.passRate.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [sHeader],
      body: sBody,
      margin: { left: margin, right: margin, bottom: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [31, 41, 55] as [number, number, number],
        textColor: COLORS.headerText,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg,
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'center', cellWidth: 16 },
        7: { halign: 'center', cellWidth: 20 },
        8: { halign: 'center', cellWidth: 25 },
      },
      didParseCell: (data) => {
        // Color pass rate column
        if (data.section === 'body' && data.column.index === 8) {
          const val = parseFloat((data.cell.raw as string).replace('%', ''));
          if (!isNaN(val)) {
            if (val < 50) {
              data.cell.styles.textColor = COLORS.failed;
              data.cell.styles.fontStyle = 'bold';
            } else if (val < 70) {
              data.cell.styles.textColor = COLORS.warning;
            } else {
              data.cell.styles.textColor = COLORS.approved;
            }
          }
        }
        // Color average column
        if (data.section === 'body' && data.column.index === 2) {
          const val = parseFloat(data.cell.raw as string);
          if (!isNaN(val)) {
            data.cell.styles.textColor = getScoreColor(val);
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Color zeros column
        if (data.section === 'body' && data.column.index === 6) {
          const val = parseInt(data.cell.raw as string, 10);
          if (val > 0) {
            data.cell.styles.textColor = COLORS.failed;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        const pageNum = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${data.pageNumber} de ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        doc.text(`Relatório gerado em ${formatDate()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== LOW GRADES SECTION =====
  if (includeLowGrades && lowGradesData) {
    const lg = lowGradesData as LowGradesData;

    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(`Alunos Abaixo da Média (nota < ${lg.threshold})`, margin, yPos);
    yPos += 2;

    // Summary KPIs for low grades
    const lgKpis = [
      { label: 'Alunos Afetados', value: lg.affectedStudents.toString(), pct: `${lg.affectedPercentage}%` },
      { label: 'Notas Abaixo', value: lg.totalLowGrades.toString(), pct: '' },
      { label: 'Notas Zero', value: lg.zeroGradeCount.toString(), pct: '' },
    ];

    const lgBoxWidth = 50;
    const lgBoxHeight = 14;
    lgKpis.forEach((item, i) => {
      const xPos = margin + i * (lgBoxWidth + 4);
      doc.setFillColor(...COLORS.lightBg);
      doc.roundedRect(xPos, yPos, lgBoxWidth, lgBoxHeight, 2, 2, 'F');
      doc.setTextColor(...COLORS.dark);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, xPos + 4, yPos + 6);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.muted);
      doc.text(item.label, xPos + 4, yPos + 11);
      if (item.pct) {
        doc.setTextColor(...COLORS.warning);
        doc.text(item.pct, xPos + lgBoxWidth - 4, yPos + 11, { align: 'right' });
      }
    });

    yPos += lgBoxHeight + 4;

    // Student low grades table
    if (lg.students && lg.students.length > 0) {
      const lgHeader = ['Aluno', 'Turma', 'Turno', 'Média', 'Resultado', 'Notas Baixas', 'Disciplinas'];
      const lgBody = lg.students.slice(0, 100).map((s) => [
        s.studentName.length > 25 ? s.studentName.substring(0, 23) + '...' : s.studentName,
        s.className || '-',
        s.shift || '-',
        s.average.toFixed(1),
        s.finalResult || '-',
        s.lowGradeCount.toString(),
        s.lowGradeSubjects.map((ls) => `${ls.subject}(${ls.score.toFixed(1)})`).join(', ').substring(0, 60),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [lgHeader],
        body: lgBody,
        margin: { left: margin, right: margin, bottom: margin },
        styles: {
          fontSize: 6,
          cellPadding: 1.5,
          lineColor: [229, 231, 235],
          lineWidth: 0.2,
          font: 'helvetica',
        },
        headStyles: {
          fillColor: COLORS.failed,
          textColor: COLORS.headerText,
          fontStyle: 'bold',
          fontSize: 6,
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242] as [number, number, number], // red-50
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'center', cellWidth: 16 },
          3: { halign: 'center', cellWidth: 14 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 18 },
          6: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.raw as string;
            if (val === 'REPROVADO') {
              data.cell.styles.textColor = COLORS.failed;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawPage: (data) => {
          const pageNum = doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.muted);
          doc.setFont('helvetica', 'normal');
          doc.text(`Página ${data.pageNumber} de ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
          doc.text(`Relatório gerado em ${formatDate()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ===== FINAL FOOTER =====
  // Ensure footer on the last page if not already added
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`Relatório gerado em ${formatDate()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text('colaboraEDU Analytics', margin, pageHeight - 6);
  }

  // ===== SAVE =====
  const safeClassName = className ? className.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') : 'geral';
  const fileName = `relatorio_${safeClassName}_${new Date().getFullYear()}.pdf`;
  doc.save(fileName);
}

// ===== DEDICATED LOW GRADES PORTRAIT PDF EXPORTER =====
export async function generateLowGradesOnlyPDF(
  data: {
    threshold: number;
    totalLowGrades: number;
    zeroGradeCount: number;
    affectedStudents: number;
    affectedPercentage: number;
    students: Array<{
      studentName: string;
      className: string;
      shift: string;
      schoolName: string;
      finalResult: string;
      average: number;
      lowGradeCount: number;
      totalGrades: number;
      lowGradeSubjects: Array<{ subject: string; score: number }>;
    }>;
    subjectAnalysis?: Array<{
      subject: string;
      lowCount: number;
      zeroCount: number;
      totalCount: number;
      percentage: number;
      avgLowScore: number;
    }>;
  },
  schoolName: string,
  className: string,
  shift: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  let yPos = margin;

  // ===== HEADER =====
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // White logo symbol
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin, 5, 18, 18, 3, 3, 'F');
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EDU', margin + 9, 17.5, { align: 'center' });

  // School / System Name
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName || 'colaboraEDU Analytics', margin + 22, 13);

  // Subtitle / Filters
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const filterText = [
    className ? `Turma: ${className}` : '',
    shift ? `Turno: ${shift}` : '',
  ].filter(Boolean).join(' | ');
  doc.text(`Relatório: Alunos Abaixo da Média (${filterText || 'Geral'})`, margin + 22, 20);

  // Generation details
  doc.setFontSize(8);
  doc.text(`Gerado em: ${formatDate()}`, pageWidth - margin, 13, { align: 'right' });
  doc.text(`Ano Letivo: ${new Date().getFullYear()}`, pageWidth - margin, 19, { align: 'right' });

  yPos = 34;

  // ===== KPI CARDS =====
  const kpis = [
    { label: 'Notas < 15', value: data.totalLowGrades.toString() },
    { label: 'Alunos Afetados', value: `${data.affectedStudents} (${data.affectedPercentage}%)` },
    { label: 'Notas Zero (0)', value: data.zeroGradeCount.toString() },
  ];

  const boxWidth = 58;
  const boxHeight = 14;
  kpis.forEach((item, i) => {
    const xPos = margin + i * (boxWidth + 4);
    doc.setFillColor(...COLORS.lightBg);
    doc.roundedRect(xPos, yPos, boxWidth, boxHeight, 2, 2, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, xPos + 4, yPos + 6);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, xPos + 4, yPos + 11);
  });

  yPos += boxHeight + 6;

  // ===== TABLE OF STUDENTS =====
  if (data.students && data.students.length > 0) {
    const tableHeader = ['Aluno', 'Média', 'Result.', 'Notas Baixas', 'Disciplinas e Notas'];
    const tableBody = data.students.map((s) => [
      s.studentName,
      s.average.toFixed(1),
      s.finalResult,
      s.lowGradeCount.toString(),
      s.lowGradeSubjects.map((ls) => `${ls.subject} (${ls.score.toFixed(1)})`).join(', '),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [tableHeader],
      body: tableBody,
      margin: { left: margin, right: margin, bottom: margin + 4 },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: COLORS.failed,
        textColor: COLORS.headerText,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [255, 248, 248] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { cellWidth: 'auto' },
      },
      didParseCell: (cellData) => {
        if (cellData.section === 'body') {
          // Highlight Reprovado
          if (cellData.column.index === 2 && cellData.cell.raw === 'REPROVADO') {
            cellData.cell.styles.textColor = COLORS.failed;
            cellData.cell.styles.fontStyle = 'bold';
          }
          // Style averages
          if (cellData.column.index === 1) {
            const val = parseFloat(cellData.cell.raw as string);
            if (!isNaN(val)) {
              cellData.cell.styles.textColor = getScoreColor(val);
              cellData.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      didDrawPage: (pageData) => {
        const pageNum = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${pageData.pageNumber} de ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      },
    });
  }

  // ===== BAR CHART SECTION =====
  let currentY = yPos;
  if (data.students && data.students.length > 0) {
    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  const subjects = data.subjectAnalysis || [];
  if (subjects.length > 0) {
    const chartSectionHeight = 72; // Altura estimada para o título, gráfico, labels do eixo X inclinados e margens
    
    // Se não couber na página atual, adicionamos uma nova página
    if (currentY + chartSectionHeight > pageHeight - margin - 8) {
      doc.addPage();
      currentY = margin + 6; // Começa no topo da nova página
    }

    // 1. Título e subtítulo do gráfico
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text('Notas Abaixo da Média por Disciplina', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Quantidade de alunos com notas < ${data.threshold} em cada disciplina`, margin, currentY + 4);

    // 2. Parâmetros de desenho do gráfico
    const startX = margin + 12;
    const startY = currentY + 12;
    const chartWidth = pageWidth - margin * 2 - 16;
    const chartHeight = 35; // Altura da área de plotagem das barras
    const endY = startY + chartHeight;

    // Calcular escala máxima do eixo Y
    const maxLowCount = subjects.reduce((max, s) => Math.max(max, s.lowCount), 0);
    let yMax = 4;
    if (maxLowCount > 0) {
      yMax = Math.ceil(maxLowCount / 4) * 4;
    }

    // 3. Desenhar Eixo Y, rótulos e linhas de grade (grid)
    const yTicks = 4;
    doc.setLineWidth(0.08);
    
    for (let i = 0; i <= yTicks; i++) {
      const val = (yMax / yTicks) * i;
      const yVal = endY - (chartHeight * (val / yMax));
      
      // Linha de grade (cinza muito claro)
      doc.setDrawColor(220, 224, 230);
      doc.line(startX, yVal, startX + chartWidth, yVal);
      
      // Rótulo do Eixo Y
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text(val.toString(), startX - 3, yVal + 1, { align: 'right' });
    }

    // 4. Desenhar Eixo X (linha base)
    doc.setLineWidth(0.25);
    doc.setDrawColor(100, 110, 120);
    doc.line(startX, endY, startX + chartWidth, endY);

    // 5. Desenhar Barras e Eixo X (Disciplinas)
    const barSpacing = chartWidth / subjects.length;
    const barWidth = Math.min(barSpacing * 0.55, 11);

    subjects.forEach((subj, idx) => {
      const centerX = startX + (idx * barSpacing) + (barSpacing / 2);
      const barHeight = (subj.lowCount / yMax) * chartHeight;
      const xBar = centerX - (barWidth / 2);
      const yBar = endY - barHeight;

      if (subj.lowCount > 0) {
        // Cor de preenchimento (Laranja #f97316)
        doc.setFillColor(249, 115, 22);
        
        // Desenhar a barra com cantos superiores arredondados
        const radius = Math.min(1.5, barHeight);
        if (radius > 0) {
          doc.roundedRect(xBar, yBar, barWidth, barHeight, radius, radius, 'F');
          if (barHeight > radius) {
            doc.rect(xBar, endY - radius, barWidth, radius, 'F');
          }
        } else {
          doc.rect(xBar, yBar, barWidth, barHeight, 'F');
        }

        // Rótulo de dados (Data Label) acima da barra
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(17, 24, 39);
        doc.text(subj.lowCount.toString(), centerX, yBar - 1.2, { align: 'center' });
      }

      // Nome da disciplina no eixo X (rotacionado a 315 graus com alinhamento à esquerda, inclinando para baixo)
      const label = subj.subject.length > 20 ? subj.subject.slice(0, 18) + '...' : subj.subject;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99);
      doc.text(label, centerX, endY + 3, { angle: 315, align: 'left' });
    });
  }

  // ===== FOOTER ON ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`Relatório gerado em ${formatDate()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text('colaboraEDU Analytics', margin, pageHeight - 6);
  }

  // ===== SAVE / DOWNLOAD =====
  const safeClassName = className ? className.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') : 'geral';
  const fileName = `alunos_abaixo_media_${safeClassName}_${new Date().getFullYear()}.pdf`;
  doc.save(fileName);
}
