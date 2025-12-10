import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Download, FileText } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import logo from '../../assets/logo-new.png';

interface ModuleDetail {
    module: string;
    tickets: number;
    hours: number;
    avg_hours: number;
}

interface IssueSummary {
    key: string;
    summary: string;
    status: string;
    priority: string;
    assignee: string;
    type: string;
    hours: number;
}

const AnalisisDetallado: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);
    const [moduleDetails, setModuleDetails] = useState<ModuleDetail[]>([]);
    const [consultantData, setConsultantData] = useState<any[]>([]);
    const [issueSummary, setIssueSummary] = useState<IssueSummary[]>([]);
    const [statusData, setStatusData] = useState<any[]>([]);
    const [priorityData, setPriorityData] = useState<any[]>([]);
    const [typeData, setTypeData] = useState<any[]>([]);
    const [topTicketsData, setTopTicketsData] = useState<any[]>([]);
    const [issuesCalendarData, setIssuesCalendarData] = useState<any[]>([]);
    const [detailsData, setDetailsData] = useState<any[]>([]);
    const [projectContractedHours, setProjectContractedHours] = useState<number>(70);
    const [projectName, setProjectName] = useState('');

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!id) return;
            const { data } = await supabase
                .from('proyectos')
                .select('jira_id, nombre, horas_contratadas')
                .eq('id', id)
                .single();
            if (data) {
                setProjectJiraId((data as any).jira_id);
                setProjectName((data as any).nombre);
                setProjectContractedHours(Number((data as any).horas_contratadas) || 70);
            }
        };
        fetchProjectData();
    }, [id]);

    useEffect(() => {
        const fetchData = async () => {
            if (!projectJiraId || !selectedMonth) return;

            setLoading(true);
            try {
                const monthDate = `${selectedMonth}-01`;

                // Fetch module details
                const { data: moduleResult } = await supabase
                    .from('v_horas_mes_modulo_proyecto')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Fetch consultant data for detailed view
                const { data: consultantResult } = await supabase
                    .from('v_issues_mes_proyecto_asignacion')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Process module data
                const processedModules = moduleResult?.map((d: any) => ({
                    module: d.modulo || d.module || 'Unknown',
                    tickets: Number(d.total_issues) || Number(d.total_tickets) || 0,
                    hours: Number(d.total_horas) || 0,
                    avg_hours: (Number(d.total_horas) || 0) / Math.max(Number(d.total_issues) || Number(d.total_tickets) || 1, 1)
                })) || [];

                setModuleDetails(processedModules);

                // Process consultant data
                const processedConsultants = consultantResult?.map((d: any) => ({
                    name: d.asignado || d.assignee_name || 'Unknown',
                    tickets: Number(d.total_issues) || 0,
                    hours: Number(d.total_horas) || 0,
                    pct_tickets: Number(d.porcentaje_issues) || 0,
                    pct_hours: Number(d.porcentaje_horas) || 0
                })) || [];

                setConsultantData(processedConsultants);

                // Fetch status data for PDF
                const { data: statusResult } = await supabase
                    .from('v_issues_mes_proyecto_estado')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                setStatusData(statusResult || []);

                // Fetch issue summary from issues table manually (fallback for v_issues_resumen)
                const startDate = `${selectedMonth}-01`;

                // Fetch detailed hours (worklogs) first - this determines the issues worked on in this period
                const { data: detailsResult } = await supabase
                    .from('v_horas_totales_detalles')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate)
                    .order('created_at_jira', { ascending: false });

                setDetailsData(detailsResult || []);

                // Create a map of hours per issue and unique keys
                const hoursMap = new Map();
                const uniqueKeys = new Set<string>();

                detailsResult?.forEach((d: any) => {
                    const key = d.clave || d.ticket_key;
                    if (key) {
                        hoursMap.set(key, (hoursMap.get(key) || 0) + (Number(d.horas) || 0));
                        uniqueKeys.add(key);
                    }
                });

                // Fetch metadata ONLY for issues that have worklogs in this period
                let issuesList: any[] = [];
                if (uniqueKeys.size > 0) {
                    const { data } = await supabase
                        .from('issues')
                        .select('*')
                        .in('clave', Array.from(uniqueKeys));
                    issuesList = data || [];
                }

                // Map issues to summary format
                const processedIssues = issuesList?.map((d: any) => ({
                    key: d.clave || d.key || 'N/A',
                    summary: d.resumen || d.summary || 'N/A',
                    status: d.estado || d.status || 'N/A',
                    priority: d.prioridad || d.prioridad || 'N/A',
                    assignee: d.asignado || d.assignee || 'N/A',
                    type: d.tipo || d.issuetype || 'N/A',
                    hours: hoursMap.get(d.clave || d.key) || 0,
                    module: d.modulo || d.componente || 'General' // Try to capture module
                })) || [];

                setIssueSummary(processedIssues);

                // Re-process module details to include ticket counts from issues if possible
                // If v_horas_mes_modulo_proyecto lacks tickets, we calculate from issues list
                const moduleTicketCounts = new Map();
                processedIssues.forEach(issue => {
                    const mod = issue.module || 'Unknown';
                    moduleTicketCounts.set(mod, (moduleTicketCounts.get(mod) || 0) + 1);
                });

                // Update moduleDetails with calculated tickets if original was 0
                const updatedModules = processedModules.map(m => {
                    const calculatedTickets = moduleTicketCounts.get(m.module) || 0;
                    return {
                        ...m,
                        tickets: m.tickets > 0 ? m.tickets : calculatedTickets,
                        // Recalculate avg if tickets changed
                        avg_hours: m.hours / Math.max((m.tickets > 0 ? m.tickets : calculatedTickets), 1)
                    };
                });

                // If the original module result was empty but we have issues, we might want to construct module list from issues
                // But for now, let's just update the existing ones or append? 
                // Let's stick to updating existing ones from the view to be safe, 
                // or if view returned modules, we trust it for hours.
                setModuleDetails(updatedModules);

                // Fetch priority data for PDF Page 2
                const { data: priorityResult } = await supabase
                    .from('v_tickets_mes_proyecto_prioridad_pct')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                setPriorityData(priorityResult || []);

                // Fetch type data for PDF Page 2
                const { data: typeResult } = await supabase
                    .from('v_issues_mes_proyecto_tipo')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                setTypeData(typeResult || []);

                // Fetch top tickets for PDF Page 3
                const { data: topTicketsResult } = await supabase
                    .from('v_horas_totales_por_proyecto_ticket')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate)
                    .order('ticket_horas', { ascending: false })
                    .limit(5);

                setTopTicketsData(topTicketsResult || []);

                // Fetch issues for calendar (PDF Page 3)
                const [year, month] = selectedMonth.split('-').map(Number);
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;


                const { data: calendarIssuesResult } = await supabase
                    .from('issues')
                    .select('clave, fechacreacion')
                    .eq('proyecto', projectJiraId)
                    .gte('fechacreacion', startDate)
                    .lt('fechacreacion', endDate);

                setIssuesCalendarData(calendarIssuesResult || []);

                // setDetailsData already set above


            } catch (error) {
                console.error('Error fetching analysis data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    // Export to Excel
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Issue Summary Sheet
        const issueData = issueSummary.map(issue => ({
            'Key': issue.key,
            'Resumen': issue.summary,
            'Estado': issue.status,
            'Prioridad': issue.priority,
            'Asignado': issue.assignee,
            'Tipo': issue.type,
            'Horas': issue.hours.toFixed(2)
        }));
        const ws1 = XLSX.utils.json_to_sheet(issueData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen de Issues');

        // Module Breakdown Sheet
        const moduleData = moduleDetails.map(module => ({
            'Módulo': module.module,
            'Tickets': module.tickets,
            'Horas Totales': module.hours.toFixed(2),
            'Promedio h/Ticket': module.avg_hours.toFixed(2)
        }));
        const ws2 = XLSX.utils.json_to_sheet(moduleData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Desglose por Módulo');

        // Consultant Details Sheet
        const consultantExcelData = consultantData.map(c => ({
            'Consultor': c.name,
            'Tickets': c.tickets,
            '% Tickets': c.pct_tickets.toFixed(1),
            'Horas': c.hours.toFixed(2),
            '% Horas': c.pct_hours.toFixed(1),
            'Promedio h/t': (c.tickets > 0 ? (c.hours / c.tickets).toFixed(2) : '0.00')
        }));
        const ws3 = XLSX.utils.json_to_sheet(consultantExcelData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Desglose por Consultor');

        // Save file
        const fileName = `${projectName}_${selectedMonth}_Analisis_Detallado.xlsx`;
        XLSX.writeFile(wb, fileName);
    };


    // Export to PDF - Professional format
    const exportToPDF = async () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const primaryColor = [52, 152, 219]; // Blue
        const secondaryColor = [52, 73, 94]; // Dark Slate

        // Helper: Load Image
        const loadImage = (src: string): Promise<{ data: string; width: number; height: number }> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve({
                            data: canvas.toDataURL('image/png'),
                            width: img.width,
                            height: img.height
                        });
                    } else {
                        reject(new Error('Could not get canvas context'));
                    }
                };
                img.onerror = reject;
            });
        };

        let logoData: { data: string; width: number; height: number } | null = null;
        try {
            logoData = await loadImage(logo);
        } catch (error) {
            console.warn('Could not load logo for PDF:', error);
        }

        // Helper: Header
        const addHeader = (title: string) => {
            // Brand Bar
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 0, pageWidth, 30, 'F');

            let titleXOffset = margin;

            // Add Logo to header
            if (logoData) {
                try {
                    const maxHeight = 12;
                    const ratio = logoData.width / logoData.height;
                    const logoHeight = maxHeight;
                    const logoWidth = maxHeight * ratio;
                    const logoX = margin;
                    const logoY = 9;

                    doc.addImage(logoData.data, 'PNG', logoX, logoY, logoWidth, logoHeight);
                    titleXOffset += logoWidth + 10;
                } catch (error) {
                    console.warn('Could not add logo to PDF:', error);
                }
            }

            // Title
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text(title, titleXOffset, 20);

            // Meta
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`${projectName} | ${selectedMonth}`, pageWidth - margin, 20, { align: 'right' });
        };

        // Helper: Footer
        const addFooter = (pageNumber: number) => {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("GPARTNER CONSULTING - Informe de Gestión", margin, pageHeight - 10);
            doc.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        };

        // --- PAGE 1: RESUMEN EJECUTIVO ---
        addHeader("Resumen Ejecutivo");
        let yPos = 40;

        // KPIs
        const kpiGap = 15;
        const kpiWidth = (pageWidth - (margin * 2) - (kpiGap * 2)) / 3;
        const kpiHeight = 30;

        const totalHours = issueSummary.reduce((sum, i) => sum + i.hours, 0);
        const totalTickets = moduleDetails.reduce((sum, m) => sum + m.tickets, 0);
        const closedTickets = statusData.find((s: any) => s.estado === 'Cerrado' || s.status === 'Cerrado');
        const closedCount = closedTickets ? Number(closedTickets.total_issues || closedTickets.total_tickets || 0) : 0;
        const completionRate = totalTickets > 0 ? Math.round((closedCount / totalTickets) * 100) : 0;

        const kpis = [
            { label: "Total Tickets", value: totalTickets, color: [52, 152, 219] },
            { label: "Horas Totales", value: `${totalHours.toFixed(1)}h`, color: [46, 204, 113] },
            { label: "Tasa de Cierre", value: completionRate, color: [155, 89, 182] }
        ];

        kpis.forEach((kpi, i) => {
            const x = margin + (i * (kpiWidth + kpiGap));
            // @ts-ignore
            doc.setFillColor(...kpi.color);
            doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 3, 3, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(kpi.label, x + 6, yPos + 10);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(String(kpi.value), x + 6, yPos + 22);
        });

        yPos += kpiHeight + 10;

        // Estado de Facturación
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Estado de Facturación", margin, yPos);
        yPos += 6;

        const contractedHours = projectContractedHours;
        const additionalHours = Math.max(0, totalHours - contractedHours);

        const billingBody = [
            ['Horas Contratadas', `${contractedHours.toFixed(1)} h`, 'Base'],
            ['Horas Consumidas', `${totalHours.toFixed(1)} h`, totalHours > contractedHours ? 'En rango' : 'En rango'],
            ['Horas Adicionales', `${additionalHours.toFixed(1)} h`, additionalHours > 0 ? '-' : '-']
        ];

        autoTable(doc, {
            startY: yPos,
            head: [['Concepto', 'Valor', 'Estado']],
            body: billingBody,
            theme: 'grid',
            // @ts-ignore
            headStyles: { fillColor: secondaryColor, fontSize: 11, cellPadding: 6 },
            styles: { fontSize: 10, cellPadding: 6 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;

        // Resumen por Estado
        doc.text("Resumen por Estado", margin, yPos);
        yPos += 6;

        const statusRows = statusData.map((s: any) => [
            s.estado || s.status || 'Desconocido',
            Number(s.total_issues || s.total_tickets || 0),
            `${((Number(s.total_issues || s.total_tickets || 0) / Math.max(totalTickets, 1)) * 100).toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Estado', 'Cantidad', '%']],
            body: statusRows,
            theme: 'striped',
            // @ts-ignore
            headStyles: { fillColor: primaryColor, fontSize: 11, cellPadding: 6 },
            styles: { fontSize: 10, cellPadding: 6 },
            margin: { left: margin, right: margin },
            pageBreak: 'avoid'
        });

        addFooter(1);

        // --- PAGE 2: MÉTRICAS DETALLADAS ---
        doc.addPage();
        addHeader("Métricas Detalladas");
        yPos = 45;

        const accentColor = [230, 126, 34]; // Orange

        // Left side: Desglose por Prioridad
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Desglose por Prioridad", margin, yPos);

        const priorityRows = priorityData.map((p: any) => [
            p.priorida || p.prioridad || p.priority || 'Unknown',
            Number(p.total) || Number(p.total_tickets) || 0,
            `${Number(p.pct_mes || 0).toFixed(1)}%`
        ]);

        const totalPriorityTickets = priorityRows.reduce((sum: number, row: any) => sum + (Number(row[1]) || 0), 0);
        priorityRows.push(['TOTAL', totalPriorityTickets, '100%']);

        autoTable(doc, {
            startY: yPos + 6,
            head: [['Prioridad', 'Tickets', '%']],
            body: priorityRows,
            theme: 'grid',
            // @ts-ignore
            headStyles: { fillColor: accentColor, fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            margin: { left: margin, right: pageWidth / 2 + 5 },
            tableWidth: (pageWidth - (margin * 3)) / 2,
            didParseCell: (data: any) => {
                if (data.row.index === priorityRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        // Right side: Desglose por Tipo
        doc.text("Desglose por Tipo", pageWidth / 2 + 5, 45);

        const typeRows = typeData.map((t: any) => [
            t.issuetype || t.tipo || t.type || 'Unknown',
            Number(t.total_issues) || Number(t.total) || 0
        ]);

        autoTable(doc, {
            startY: 55,
            head: [['Tipo', 'Tickets']],
            body: typeRows,
            theme: 'grid',
            // @ts-ignore
            headStyles: { fillColor: secondaryColor, fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            margin: { left: pageWidth / 2 + 5, right: margin },
            tableWidth: (pageWidth - (margin * 3)) / 2
        });

        // @ts-ignore
        const finalYPriority = doc.lastAutoTable.finalY;
        yPos = finalYPriority + 15;

        // Bottom: Desempeño por Consultor
        doc.setFontSize(14);
        doc.setTextColor(52, 152, 219);
        doc.text("Desempeño por Consultor", margin, yPos);

        const consultantRows = consultantData.map(c => [
            c.name,
            Number(c.tickets),
            `${Number(c.hours).toFixed(2)} h`,
            `${Number(c.pct_tickets || 0).toFixed(1)}%`,
            `${Number(c.pct_hours || 0).toFixed(1)}%`
        ]);

        const totalConsultantTickets = consultantRows.reduce((sum: number, row: any) => sum + row[1], 0);
        const totalConsultantHours = consultantRows.reduce((sum: number, row: any) => sum + parseFloat(row[2]), 0);

        consultantRows.push([
            'TOTAL',
            totalConsultantTickets,
            `${totalConsultantHours.toFixed(2)} h`,
            '100%',
            '100%'
        ]);

        autoTable(doc, {
            startY: yPos + 10,
            head: [['Consultor', 'Tickets', 'Horas', '% Tickets', '% Horas']],
            body: consultantRows,
            theme: 'striped',
            // @ts-ignore
            headStyles: { fillColor: [52, 152, 219], fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            margin: { left: margin, right: margin },
            didParseCell: (data: any) => {
                if (data.row.index === consultantRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        addFooter(2);

        // --- PAGE 3: ANÁLISIS DETALLADO ---
        doc.addPage();
        addHeader("Análisis Detallado");
        yPos = 45;

        // Top 5 Tickets
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Top 5 Tickets (Mayor Consumo)", margin, yPos);
        yPos += 6;

        const topTicketRows = topTicketsData.slice(0, 5).map((t, i) => [
            `${i + 1}`,
            t.ticket || 'N/A',
            `${Number(t.ticket_horas || 0).toFixed(2)} h`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['#', 'Ticket', 'Horas']],
            body: topTicketRows,
            theme: 'grid',
            // @ts-ignore
            headStyles: { fillColor: [231, 76, 60], fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 30, halign: 'right' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;

        // Calendar
        if (yPos + 60 < pageHeight) {
            doc.text("Actividad Diaria (Tickets Creados)", margin, yPos);
            yPos += 6;

            const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            const colWidth = (pageWidth - (margin * 2)) / 7;
            const rowHeight = 10;

            // Header
            doc.setFillColor(200, 200, 200);
            doc.rect(margin, yPos, pageWidth - (margin * 2), 6, 'F');
            doc.setFontSize(8);
            doc.setTextColor(50, 50, 50);
            days.forEach((d, i) => {
                doc.text(d, margin + (i * colWidth) + (colWidth / 2), yPos + 4, { align: 'center' });
            });
            yPos += 6;

            // Grid Logic
            const [yearStr, monthStr] = (selectedMonth || '').split('-');
            const year = parseInt(yearStr);
            const monthIndex = parseInt(monthStr) - 1;
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
            const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

            // Group issues by day
            const issuesByDay: Record<number, number> = {};
            issuesCalendarData.forEach(issue => {
                const day = new Date(issue.fechacreacion).getDate();
                issuesByDay[day] = (issuesByDay[day] || 0) + 1;
            });

            let currentDay = 1;
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 7; c++) {
                    const x = margin + (c * colWidth);
                    const y = yPos + (r * rowHeight);

                    doc.setDrawColor(220, 220, 220);
                    doc.rect(x, y, colWidth, rowHeight);

                    if ((r === 0 && c < firstDayOfWeek) || currentDay > daysInMonth) {
                        // Empty
                    } else {
                        const count = issuesByDay[currentDay] || 0;

                        // Highlight active days
                        if (count > 0) {
                            doc.setFillColor(41, 128, 185);
                            doc.circle(x + colWidth / 2, y + rowHeight / 2, Math.min(3, 1 + count / 2), 'F');
                        }

                        doc.setFontSize(6);
                        doc.setTextColor(100, 100, 100);
                        doc.text(String(currentDay), x + 2, y + 3);
                        currentDay++;
                    }
                }
                if (currentDay > daysInMonth) break;
            }
        }

        addFooter(3);

        // --- PAGE 4: TRANSITION ---
        doc.addPage();
        yPos = 45;

        // Minimal table with just TOTAL GENERAL
        autoTable(doc, {
            startY: yPos,
            head: [['Ticket', 'Consultor', 'Horas']],
            body: [['', 'TOTAL GENERAL', `${totalHours.toFixed(2)} h`]],
            theme: 'grid',
            // @ts-ignore
            headStyles: { fillColor: secondaryColor, fontSize: 11, cellPadding: 6 },
            bodyStyles: { fontSize: 11, cellPadding: 6, fontStyle: 'bold', fillColor: [52, 152, 219], textColor: 255 },
            margin: { left: margin, right: margin }
        });

        addFooter(4);

        // --- PAGE 5: DETALLE DE HORAS ---
        doc.addPage();
        addHeader("Detalle de Horas");
        yPos = 45;

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Registro Detallado de Actividades", margin, yPos);
        yPos += 6;

        // Sort by Consultant, then Ticket
        const sortedDetails = [...detailsData].sort((a: any, b: any) => {
            const consultantA = a.assignee_name || a.asignado || '';
            const consultantB = b.assignee_name || b.asignado || '';
            if (consultantA !== consultantB) return consultantA.localeCompare(consultantB);

            const ticketA = a.clave || '';
            const ticketB = b.clave || '';

            // Extract numeric part
            const matchA = ticketA.match(/-(\d+)$/);
            const matchB = ticketB.match(/-(\d+)$/);

            if (matchA && matchB) {
                const numA = parseInt(matchA[1], 10);
                const numB = parseInt(matchB[1], 10);
                if (numA !== numB) return numA - numB;
            }

            return ticketA.localeCompare(ticketB);
        });

        // Group and Calculate Subtotals
        const groupedRows: any[] = [];
        let currentConsultant = '';
        let consultantTotal = 0;
        let grandTotal = 0;

        sortedDetails.forEach((d: any) => {
            const consultant = d.assignee_name || d.asignado || 'Sin Asignar';
            const hours = Number(d.horas) || 0;
            const ticket = d.clave || '';

            // Handle Consultant Change (Subtotal)
            if (currentConsultant !== '' && currentConsultant !== consultant) {
                groupedRows.push([
                    '',
                    `Subtotal ${currentConsultant}`,
                    `${consultantTotal.toFixed(2)} h`
                ]);
                consultantTotal = 0;
            }

            if (currentConsultant !== consultant) {
                currentConsultant = consultant;
            }

            // Add Row
            groupedRows.push([
                ticket,
                consultant,
                `${hours.toFixed(2)} h`
            ]);

            consultantTotal += hours;
            grandTotal += hours;
        });

        // Add final subtotal
        if (currentConsultant !== '') {
            groupedRows.push([
                '',
                `Subtotal ${currentConsultant}`,
                `${consultantTotal.toFixed(2)} h`
            ]);
        }

        autoTable(doc, {
            startY: yPos,
            head: [['Ticket', 'Consultor', 'Horas']],
            body: groupedRows,
            theme: 'striped',
            // @ts-ignore
            headStyles: { fillColor: secondaryColor, fontSize: 10, cellPadding: 4 },
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: { 2: { halign: 'right' } },
            margin: { left: margin, right: margin },
            didParseCell: (data: any) => {
                if (data.cell.text[0] && data.cell.text[0].startsWith('Subtotal')) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [220, 220, 220];
                }
            }
        });

        // Add page number to last page
        // @ts-ignore
        const totalPages = doc.internal.getNumberOfPages();
        addFooter(totalPages);

        // Save
        const fileName = `${projectName}_${selectedMonth}_Analisis_Detallado.pdf`;
        doc.save(fileName);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D1B2A] p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-white">Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D1B2A]" style={{ padding: '2rem' }}>
            <div className="max-w-7xl mx-auto">
                {/* Header with Export Buttons */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                            <Search className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Análisis Detallado</h1>
                            <p className="text-slate-400 mt-1">Desglose profundo de datos y métricas del proyecto</p>
                        </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all duration-200 border border-emerald-500/30"
                            style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                        >
                            <Download className="w-5 h-5" />
                            <span className="font-medium">Exportar Excel</span>
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all duration-200 border border-red-500/30"
                            style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                        >
                            <FileText className="w-5 h-5" />
                            <span className="font-medium">Exportar PDF</span>
                        </button>
                    </div>
                </div>

                {/* Issue Summary Table */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl mb-6" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Resumen de Issues (v_issues_resumen)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Key</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Resumen</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Estado</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Prioridad</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Asignado</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Tipo</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Horas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issueSummary.map((issue, index) => (
                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                        <td className="py-3 px-4 text-cyan-400 font-mono text-sm">{issue.key}</td>
                                        <td className="py-3 px-4 text-white max-w-xs truncate" title={issue.summary}>
                                            {issue.summary}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${issue.status === 'Cerrado' ? 'bg-emerald-500/20 text-emerald-400' :
                                                issue.status === 'Trabajo en curso' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {issue.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-300">{issue.priority}</td>
                                        <td className="py-3 px-4 text-slate-300">{issue.assignee}</td>
                                        <td className="py-3 px-4 text-slate-400 text-sm">{issue.type}</td>
                                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                                            {issue.hours.toFixed(2)}h
                                        </td>
                                    </tr>
                                ))}
                                {issueSummary.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-6 text-center text-slate-500">
                                            No hay datos de issues para este período
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {issueSummary.length > 0 && (
                                <tfoot className="border-t-2 border-slate-600">
                                    <tr className="font-bold">
                                        <td colSpan={6} className="py-3 px-4 text-white">
                                            TOTAL: {issueSummary.length} issues
                                        </td>
                                        <td className="py-3 px-4 text-right text-emerald-400">
                                            {issueSummary.reduce((sum, i) => sum + i.hours, 0).toFixed(2)}h
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Module Breakdown Table */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl mb-6" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Desglose por Módulo</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Módulo</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Horas Totales</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Promedio h/Ticket</th>
                                </tr>
                            </thead>
                            <tbody>
                                {moduleDetails.map((module, index) => (
                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                        <td className="py-3 px-4 text-white font-medium">{module.module}</td>
                                        <td className="py-3 px-4 text-right text-blue-400">{module.tickets}</td>
                                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                                            {module.hours.toFixed(2)}h
                                        </td>
                                        <td className="py-3 px-4 text-right text-purple-400">
                                            {module.avg_hours.toFixed(2)}h
                                        </td>
                                    </tr>
                                ))}
                                {moduleDetails.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-slate-500">
                                            No hay datos de módulos para este período
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {moduleDetails.length > 0 && (
                                <tfoot className="border-t-2 border-slate-600">
                                    <tr className="font-bold">
                                        <td className="py-3 px-4 text-white">TOTAL</td>
                                        <td className="py-3 px-4 text-right text-blue-400">
                                            {moduleDetails.reduce((sum, m) => sum + m.tickets, 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-emerald-400">
                                            {moduleDetails.reduce((sum, m) => sum + m.hours, 0).toFixed(2)}h
                                        </td>
                                        <td className="py-3 px-4 text-right text-purple-400">
                                            {(moduleDetails.reduce((sum, m) => sum + m.hours, 0) /
                                                Math.max(moduleDetails.reduce((sum, m) => sum + m.tickets, 0), 1)).toFixed(2)}h
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Consultant Detailed Table */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Desglose Detallado por Consultor</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">#</th>
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Consultor</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">% Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Horas</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">% Horas</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Promedio h/t</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consultantData.map((consultant, index) => {
                                    const avgHours = consultant.tickets > 0 ? consultant.hours / consultant.tickets : 0;
                                    return (
                                        <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                            <td className="py-3 px-4 text-slate-400 text-sm">{index + 1}</td>
                                            <td className="py-3 px-4 text-white font-medium">{consultant.name}</td>
                                            <td className="py-3 px-4 text-right text-blue-400">{consultant.tickets}</td>
                                            <td className="py-3 px-4 text-right text-cyan-400">{consultant.pct_tickets.toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                                                {consultant.hours.toFixed(2)}h
                                            </td>
                                            <td className="py-3 px-4 text-right text-purple-400">{consultant.pct_hours.toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-right text-amber-400">
                                                {avgHours.toFixed(2)}h
                                            </td>
                                        </tr>
                                    );
                                })}
                                {consultantData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-6 text-center text-slate-500">
                                            No hay datos de consultores para este período
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {consultantData.length > 0 && (
                                <tfoot className="border-t-2 border-slate-600">
                                    <tr className="font-bold">
                                        <td colSpan={2} className="py-3 px-4 text-white">TOTAL</td>
                                        <td className="py-3 px-4 text-right text-blue-400">
                                            {consultantData.reduce((sum, c) => sum + c.tickets, 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-cyan-400">100.0%</td>
                                        <td className="py-3 px-4 text-right text-emerald-400">
                                            {consultantData.reduce((sum, c) => sum + c.hours, 0).toFixed(2)}h
                                        </td>
                                        <td className="py-3 px-4 text-right text-purple-400">100.0%</td>
                                        <td className="py-3 px-4 text-right text-amber-400">
                                            {(consultantData.reduce((sum, c) => sum + c.hours, 0) /
                                                Math.max(consultantData.reduce((sum, c) => sum + c.tickets, 0), 1)).toFixed(2)}h
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalisisDetallado;
