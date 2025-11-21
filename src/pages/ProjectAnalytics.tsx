import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    LabelList
} from 'recharts';
import {
    AlertCircle,
    XCircle,
    CheckCircle2,
    Search,
    Clock,
    HelpCircle,
    Download,
    FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
    'Bloqueado': { color: 'text-red-500', icon: XCircle, label: 'Bloqueado' },
    'Cancelado': { color: 'text-gray-400', icon: AlertCircle, label: 'Cancelado' },
    'Cerrado': { color: 'text-green-500', icon: CheckCircle2, label: 'Cerrado' },
    'Pruebas de usuario': { color: 'text-yellow-500', icon: Search, label: 'Pruebas de usuario' },
    'Trabajo en curso': { color: 'text-blue-500', icon: Clock, label: 'Trabajo en curso' }
};

export const ProjectAnalytics = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [months, setMonths] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [detailsData, setDetailsData] = useState<any[]>([]);

    const [statusData, setStatusData] = useState<any[]>([]);
    const [typeData, setTypeData] = useState<any[]>([]);
    const [issuesData, setIssuesData] = useState<any[]>([]);
    const [topTicketsData, setTopTicketsData] = useState<any[]>([]);
    const [consultantData, setConsultantData] = useState<any[]>([]);
    const [moduleDataPDF, setModuleDataPDF] = useState<any[]>([]);
    const [projectName, setProjectName] = useState('');
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);

    // Fetch available months and project details
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!projectId) return;

            try {
                // Get Project Name and Jira ID
                const { data: project } = await supabase
                    .from('proyectos')
                    .select('nombre, jira_id')
                    .eq('id', projectId)
                    .single();

                let currentJiraId = null;
                if (project) {
                    setProjectName(project.nombre);
                    // Cast to any to avoid TS error if types aren't updated
                    const p = project as any;
                    setProjectJiraId(p.jira_id);
                    currentJiraId = p.jira_id;
                }

                if (currentJiraId) {
                    // Get available months from the REAL view
                    // The view 'v_tickets_mes_proyecto' uses 'proyecto' column (text) for the ID
                    const { data: monthData, error } = await supabase
                        .from('v_tickets_mes_proyecto')
                        .select('mes')
                        .eq('proyecto', currentJiraId);

                    if (error) {
                        console.warn('Error fetching months from view:', error);
                        // Fallback only if error
                        setMonths(['2025-09', '2025-08', '2025-07']);
                    } else {
                        // Extract unique months and format
                        const uniqueMonths = Array.from(new Set(monthData.map((item: any) => item.mes.substring(0, 7))));
                        const sortedMonths = uniqueMonths.sort().reverse();
                        setMonths(sortedMonths);
                        if (sortedMonths.length > 0) {
                            setSelectedMonth(sortedMonths[0]);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [projectId]);

    // Fetch Dashboard Data when month is selected
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!projectId || !selectedMonth || !projectJiraId) return;

            try {
                console.log(`Fetching REAL data for Project: ${projectJiraId}, Month: ${selectedMonth} `);

                // 1. Fetch KPIs from v_tickets_mes_proyecto
                const { data: kpiData, error: kpiError } = await supabase
                    .from('v_tickets_mes_proyecto')
                    .select('*') // Select ALL columns to find hours
                    .eq('proyecto', projectJiraId)
                    // The view has 'mes' as a date (e.g., 2025-09-01). 
                    // We need to match the month. Since selectedMonth is 'YYYY-MM', 
                    // we might need to filter by range or assume the view has a text column or we match the start date.
                    // Based on the screenshot, 'mes' is a date '2025-09-01'.
                    // Let's try strict equality with the first day of the month.
                    .eq('mes', `${selectedMonth}-01`)
                    .single();

                // 2. Fetch Status Data
                const { data: statusDataResult, error: statusError } = await supabase
                    .from('v_tickets_mes_proyecto_status')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`);

                // 3. Fetch Priority Data
                // Hint suggested: v_tickets_mes_proyecto_prioridad_pct
                const { data: priorityData, error: priorityError } = await supabase
                    .from('v_tickets_mes_proyecto_prioridad_pct')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`);

                // 4. Fetch Assignee Data
                // Switched to v_issues_mes_proyecto_asignacion to get percentages
                const { data: assigneeData, error: assigneeError } = await supabase
                    .from('v_issues_mes_proyecto_asignacion')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`);


                // 5. Fetch Type Data
                const cleanJiraId = projectJiraId?.trim();
                const { data: typeDataResult, error: typeError } = await supabase
                    .from('v_issues_mes_proyecto_tipo')
                    .select('*')
                    .eq('proyecto', cleanJiraId)
                    .eq('mes', `${selectedMonth}-01`);


                // Construct Dashboard Data
                // Mapping keys based on final verification:
                // Status: status, total_tickets
                // Priority: priorida, total
                // Assignee: assignee_name, total
                // Type: Guessing 'tipo' and 'total' or 'cantidad'

                // 6. Fetch Module Hours Data
                const { data: moduleData, error: moduleError } = await supabase
                    .from('v_horas_mes_modulo_proyecto')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`);

                // 7. Fetch Total Hours Data
                const { data: hoursData, error: hoursError } = await supabase
                    .from('v_horas_mes_proyecto')
                    .select('total_horas')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`)
                    .single();

                // 8. Fetch Detailed Hours Data
                const { data: details, error: detailsError } = await supabase
                    .from('v_horas_totales_detalles')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`)
                    .order('created_at_jira', { ascending: false });

                if (detailsError) {
                    console.error('Error fetching details data:', detailsError);
                } else {
                    setDetailsData(details || []);
                }

                // Fetch Status Data for PDF
                if (statusError) {
                    console.error('Error fetching status data:', statusError);
                } else {
                    setStatusData(statusDataResult || []);
                }

                // Fetch Type Data for PDF
                if (typeError) {
                    console.error('Error fetching type data:', typeError);
                } else {
                    setTypeData(typeDataResult || []);
                }

                // --- NEW DATA FOR ADVANCED PDF ---

                // 9. Fetch Issues for Calendar (using v_tickets_mes_proyecto_status to get all tickets or issues table)
                // We need creation dates. 'issues' table is best but we need to filter by project and month.
                // Since 'issues' might be large, let's try to use a view if possible, or filter 'issues' carefully.
                // We can use 'v_horas_totales_detalles' to get dates of worklogs, but for TICKET CREATION we need 'issues'.
                // Let's use 'issues' filtered by 'fechacreacion' range.
                const startDate = `${selectedMonth}-01`;
                // Calculate end date (next month)
                const [year, month] = selectedMonth.split('-').map(Number);
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

                const { data: issuesResult, error: issuesError } = await supabase
                    .from('issues')
                    .select('clave, fechacreacion, resumen')
                    .eq('proyecto', cleanJiraId)
                    .gte('fechacreacion', startDate)
                    .lt('fechacreacion', endDate);

                if (issuesError) console.error('Error fetching issues for calendar:', issuesError);
                setIssuesData(issuesResult || []);

                // 10. Fetch Top Tickets (v_horas_totales_por_proyecto_ticket)
                const { data: topTicketsResult, error: topTicketsError } = await supabase
                    .from('v_horas_totales_por_proyecto_ticket')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', `${selectedMonth}-01`)
                    .order('ticket_horas', { ascending: false })
                    .limit(10);

                if (topTicketsError) console.error('Error fetching top tickets:', topTicketsError);
                setTopTicketsData(topTicketsResult || []);

                // 11. Fetch Consultant Data (v_issues_mes_proyecto_asignacion)
                // Already fetched as 'assigneeData' but let's set it for PDF specifically to be safe
                setConsultantData(assigneeData || []);

                // 12. Fetch Module Data (v_horas_mes_modulo_proyecto)
                // Already fetched as 'moduleData'
                setModuleDataPDF(moduleData || []);

                // Construct Dashboard Data

                const FIXED_STATUSES = [
                    'Bloqueado',
                    'Cancelado',
                    'Cerrado',
                    'Pruebas de usuario',
                    'Trabajo en curso'
                ];

                const statusMap = new Map(statusDataResult?.map((d: any) => [d.status, Number(d.total_tickets)]) || []);

                const mergedStatusData = FIXED_STATUSES.map(status => {
                    const config = STATUS_CONFIG[status] || { color: 'text-slate-400', icon: HelpCircle, label: status };
                    return {
                        name: status,
                        value: statusMap.get(status) || 0,
                        ...config
                    };
                });

                // Calculate Completion Rate
                const totalTickets = Number(kpiData?.total_tickets) || 0;
                const closedTickets = statusMap.get('Cerrado') || 0;
                const completionRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

                const newDashboardData = {
                    status: mergedStatusData,

                    priority: priorityData?.map((d: any) => ({
                        name: d.priorida || d.prioridad || d.priority || 'Unknown',
                        value: Number(d.total) || Number(d.total_tickets) || 0,
                        pct: d.pct_mes || 0
                    })) || [],

                    assignee: assigneeData?.map((d: any) => ({
                        name: d.asignado || d.assignee_name || 'Unknown',
                        tickets: Number(d.total_issues) || 0,
                        pctIssues: Number(d.porcentaje_issues) || 0,
                        pctHours: Number(d.porcentaje_horas) || 0
                    })) || [],

                    type: typeDataResult?.map((d: any) => ({
                        name: d.issuetype || d.tipo || d.type || 'Unknown',
                        value: Number(d.total_issues) || Number(d.total) || Number(d.cantidad) || 0
                    })) || [],

                    module: moduleData?.map((d: any) => ({
                        name: d.modulo || d.module || 'Unknown',
                        value: Number(d.total_horas) || 0
                    })) || [],

                    kpis: {
                        totalTickets: kpiData?.total_tickets || 0,
                        totalHours: hoursData?.total_horas || 0,
                        completionRate: `${completionRate}%`
                    }
                };

                setDashboardData(newDashboardData);

                // Temporary Debug Log to find the hours column
                console.log('KPI Data Raw:', kpiData);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            }
        };

        fetchDashboardData();
    }, [projectId, selectedMonth, projectJiraId]);

    const handleDownload = () => {
        console.log('Starting download process...');
        if (!detailsData || detailsData.length === 0) {
            console.warn('No data to download');
            alert('No hay datos para descargar');
            return;
        }

        console.log('Data to export:', detailsData.length, 'rows');

        try {
            const dataToExport = detailsData.map(item => ({
                'Clave': item.clave,
                'Asignado': item.assignee_name,
                'Mes': selectedMonth,
                'Horas': Number(item.horas) || 0
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle Horas");

            // Generate buffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

            // Create Blob
            const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

            // Sanitize filename
            const safeProjectName = (projectName || 'Proyecto').replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${safeProjectName}_${selectedMonth || 'Reporte'}.xlsx`;

            console.log('Generated filename:', fileName);

            // Create download link
            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                console.log('Download cleanup complete');
            }, 100);
        } catch (error) {
            console.error('Error during download:', error);
            alert('Error al generar el archivo Excel');
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const primaryColor = [41, 128, 185]; // Blue
        const secondaryColor = [52, 73, 94]; // Dark Slate
        const accentColor = [230, 126, 34]; // Orange
        const lightBg = [245, 247, 250]; // Light Gray

        // Helper: Header
        const addHeader = (title: string) => {
            // Brand Bar
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 0, pageWidth, 15, 'F');

            // Title
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text(title, margin, 10);

            // Meta
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`${projectName} | ${selectedMonth}`, pageWidth - margin, 10, { align: 'right' });
        };

        // Helper: Footer
        const addFooter = (pageNumber: number) => {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("GPARTNER CONSULTING - Informe de Gestión", margin, pageHeight - 10);
            doc.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        };

        // --- PAGE 1: EXECUTIVE SUMMARY ---
        addHeader("Resumen Ejecutivo");

        let yPos = 30;

        // 1. KPIs Row
        const kpiWidth = (pageWidth - (margin * 2) - 20) / 3;
        const kpiHeight = 25;

        const kpis = [
            { label: "Total Tickets", value: dashboardData?.kpis?.totalTickets || 0, color: [52, 152, 219] },
            { label: "Horas Totales", value: `${Number(dashboardData?.kpis?.totalHours || 0).toFixed(1)}h`, color: [46, 204, 113] },
            { label: "Tasa de Cierre", value: dashboardData?.kpis?.completionRate || "0%", color: [155, 89, 182] }
        ];

        kpis.forEach((kpi, i) => {
            const x = margin + (i * (kpiWidth + 10));
            // @ts-ignore
            doc.setFillColor(...kpi.color);
            doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 2, 2, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text(kpi.label, x + 5, yPos + 8);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(String(kpi.value), x + 5, yPos + 18);
        });

        yPos += kpiHeight + 15;

        // 2. Billing Section
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Estado de Facturación", margin, yPos);
        yPos += 8;

        const contractedHours = 50;
        const totalHours = Number(dashboardData?.kpis?.totalHours || 0);
        const additionalHours = Math.max(0, totalHours - contractedHours);

        const billingBody = [
            ['Horas Contratadas', `${contractedHours.toFixed(1)} h`, 'Base'],
            ['Horas Consumidas', `${totalHours.toFixed(1)} h`, totalHours > contractedHours ? 'Excedido' : 'En rango'],
            ['Horas Adicionales', `${additionalHours.toFixed(1)} h`, additionalHours > 0 ? 'Facturable' : '-']
        ];

        autoTable(doc, {
            startY: yPos,
            head: [['Concepto', 'Valor', 'Estado']],
            body: billingBody,
            theme: 'grid',
            headStyles: { fillColor: secondaryColor },
            styles: { fontSize: 10, cellPadding: 4 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;

        // 3. Status Summary
        doc.text("Resumen por Estado", margin, yPos);
        yPos += 8;

        const statusRows = dashboardData?.status.map((s: any) => [s.name, s.value, `${((s.value / (dashboardData?.kpis?.totalTickets || 1)) * 100).toFixed(1)}%`]) || [];

        autoTable(doc, {
            startY: yPos,
            head: [['Estado', 'Cantidad', '%']],
            body: statusRows,
            theme: 'striped',
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 10 },
            margin: { left: margin, right: margin }
        });

        addFooter(1);

        // --- PAGE 2: DETAILED METRICS ---
        doc.addPage();
        addHeader("Métricas Detalladas");
        yPos = 30;

        // 1. Priority Breakdown
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Desglose por Prioridad", margin, yPos);
        yPos += 8;

        const priorityRows = dashboardData?.priority.map((p: any) => [p.name, p.value, `${Number(p.pct).toFixed(1)}%`]) || [];
        const totalPriorityTickets = priorityRows.reduce((sum: number, row: any) => sum + (Number(row[1]) || 0), 0);

        // Add Total Row
        priorityRows.push(['TOTAL', totalPriorityTickets, '100%']);

        autoTable(doc, {
            startY: yPos,
            head: [['Prioridad', 'Tickets', '%']],
            body: priorityRows,
            theme: 'grid',
            headStyles: { fillColor: accentColor },
            styles: { fontSize: 10 },
            margin: { left: margin, right: pageWidth / 2 + 5 },
            tableWidth: (pageWidth - (margin * 3)) / 2,
            didParseCell: (data) => {
                if (data.row.index === priorityRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        // 2. Type Breakdown (Right side)
        // @ts-ignore
        const finalYPriority = doc.lastAutoTable.finalY;

        doc.text("Desglose por Tipo", pageWidth / 2 + 5, 30); // Align with Priority title
        const typeRows = dashboardData?.type.map((t: any) => [t.name, t.value]) || [];

        autoTable(doc, {
            startY: 38, // Align with Priority table start
            head: [['Tipo', 'Tickets']],
            body: typeRows,
            theme: 'grid',
            headStyles: { fillColor: secondaryColor },
            styles: { fontSize: 10 },
            margin: { left: pageWidth / 2 + 5, right: margin },
            tableWidth: (pageWidth - (margin * 3)) / 2
        });

        // @ts-ignore
        const finalYType = doc.lastAutoTable.finalY;
        yPos = Math.max(finalYPriority, finalYType) + 15;

        // 3. Module Breakdown (Full width)
        doc.text("Horas por Módulo", margin, yPos);
        yPos += 8;

        const moduleRows = moduleDataPDF.map(m => [m.modulo, Number(m.total_horas)]);
        const totalModuleHours = moduleRows.reduce((sum: number, row: any) => sum + (Number(row[1]) || 0), 0);

        // Format rows for display
        const formattedModuleRows = moduleRows.map((r: any) => [r[0], `${r[1].toFixed(2)} h`]);
        // Add Total Row
        formattedModuleRows.push(['TOTAL', `${totalModuleHours.toFixed(2)} h`]);

        autoTable(doc, {
            startY: yPos,
            head: [['Módulo', 'Horas Totales']],
            body: formattedModuleRows,
            theme: 'striped',
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 10 },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.row.index === formattedModuleRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        // Consultant Breakdown (Full Width below)
        // @ts-ignore
        let finalYModule = doc.lastAutoTable.finalY;
        let nextY = Math.max(finalYType, finalYModule) + 15;

        if (nextY > pageHeight - 40) {
            doc.addPage();
            nextY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.text("Desempeño por Consultor", margin, nextY);

        const consultantRows = consultantData.map(c => [
            c.asignado,
            Number(c.total_issues),
            Number(c.total_horas),
            `${Number(c.porcentaje_issues || 0).toFixed(1)}%`,
            `${Number(c.porcentaje_horas || 0).toFixed(1)}%`
        ]);

        const totalConsultantTickets = consultantRows.reduce((sum: number, row: any) => sum + row[1], 0);
        const totalConsultantHours = consultantRows.reduce((sum: number, row: any) => sum + row[2], 0);

        // Format for display
        const formattedConsultantRows = consultantRows.map((r: any) => [
            r[0],
            r[1],
            `${r[2].toFixed(2)} h`,
            r[3],
            r[4]
        ]);

        // Add Total Row
        formattedConsultantRows.push([
            'TOTAL',
            totalConsultantTickets,
            `${totalConsultantHours.toFixed(2)} h`,
            '100%',
            '100%'
        ]);

        autoTable(doc, {
            startY: nextY + 5,
            head: [['Consultor', 'Tickets', 'Horas', '% Tickets', '% Horas']],
            body: formattedConsultantRows,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 10 },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.row.index === formattedConsultantRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        addFooter(2);

        // --- PAGE 3: DEEP DIVE ---
        doc.addPage();
        addHeader("Análisis Detallado");
        yPos = 30;

        // 1. Top Tickets
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Top 5 Tickets (Mayor Consumo)", margin, yPos);
        yPos += 8;

        const topTicketRows = topTicketsData.slice(0, 5).map((t, i) => [
            `${i + 1}`,
            t.ticket,
            // t.resumen || 'Sin descripción', // We might not have resumen here
            `${Number(t.ticket_horas).toFixed(2)} h`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['#', 'Ticket', 'Horas']],
            body: topTicketRows,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] }, // Red for "Hot" items
            styles: { fontSize: 10 },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 30, halign: 'right' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;

        // 2. Daily Activity Calendar (Mini version)
        if (yPos + 60 < pageHeight) {
            doc.text("Actividad Diaria (Tickets Creados)", margin, yPos);
            yPos += 10;

            // Simple Calendar Grid
            const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            const colWidth = (pageWidth - (margin * 2)) / 7;
            const rowHeight = 10; // Compact rows

            // Header
            doc.setFillColor(200, 200, 200);
            doc.rect(margin, yPos, pageWidth - (margin * 2), 6, 'F');
            doc.setFontSize(8);
            doc.setTextColor(50, 50, 50);
            days.forEach((d, i) => {
                doc.text(d, margin + (i * colWidth) + (colWidth / 2), yPos + 4, { align: 'center' });
            });
            yPos += 6;

            // Grid Logic (Simplified from previous)
            const [yearStr, monthStr] = (selectedMonth || '').split('-');
            const year = parseInt(yearStr);
            const monthIndex = parseInt(monthStr) - 1;
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
            const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

            // Group issues
            const issuesByDay: Record<number, number> = {};
            issuesData.forEach(issue => {
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
                            doc.setFillColor(41, 128, 185); // Blue dot
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

        // --- PAGE 4: HOURS DETAIL ---
        doc.addPage();
        addHeader("Detalle de Horas");
        yPos = 30;

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Registro Detallado de Actividades", margin, yPos);
        yPos += 8;

        // Map detailsData to table rows
        // Assuming detailsData has: created_at_jira (date), clave (ticket), assignee_name (consultant), horas (hours), comentario (comment)

        // 1. Sort by Consultant, then Ticket, then Date
        const sortedDetails = [...detailsData].sort((a: any, b: any) => {
            const consultantA = a.assignee_name || a.asignado || '';
            const consultantB = b.assignee_name || b.asignado || '';
            if (consultantA !== consultantB) return consultantA.localeCompare(consultantB);

            const ticketA = a.clave || '';
            const ticketB = b.clave || '';
            if (ticketA !== ticketB) return ticketA.localeCompare(ticketB);

            return (a.created_at_jira || '').localeCompare(b.created_at_jira || '');
        });

        // 2. Group and Calculate Subtotals
        const groupedRows: any[] = [];
        let currentConsultant = '';
        let consultantTotal = 0;
        let grandTotal = 0;

        sortedDetails.forEach((d: any, index: number) => {
            const consultant = d.assignee_name || d.asignado || 'Sin Asignar';
            const hours = Number(d.horas) || 0;

            // Check for consultant change (but not on the first item)
            if (index > 0 && currentConsultant !== consultant) {
                // Add subtotal for previous consultant
                groupedRows.push([
                    '',
                    '',
                    `Subtotal ${currentConsultant}`,
                    `${consultantTotal.toFixed(2)} h`,
                    ''
                ]);
                consultantTotal = 0;
            }

            currentConsultant = consultant;
            consultantTotal += hours;
            grandTotal += hours;

            const date = d.created_at_jira ? new Date(d.created_at_jira).toLocaleDateString('es-ES') : '-';
            groupedRows.push([
                date,
                d.clave || '-',
                consultant,
                `${hours.toFixed(2)} h`,
                d.comentario || '-'
            ]);

            // If it's the last item, add the final subtotal
            if (index === sortedDetails.length - 1) {
                groupedRows.push([
                    '',
                    '',
                    `Subtotal ${currentConsultant}`,
                    `${consultantTotal.toFixed(2)} h`,
                    ''
                ]);
            }
        });

        // 3. Add Grand Total
        groupedRows.push([
            '',
            '',
            'TOTAL GENERAL',
            `${grandTotal.toFixed(2)} h`,
            ''
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Fecha', 'Ticket', 'Consultor', 'Horas', 'Comentario']],
            body: groupedRows,
            theme: 'striped',
            headStyles: { fillColor: secondaryColor },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 20 }, // Fecha
                1: { cellWidth: 25 }, // Ticket
                2: { cellWidth: 30 }, // Consultor
                3: { cellWidth: 15, halign: 'right' }, // Horas
                4: { cellWidth: 'auto' } // Comentario
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                const rawRow = data.row.raw as string[];
                const consultantCell = rawRow[2];

                // Style Subtotal rows
                if (consultantCell && consultantCell.startsWith('Subtotal')) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [230, 230, 230]; // Light Gray
                    data.cell.styles.textColor = [0, 0, 0];
                }

                // Style Grand Total row
                if (consultantCell === 'TOTAL GENERAL') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [41, 128, 185]; // Primary Blue
                    data.cell.styles.textColor = [255, 255, 255];
                }
            }
        });

        addFooter(4);

        // Save
        const safeProjectName = (projectName || 'Proyecto').replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Informe_Gestion_${safeProjectName}_${selectedMonth}.pdf`);
    };

    // Calculate total hours from detailsData
    const totalHoursDetails = detailsData.reduce((sum, item) => sum + (Number(item.horas) || 0), 0);

    if (loading && !dashboardData && months.length === 0) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/')}
                            className="mb-2 text-slate-400 hover:text-white flex items-center gap-2 transition-colors text-sm"
                        >
                            ← Volver al Dashboard
                        </button>
                        <h1 className="text-3xl font-bold">{projectName}</h1>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedMonth || ''}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="appearance-none bg-slate-800 border border-slate-700 hover:border-blue-500 text-white text-lg font-medium py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                        >
                            {months.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-medium uppercase mb-2">Total Tickets</h3>
                        <p className="text-3xl font-bold text-white">{dashboardData?.kpis.totalTickets}</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-medium uppercase mb-2">Horas Totales</h3>
                        <p className="text-3xl font-bold text-emerald-400">{dashboardData?.kpis.totalHours}h</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-medium uppercase mb-2">Tasa de Cierre</h3>
                        <p className="text-3xl font-bold text-blue-400">{dashboardData?.kpis.completionRate}</p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Status Cards (Replacing Pie Chart) */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-6">Tickets por Estado</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {dashboardData?.status.map((item: any, index: number) => {
                                const Icon = item.icon;
                                return (
                                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex items-center justify-between">
                                        <div>
                                            <span className={`text-xs font-bold uppercase mb-1 block ${item.color}`}>{item.name}</span>
                                            <span className="text-2xl font-bold text-white">{item.value}</span>
                                        </div>
                                        <div className={`p-3 rounded-full bg-slate-800/50 ${item.color.replace('text-', 'bg-').replace('500', '500/20').replace('400', '400/20')}`}>
                                            <Icon className={`w-6 h-6 ${item.color}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Priority Chart */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-6">Tickets por Prioridad</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={dashboardData?.priority}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                        cursor={{ fill: '#334155', opacity: 0.4 }}
                                        formatter={(value: any, name: any, props: any) => {
                                            return [`${value} (${Number(props.payload.pct).toFixed(2)}%)`, name];
                                        }}
                                    />
                                    <Bar dataKey="value">
                                        <LabelList dataKey="pct" position="top" formatter={(val: any) => `${Number(val).toFixed(2)}%`} fill="#f8fafc" />
                                        {dashboardData?.priority?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Type Chart (Pie) */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-6">Tickets por Tipo</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dashboardData?.type}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ percent }: any) => `${(percent * 100).toFixed(2)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {dashboardData?.type?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Module Hours Chart (Pie) */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-6">Horas por Módulo</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dashboardData?.module}
                                        cx="50%"
                                        cy="40%"
                                        labelLine={true}
                                        label={({ percent }: any) => {
                                            if (percent < 0.03) return ''; // Hide labels for < 3%
                                            return `${(percent * 100).toFixed(2)}%`;
                                        }}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        dataKey="value"
                                        style={{ fontSize: '11px' }}
                                    >
                                        {dashboardData?.module?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ bottom: 10 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Assignee Chart (Moved to Bottom, Full Width) */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 lg:col-span-2">
                        <h3 className="text-lg font-semibold mb-6">Tickets por Asignado</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dashboardData?.assignee} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 11 }}
                                        interval={0}
                                        angle={-25}
                                        textAnchor="end"
                                        height={60}
                                    />
                                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                        cursor={{ fill: '#334155', opacity: 0.4 }}
                                        formatter={(value: any, name: any, props: any) => {
                                            if (name === 'tickets') {
                                                return [
                                                    <div key="tickets">
                                                        <div>Tickets: {value} ({Number(props.payload.pctIssues).toFixed(2)}%)</div>
                                                        <div>Horas: {Number(props.payload.pctHours).toFixed(2)}% del total</div>
                                                    </div>,
                                                    ''
                                                ];
                                            }
                                            return [value, name];
                                        }}
                                    />
                                    <Bar dataKey="tickets">
                                        <LabelList
                                            dataKey="pctIssues"
                                            position="top"
                                            formatter={(val: any) => `${Number(val).toFixed(1)}%`}
                                            fill="#f8fafc"
                                            style={{ fontSize: '10px' }}
                                        />
                                        {dashboardData?.assignee?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Detailed Hours Table */}
                <div className="mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold">Detalle de Horas</h3>
                            <div className="bg-slate-700 px-3 py-1 rounded-full text-sm">
                                <span className="text-slate-400 mr-2">Total:</span>
                                <span className="font-bold text-emerald-400">{totalHoursDetails.toFixed(2)}h</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={generatePDF}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                                <FileText className="w-4 h-4" />
                                Generar Informe PDF
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={!detailsData || detailsData.length === 0}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Descargar Excel
                            </button>
                        </div>
                    </div>

                    <div className="overflow-auto max-h-[600px] border border-slate-700 rounded-lg">
                        <table className="w-full text-left border-collapse relative">
                            <thead className="sticky top-0 bg-slate-800 z-10 shadow-sm">
                                <tr className="border-b border-slate-700 text-slate-400 text-sm uppercase">
                                    <th className="py-3 px-4 whitespace-nowrap bg-slate-800">Clave</th>
                                    <th className="py-3 px-4 whitespace-nowrap bg-slate-800">Asignado</th>
                                    <th className="py-3 px-4 whitespace-nowrap bg-slate-800">Mes</th>
                                    <th className="py-3 px-4 whitespace-nowrap bg-slate-800 text-right">Horas</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                {detailsData.length > 0 ? (
                                    detailsData.map((item, index) => (
                                        <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                            <td className="py-3 px-4 whitespace-nowrap font-medium text-blue-400">{item.clave}</td>
                                            <td className="py-3 px-4 whitespace-nowrap">{item.assignee_name}</td>
                                            <td className="py-3 px-4 whitespace-nowrap">{selectedMonth}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-right">{Number(item.horas).toFixed(2)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">
                                            No hay registros de horas para este mes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

