import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildStudentWhereForUser, jsonError, requireUser } from '@/lib/api-auth';
import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '@/lib/paths';

// --- Color palette ---
const COLORS = {
  primary: [30, 41, 59] as [number, number, number],      // slate-800
  primaryLight: [71, 85, 105] as [number, number, number], // slate-600
  headerBg: [15, 23, 42] as [number, number, number],       // slate-900
  headerText: [255, 255, 255] as [number, number, number],
  approved: [21, 128, 61] as [number, number, number],     // green-700
  failed: [185, 28, 28] as [number, number, number],       // red-700
  emc: [37, 99, 235] as [number, number, number],          // blue-600
  warning: [194, 65, 12] as [number, number, number],      // orange-700
  dark: [15, 23, 42] as [number, number, number],          // slate-900
  muted: [100, 116, 139] as [number, number, number],      // slate-500
  lightBg: [248, 250, 252] as [number, number, number],    // slate-50
  white: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],     // slate-200
};

function getScoreColor(score: number): [number, number, number] {
  if (score < 10) return COLORS.failed;
  if (score < 15) return COLORS.warning;
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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const body = await request.json();
    const {
      schoolId,
      classId,
      shift,
      grade,
      result,
      title,
      includeKPIs,
      includeStudentTable,
      includeCharts,
      includeSubjectAnalysis,
      includeLowGrades,
      schoolLogo,
    } = body;

    // Build student where clause
    const studentWhere: Prisma.StudentWhereInput = await buildStudentWhereForUser(currentUser, { schoolId, classId, grade });
    if (result) studentWhere.finalResult = result;
    if (shift) {
      studentWhere.schoolClass = {
        ...(studentWhere.schoolClass as object),
        shift,
      };
    }

    // Fetch KPI data
    let kpiData: {
      totalStudents: number;
      approvedCount: number;
      failedCount: number;
      emcCount: number;
      approvalRate: number;
      overallAverage: number;
      totalZeros: number;
    } | null = null;

    if (includeKPIs) {
      const totalStudents = await db.student.count({ where: studentWhere });
      const approvedCount = await db.student.count({
        where: { ...studentWhere, finalResult: { in: ['APROVADO', 'APROVADO POR CONSELHO'] } },
      });
      const failedCount = await db.student.count({
        where: { ...studentWhere, finalResult: 'REPROVADO' },
      });
      const emcCount = await db.student.count({
        where: { ...studentWhere, finalResult: 'EMC' },
      });
      const overallAvg = await db.grade.aggregate({
        _avg: { score: true },
        where: { student: studentWhere },
      });
      const totalZeros = await db.grade.count({
        where: { score: 0, student: studentWhere },
      });

      kpiData = {
        totalStudents,
        approvedCount,
        failedCount,
        emcCount,
        approvalRate: totalStudents > 0 ? Math.round((approvedCount / totalStudents) * 10000) / 100 : 0,
        overallAverage: Math.round((overallAvg._avg.score || 0) * 100) / 100,
        totalZeros,
      };
    }

    // Fetch subjects
    const subjects = await db.subject.findMany({ orderBy: { name: 'asc' } });

    // Fetch student table data
    interface StudentRow {
      name: string;
      className: string;
      shift: string;
      finalResult: string;
      average: number;
      grades: Record<string, number>;
    }

    let students: StudentRow[] = [];
    let schoolName = '';
    let className = '';

    if (includeStudentTable) {
      const classInfo = classId
        ? await db.schoolClass.findUnique({ where: { id: classId }, include: { school: true } })
        : null;

      if (classInfo) {
        schoolName = classInfo.school.name;
        className = `${classInfo.grade}`;
      }

      const dbStudents = await db.student.findMany({
        where: studentWhere,
        include: {
          grades: { include: { subject: true } },
          schoolClass: { select: { grade: true, name: true, shift: true } },
          school: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      });

      if (!schoolName && dbStudents.length > 0) {
        schoolName = dbStudents[0].school?.name || '';
      }

      students = dbStudents.map((s) => {
        const grades = s.grades;
        const avg = grades.length > 0
          ? Math.round((grades.reduce((a, b) => a + b.score, 0) / grades.length) * 100) / 100
          : 0;
        const gradesMap: Record<string, number> = {};
        grades.forEach((g) => { gradesMap[g.subject.name] = g.score; });
        return {
          name: s.name,
          className: s.schoolClass ? `${s.schoolClass.grade}` : '-',
          shift: s.schoolClass?.shift || '-',
          finalResult: s.finalResult,
          average: avg,
          grades: gradesMap,
        };
      });
    }

    const sortedSubjects = subjects.map((s) => s.name);

    // Fetch subject analysis
    interface SubjectRow {
      subject: string;
      count: number;
      average: number;
      median: number;
      min: number;
      max: number;
      zeros: number;
      below15: number;
      passRate: number;
    }

    let subjectAnalysis: SubjectRow[] = [];
    if (includeSubjectAnalysis) {
      const grades = await db.grade.findMany({
        where: { student: studentWhere },
        include: { subject: true },
      });

      subjectAnalysis = subjects.map((subject) => {
        const subjectGrades = grades.filter((g) => g.subjectId === subject.id);
        const scores = subjectGrades.map((g) => g.score);
        if (scores.length === 0) {
          return { subject: subject.name, count: 0, average: 0, median: 0, min: 0, max: 0, zeros: 0, below15: 0, passRate: 0 };
        }
        const sorted = [...scores].sort((a, b) => a - b);
        const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
        const median = scores.length % 2 === 0
          ? Math.round(((sorted[scores.length / 2 - 1] + sorted[scores.length / 2]) / 2) * 10) / 10
          : sorted[Math.floor(scores.length / 2)];
        const zeros = scores.filter((s) => s === 0).length;
        const below15 = scores.filter((s) => s > 0 && s < 15).length;
        const passRate = scores.length > 0 ? Math.round(((scores.length - below15 - zeros) / scores.length) * 10000) / 100 : 0;
        return { subject: subject.name, count: scores.length, average: avg, median, min: sorted[0], max: sorted[sorted.length - 1], zeros, below15, passRate };
      });
    }

    // Fetch low grades
    interface LowGradeRow {
      studentName: string;
      className: string;
      shift: string;
      finalResult: string;
      lowGradeCount: number;
      average: number;
      lowGradeSubjects: string;
    }

    let lowGradesData: { threshold: number; affectedStudents: number; totalLowGrades: number; zeroGradeCount: number; students: LowGradeRow[] } | null = null;

    if (includeLowGrades) {
      const threshold = 15;
      const lowGrades = await db.grade.findMany({
        where: { score: { lt: threshold }, student: studentWhere },
        include: {
          student: {
            include: {
              schoolClass: { select: { grade: true, name: true, shift: true } },
            },
          },
          subject: true,
        },
      });

      const studentMap = new Map<string, { name: string; className: string; shift: string; result: string; lowCount: number; subjects: string[] }>();
      for (const g of lowGrades) {
        if (!studentMap.has(g.studentId)) {
          studentMap.set(g.studentId, {
            name: g.student.name,
            className: g.student.schoolClass ? `${g.student.schoolClass.grade}` : '-',
            shift: g.student.schoolClass?.shift || '-',
            result: g.student.finalResult,
            lowCount: 0,
            subjects: [],
          });
        }
        const entry = studentMap.get(g.studentId)!;
        entry.lowCount++;
        entry.subjects.push(`${g.subject.name}(${g.score.toFixed(1)})`);
      }

      const lgStudents = [...studentMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      lowGradesData = {
        threshold,
        affectedStudents: lgStudents.length,
        totalLowGrades: lowGrades.length,
        zeroGradeCount: lowGrades.filter((g) => g.score === 0).length,
        students: lgStudents.map((s) => ({
          studentName: s.name,
          className: s.className,
          shift: s.shift,
          finalResult: s.result,
          lowGradeCount: s.lowCount,
          average: 0,
          lowGradeSubjects: s.subjects.slice(0, 5).join(', '),
        })),
      };
    }

    // ===== BUILD PDF =====
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let yPos = margin;

    // ===== HEADER =====
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Logo or EDU placeholder
    if (schoolLogo) {
      try {
        const ext = schoolLogo.split('.').pop()?.toLowerCase();
        const fmt = ext === 'png' ? 'PNG' : ext === 'webp' ? 'WEBP' : 'JPEG';
        let logoBase64 = '';

        if (!schoolLogo.startsWith('http')) {
          // Local path, try reading directly from filesystem
          let localPath = path.join(getProjectRoot(), schoolLogo);
          if (!fs.existsSync(localPath)) {
            localPath = path.join(getProjectRoot(), 'public', schoolLogo);
          }
          if (fs.existsSync(localPath)) {
            const logoBuffer = fs.readFileSync(localPath);
            logoBase64 = logoBuffer.toString('base64');
          }
        }

        // Fallback or if it's an external url
        if (!logoBase64) {
          const logoUrlStr = schoolLogo.startsWith('http')
            ? schoolLogo
            : `http://localhost:${process.env.PORT || 3000}${schoolLogo}`;
          const logoRes = await fetch(logoUrlStr);
          if (logoRes.ok) {
            const logoBuffer = await logoRes.arrayBuffer();
            logoBase64 = Buffer.from(logoBuffer).toString('base64');
          }
        }

        if (logoBase64) {
          doc.addImage(`data:image/${fmt.toLowerCase()};base64,${logoBase64}`, fmt, margin, 5, 18, 18);
        } else {
          throw new Error('Could not load logo');
        }
      } catch (err) {
        console.error('Error loading school logo in PDF:', err);
        doc.setFillColor(...COLORS.white);
        doc.roundedRect(margin, 5, 18, 18, 3, 3, 'F');
        doc.setTextColor(...COLORS.primary);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('EDU', margin + 9, 17.5, { align: 'center' });
      }
    } else {
      doc.setFillColor(...COLORS.white);
      doc.roundedRect(margin, 5, 18, 18, 3, 3, 'F');
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('EDU', margin + 9, 17.5, { align: 'center' });
    }

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolName || 'colaboraEDU Analytics', margin + 22, 13);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const reportTitle = title || 'Relatório de Desempenho Escolar';
    const subtitleParts: string[] = [];
    if (className) subtitleParts.push(`Turma: ${className}`);
    if (shift) subtitleParts.push(`Turno: ${shift}`);
    const subtitle = subtitleParts.length > 0 ? `${reportTitle} — ${subtitleParts.join(' | ')}` : reportTitle;
    doc.text(subtitle, margin + 22, 20);

    doc.setFontSize(8);
    doc.text(`Gerado em: ${formatDate()}`, pageWidth - margin, 13, { align: 'right' });
    doc.text(`Ano Letivo: ${new Date().getFullYear()}`, pageWidth - margin, 19, { align: 'right' });

    yPos = 34;

    // ===== KPIs =====
    if (includeKPIs && kpiData) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Indicadores Gerais', margin, yPos);
      yPos += 2;

      const kpiItems = [
        { label: 'Total de Alunos', value: kpiData.totalStudents.toString(), color: COLORS.primary },
        { label: 'Taxa de Aprovação', value: `${kpiData.approvalRate}%`, color: COLORS.approved },
        { label: 'EMC (Em Curso)', value: `${kpiData.emcCount}`, color: COLORS.emc },
        { label: 'Notas Zero', value: kpiData.totalZeros.toString(), color: kpiData.totalZeros > 0 ? COLORS.failed : COLORS.approved },
      ];

      const kpiBoxWidth = (pageWidth - margin * 2 - 12) / 4;
      const kpiBoxHeight = 18;

      kpiItems.forEach((item, i) => {
        const xPos = margin + i * (kpiBoxWidth + 4);
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(xPos, yPos, kpiBoxWidth, kpiBoxHeight, 2, 2, 'F');
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, xPos + kpiBoxWidth / 2, yPos + 9, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, xPos + kpiBoxWidth / 2, yPos + 15, { align: 'center' });
      });

      yPos += kpiBoxHeight + 6;
    }

    // ===== CHARTS =====
    if (includeCharts && kpiData) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Resumo Visual', margin, yPos);
      yPos += 2;

      const total = kpiData.approvedCount + kpiData.failedCount + kpiData.emcCount;
      if (total > 0) {
        const approvalPct = (kpiData.approvedCount / total) * 100;
        const emcPct = (kpiData.emcCount / total) * 100;
        const barWidth = pageWidth - margin * 2;
        const barHeight = 8;

        // Background bar
        doc.setFillColor(...COLORS.lightBg);
        doc.roundedRect(margin, yPos, barWidth, barHeight, 2, 2, 'F');

        // EMC portion (blue)
        const emcWidth = (emcPct / 100) * barWidth;
        if (emcWidth > 4) {
          doc.setFillColor(...COLORS.emc);
          doc.roundedRect(margin, yPos, emcWidth, barHeight, 2, 2, 'F');
          if (emcWidth < barWidth - 4) doc.rect(margin + emcWidth - 2, yPos, 2, barHeight, 'F');
        }

        // Approved portion (green)
        const approvedWidth = (approvalPct / 100) * barWidth;
        if (approvedWidth > 4) {
          doc.setFillColor(...COLORS.approved);
          const startX = margin + emcWidth;
          doc.roundedRect(startX, yPos, approvedWidth, barHeight, 2, 2, 'F');
          if (approvedWidth < barWidth - emcWidth - 4) doc.rect(startX + approvedWidth - 2, yPos, 2, barHeight, 'F');
        }

        yPos += barHeight + 4;

        // Legend
        doc.setFillColor(...COLORS.approved);
        doc.rect(margin, yPos, 3, 3, 'F');
        doc.setTextColor(...COLORS.muted);
        doc.setFontSize(7);
        doc.text(`Aprovados (${kpiData.approvedCount})`, margin + 5, yPos + 2.5);
        doc.setFillColor(...COLORS.emc);
        doc.rect(margin + 40, yPos, 3, 3, 'F');
        doc.text(`EMC (${kpiData.emcCount})`, margin + 45, yPos + 2.5);
        doc.setFillColor(...COLORS.failed);
        doc.rect(margin + 75, yPos, 3, 3, 'F');
        doc.text(`Reprovados (${kpiData.failedCount})`, margin + 80, yPos + 2.5);
        yPos += 8;
      }
    }

    // ===== STUDENT TABLE =====
    if (includeStudentTable && students.length > 0) {
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Quadro de Alunos', margin, yPos);
      yPos += 2;

      const headerRow: string[] = ['#', 'Nome', 'Turma', 'Turno', 'Média', 'Resultado'];
      sortedSubjects.forEach((s) => headerRow.push(s.length > 8 ? s.substring(0, 7) + '.' : s));

      const bodyRows = students.map((s, idx) => {
        const row: string[] = [
          (idx + 1).toString(),
          s.name.length > 30 ? s.name.substring(0, 28) + '...' : s.name,
          s.className,
          s.shift,
          s.average.toFixed(1),
          s.finalResult,
        ];
        sortedSubjects.forEach((subj) => {
          const score = s.grades?.[subj];
          row.push(score !== undefined ? score.toFixed(1) : '-');
        });
        return row;
      });

      autoTable(doc, {
        startY: yPos,
        head: [headerRow],
        body: bodyRows,
        margin: { left: margin, right: margin, bottom: margin },
        styles: { fontSize: 6, cellPadding: 1.5, lineColor: [229, 231, 235], lineWidth: 0.2, font: 'helvetica' },
        headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.headerText, fontStyle: 'bold', fontSize: 6, halign: 'center' },
        alternateRowStyles: { fillColor: COLORS.lightBg },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 45 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'center', cellWidth: 22 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const val = data.cell.raw as string;
            if (val === 'REPROVADO') { data.cell.styles.textColor = COLORS.failed; data.cell.styles.fontStyle = 'bold'; }
            else if (val === 'EMC') { data.cell.styles.textColor = COLORS.emc; data.cell.styles.fontStyle = 'bold'; }
            else if (val.includes('APROVADO')) { data.cell.styles.textColor = COLORS.approved; }
          }
          if (data.section === 'body' && data.column.index === 4) {
            const val = parseFloat(data.cell.raw as string);
            if (!isNaN(val)) { data.cell.styles.textColor = getScoreColor(val); data.cell.styles.fontStyle = 'bold'; }
          }
          if (data.section === 'body' && data.column.index > 5) {
            const val = parseFloat(data.cell.raw as string);
            if (!isNaN(val)) data.cell.styles.textColor = getScoreColor(val);
          }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.muted);
          doc.setFont('helvetica', 'normal');
          doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 6;
    }

    // ===== SUBJECT ANALYSIS =====
    if (includeSubjectAnalysis && subjectAnalysis.length > 0) {
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Análise por Disciplina', margin, yPos);
      yPos += 2;

      const sHeader = ['Disciplina', 'Alunos', 'Média', 'Mediana', 'Mín', 'Máx', 'Zeros', 'Abaixo 15', 'Taxa Aprovação'];
      const sBody = subjectAnalysis.map((s) => [
        s.subject, s.count.toString(), s.average.toFixed(1), s.median.toFixed(1),
        s.min.toFixed(1), s.max.toFixed(1), s.zeros.toString(), s.below15.toString(), `${s.passRate.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [sHeader],
        body: sBody,
        margin: { left: margin, right: margin, bottom: margin },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.2, font: 'helvetica' },
        headStyles: { fillColor: [31, 41, 55] as [number, number, number], textColor: COLORS.headerText, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        alternateRowStyles: { fillColor: COLORS.lightBg },
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
          if (data.section === 'body' && data.column.index === 8) {
            const val = parseFloat((data.cell.raw as string).replace('%', ''));
            if (!isNaN(val)) {
              if (val < 50) { data.cell.styles.textColor = COLORS.failed; data.cell.styles.fontStyle = 'bold'; }
              else { data.cell.styles.textColor = COLORS.approved; }
            }
          }
          if (data.section === 'body' && data.column.index === 2) {
            const val = parseFloat(data.cell.raw as string);
            if (!isNaN(val)) { data.cell.styles.textColor = getScoreColor(val); data.cell.styles.fontStyle = 'bold'; }
          }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.muted);
          doc.setFont('helvetica', 'normal');
          doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 6;

      // ===== GRAFICO MEDIA POR DISCIPLINA =====
      const chartSubjects = subjectAnalysis.filter((s) => s.count > 0);
      if (chartSubjects.length > 0) {
        if (yPos > pageHeight - 50) { doc.addPage(); yPos = margin; }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.dark);
        doc.text('Média por Disciplina', margin, yPos);
        yPos += 2;

        const chartWidth = pageWidth - margin * 2;
        const chartHeight = 50; // Total height for the bars in mm
        const maxScore = 40;

        if (yPos + chartHeight + 20 > pageHeight) { 
          doc.addPage(); 
          yPos = margin + 8; 
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.dark);
          doc.text('Média por Disciplina', margin, yPos);
        }

        yPos += 12; // Top margin for labels

        const numBars = chartSubjects.length;
        const barSlotWidth = chartWidth / numBars;
        const barW = Math.min(14, barSlotWidth * 0.7); // Dynamic bar width, max 14mm
        const chartBaseY = yPos + chartHeight;

        chartSubjects.forEach((sa, i) => {
          const centerX = margin + (i * barSlotWidth) + (barSlotWidth / 2);
          const barX = centerX - (barW / 2);

          // Background bar (vertical)
          doc.setFillColor(...COLORS.lightBg);
          doc.roundedRect(barX, yPos, barW, chartHeight, 1, 1, 'F');

          // Value bar (vertical)
          const barPct = Math.min(sa.average / maxScore, 1);
          const barH = chartHeight * barPct;
          const barY = chartBaseY - barH;

          const scoreColor: [number, number, number] =
            sa.average < 10 ? COLORS.failed : sa.average < 15 ? COLORS.warning : COLORS.approved;

          doc.setFillColor(...scoreColor);
          if (barH > 1) {
            doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
          }

          // Value and percentage label (centered above the bar)
          const pct = Math.round((sa.average / maxScore) * 100);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...scoreColor);
          doc.text(`${sa.average.toFixed(1)}`, centerX, barY - 4, { align: 'center' });
          doc.setFontSize(5);
          doc.text(`(${pct}%)`, centerX, barY - 1, { align: 'center' });

          // Subject Label (centered below the bar)
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.muted);

          let label = sa.subject;
          if (label.length > 12) {
            const words = label.split(' ').filter(w => w.length > 2);
            if (words.length > 1) {
              label = words.map(w => w.substring(0, 4)).join('.');
            } else {
              label = label.substring(0, 10) + '.';
            }
          }
          doc.text(label, centerX, chartBaseY + 4, { align: 'center' });
        });

        yPos = chartBaseY + 10;
      }
    }

    // ===== LOW GRADES =====
    if (includeLowGrades && lowGradesData) {
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(`Alunos Abaixo da Média (nota < ${lowGradesData.threshold})`, margin, yPos);
      yPos += 2;

      if (lowGradesData.students.length > 0) {
        const lgHeader = ['Aluno', 'Turma', 'Turno', 'Resultado', 'Notas Baixas', 'Disciplinas'];
        const lgBody = lowGradesData.students.slice(0, 100).map((s) => [
          s.studentName.length > 25 ? s.studentName.substring(0, 23) + '...' : s.studentName,
          s.className, s.shift, s.finalResult, s.lowGradeCount.toString(),
          s.lowGradeSubjects.substring(0, 60),
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [lgHeader],
          body: lgBody,
          margin: { left: margin, right: margin, bottom: margin },
          styles: { fontSize: 6, cellPadding: 1.5, lineColor: COLORS.border, lineWidth: 0.1, font: 'helvetica' },
          headStyles: { fillColor: COLORS.primary, textColor: COLORS.headerText, fontStyle: 'bold', fontSize: 6, halign: 'center' },
          alternateRowStyles: { fillColor: COLORS.lightBg },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { halign: 'center', cellWidth: 22 },
            2: { halign: 'center', cellWidth: 16 },
            3: { halign: 'center', cellWidth: 22 },
            4: { halign: 'center', cellWidth: 18 },
            5: { cellWidth: 'auto' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = data.cell.raw as string;
              if (val === 'REPROVADO') { data.cell.styles.textColor = COLORS.failed; data.cell.styles.fontStyle = 'bold'; }
              else if (val === 'EMC') { data.cell.styles.textColor = COLORS.emc; data.cell.styles.fontStyle = 'bold'; }
            }
          },
          didDrawPage: (data) => {
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            doc.setFont('helvetica', 'normal');
            doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
          },
        });
      }
    }

    // ===== FINAL FOOTER =====
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

    // Return PDF
    const pdfBuffer = doc.output('arraybuffer');
    const safeClassName = className ? className.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') : 'geral';
    const fileName = `relatorio_${safeClassName}_${new Date().getFullYear()}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro ao gerar PDF:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório PDF' },
      { status: 500 }
    );
  }
}
