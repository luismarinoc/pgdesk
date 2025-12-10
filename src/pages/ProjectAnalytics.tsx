import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjectData, useProjectMonths } from '../hooks/useProjectData';
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
    FileText,
    ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import * as XLSX from 'xlsx';
import logo from '../assets/logo-new.png';
import { Footer } from '../components/Footer';

// Helper functions
const getStatusIcon = (status: string) => {
    switch (status) {
        case 'Cerrado': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        case 'En Progreso': return <Clock className="w-5 h-5 text-blue-500" />;
        case 'Bloqueado': return <XCircle className="w-5 h-5 text-red-500" />;
        case 'Pruebas de usuario': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        default: return <HelpCircle className="w-5 h-5 text-slate-500" />;
    }
};


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
    const { user } = useAuth();

    // UI State
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

    // 1. Fetch Months
    const { data: months = [], isLoading: monthsLoading } = useProjectMonths(projectId);

    // Auto-select first month
    useEffect(() => {
        if (months && months.length > 0 && !selectedMonth) {
            setSelectedMonth(months[0]);
        }
    }, [months, selectedMonth]);

    // 2. Fetch Project Data
    const { data, isLoading: dataLoading } = useProjectData(projectId, selectedMonth);
    const loading = monthsLoading || dataLoading;

    // Derived Data (Memoized)
    const dashboardData = useMemo(() => {
        if (!data) return null;

        const {
            statusData,
            priorityData,
            assigneeData,
            typeData,
            moduleData,
            totalHours
        } = data;

        const FIXED_STATUSES = [
            'Bloqueado',
            'Cancelado',
            'Cerrado',
            'Pruebas de usuario',
            'Trabajo en curso'
        ];

        const statusMap = new Map(statusData?.map((d: any) => [d.estado || d.status, Number(d.total_issues) || Number(d.total_tickets)]) || []);

        const mergedStatusData = FIXED_STATUSES.map(status => {
            const config = STATUS_CONFIG[status] || { color: 'text-slate-400', icon: HelpCircle, label: status };
            return {
                name: status,
                value: statusMap.get(status) || 0,
                ...config
            };
        });

        // Calculate Completion Rate
        const totalTickets = statusData?.reduce((sum: number, d: any) => sum + (Number(d.total_issues) || Number(d.total_tickets) || 0), 0) || 0;
        const closedTickets = statusMap.get('Cerrado') || 0;
        const completionRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

        return {
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

            type: typeData?.map((d: any) => ({
                name: d.issuetype || d.tipo || d.type || 'Unknown',
                value: Number(d.total_issues) || Number(d.total) || Number(d.cantidad) || 0
            })) || [],

            module: moduleData?.map((d: any) => ({
                name: d.modulo || d.module || 'Unknown',
                value: Number(d.total_horas) || 0
            })) || [],

            kpis: {
                totalTickets: totalTickets,
                totalHours: totalHours?.total_horas || 0,
                completionRate: completionRate
            }
        };
    }, [data]);

    // Derived vars for PDF/Download to maintain compatibility
    const detailsData = data?.detailsData || [];
    const issuesData = data?.calendarIssues || [];
    const topTicketsData = data?.topTickets || [];
    const consultantData = data?.assigneeData || [];

    // Project Info
    const projectName = data?.projectInfo?.nombre || '';
    const projectContractedHours = Number(data?.projectInfo?.horas_contratadas) || 50;

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

    const generatePDF = async () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const primaryColor: [number, number, number] = [52, 152, 219]; // Lighter Blue (User requested)
        const secondaryColor: [number, number, number] = [52, 73, 94]; // Dark Slate
        const accentColor: [number, number, number] = [230, 126, 34]; // Orange

        // Helper: Load Image with dimensions
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
                    // Calculate aspect ratio
                    const maxHeight = 12; // Reduced from 20 to 12
                    const ratio = logoData.width / logoData.height;
                    const logoHeight = maxHeight;
                    const logoWidth = maxHeight * ratio;

                    const logoX = margin;
                    const logoY = 9; // Centered vertically: (30 - 12) / 2 = 9

                    doc.addImage(logoData.data, 'PNG', logoX, logoY, logoWidth, logoHeight);

                    // Adjust title offset based on logo width
                    titleXOffset += logoWidth + 10;
                } catch (error) {
                    console.warn('Could not add logo to PDF:', error);
                }
            }

            // Title
            doc.setFontSize(16); // Reduced from 18 to 16 to save space
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            // Center text vertically relative to the 30-unit header
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

        // --- PAGE 1: EXECUTIVE SUMMARY ---
        addHeader("Resumen Ejecutivo");

        let yPos = 40; // Increased from 35 to 40 for better spacing

        // 1. KPIs Row
        const kpiGap = 15; // Increased gap between cards
        const kpiWidth = (pageWidth - (margin * 2) - (kpiGap * 2)) / 3;
        const kpiHeight = 30; // Increased height for better breathing room

        const kpis = [
            { label: "Total Tickets", value: dashboardData?.kpis?.totalTickets || 0, color: [52, 152, 219] },
            { label: "Horas Totales", value: `${Number(dashboardData?.kpis?.totalHours || 0).toFixed(1)}h`, color: [46, 204, 113] },
            { label: "Tasa de Cierre", value: dashboardData?.kpis?.completionRate || "0%", color: [155, 89, 182] }
        ];

        kpis.forEach((kpi, i) => {
            const x = margin + (i * (kpiWidth + kpiGap));
            // @ts-ignore
            doc.setFillColor(...kpi.color);
            doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 3, 3, 'F'); // Increased corner radius

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11); // Increased font size
            doc.text(kpi.label, x + 6, yPos + 10);
            doc.setFontSize(16); // Increased value size
            doc.setFont("helvetica", "bold");
            doc.text(String(kpi.value), x + 6, yPos + 22);
        });

        yPos += kpiHeight + 10; // Reduced spacing after KPIs

        // 2. Billing Section
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Estado de Facturación", margin, yPos);
        yPos += 6;

        const contractedHours = projectContractedHours;
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
            headStyles: { fillColor: secondaryColor, fontSize: 11, cellPadding: 6 },
            styles: { fontSize: 10, cellPadding: 6 }, // Increased padding
            columnStyles: { 0: { fontStyle: 'bold' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15; // Reduced spacing

        // 3. Status Summary
        doc.text("Resumen por Estado", margin, yPos);
        yPos += 6;

        const statusRows = dashboardData?.status.map((s: any) => [s.name, s.value, `${((s.value / (dashboardData?.kpis?.totalTickets || 1)) * 100).toFixed(1)}%`]) || [];

        autoTable(doc, {
            startY: yPos,
            head: [['Estado', 'Cantidad', '%']],
            body: statusRows,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, fontSize: 11, cellPadding: 6 },
            styles: { fontSize: 10, cellPadding: 6 }, // Increased padding
            margin: { left: margin, right: margin },
            pageBreak: 'avoid'
        });

        addFooter(1);

        // --- PAGE 2: DETAILED METRICS ---
        doc.addPage();
        addHeader("Métricas Detalladas");
        yPos = 45;

        // 1. Priority Breakdown
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Desglose por Prioridad", margin, yPos);
        yPos += 6;

        const priorityRows = dashboardData?.priority.map((p: any) => [p.name, p.value, `${Number(p.pct).toFixed(1)}%`]) || [];
        const totalPriorityTickets = priorityRows.reduce((sum: number, row: any) => sum + (Number(row[1]) || 0), 0);

        // Add Total Row
        priorityRows.push(['TOTAL', totalPriorityTickets, '100%']);

        autoTable(doc, {
            startY: yPos,
            head: [['Prioridad', 'Tickets', '%']],
            body: priorityRows,
            theme: 'grid',
            headStyles: { fillColor: accentColor, fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
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

        doc.text("Desglose por Tipo", pageWidth / 2 + 5, 45);
        const typeRows = dashboardData?.type.map((t: any) => [t.name, t.value]) || [];

        autoTable(doc, {
            startY: 55, // Adjusted startY
            head: [['Tipo', 'Tickets']],
            body: typeRows,
            theme: 'grid',
            headStyles: { fillColor: secondaryColor, fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            margin: { left: pageWidth / 2 + 5, right: margin },
            tableWidth: (pageWidth - (margin * 3)) / 2
        });

        // @ts-ignore
        const finalYType = doc.lastAutoTable.finalY;
        yPos = Math.max(finalYPriority, finalYType) + 15; // Reduced spacing

        // Consultant Performance Section
        let nextY = yPos;

        doc.setFontSize(14);
        doc.setTextColor(52, 152, 219);
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
            startY: nextY + 10,
            head: [['Consultor', 'Tickets', 'Horas', '% Tickets', '% Horas']],
            body: formattedConsultantRows,
            theme: 'striped',
            headStyles: { fillColor: [52, 152, 219], fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
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
        yPos = 45;

        // 1. Top Tickets
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Top 5 Tickets (Mayor Consumo)", margin, yPos);
        yPos += 6;

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
            headStyles: { fillColor: [231, 76, 60], fontSize: 11, cellPadding: 5 },
            styles: { fontSize: 10, cellPadding: 5 },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 30, halign: 'right' } },
            margin: { left: margin, right: margin }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15; // Reduced spacing

        // 2. Daily Activity Calendar (Mini version)
        if (yPos + 60 < pageHeight) {
            doc.text("Actividad Diaria (Tickets Creados)", margin, yPos);
            yPos += 6;

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
        yPos = 45;

        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Registro Detallado de Actividades", margin, yPos);
        yPos += 6;

        // Map detailsData to table rows
        // Assuming detailsData has: created_at_jira (date), clave (ticket), assignee_name (consultant), horas (hours), comentario (comment)

        // 1. Sort by Consultant, then Ticket (Numeric)
        const sortedDetails = [...detailsData].sort((a: any, b: any) => {
            const consultantA = a.assignee_name || a.asignado || '';
            const consultantB = b.assignee_name || b.asignado || '';
            if (consultantA !== consultantB) return consultantA.localeCompare(consultantB);

            const ticketA = a.clave || '';
            const ticketB = b.clave || '';

            // Extract numeric part from key (e.g., "BASH-1004" -> 1004)
            const matchA = ticketA.match(/-(\d+)$/);
            const matchB = ticketB.match(/-(\d+)$/);

            if (matchA && matchB) {
                const numA = parseInt(matchA[1], 10);
                const numB = parseInt(matchB[1], 10);
                if (numA !== numB) return numA - numB;
            }

            return ticketA.localeCompare(ticketB);
        });

        // 2. Group and Calculate Subtotals
        const groupedRows: any[] = [];
        let currentConsultant = '';
        let consultantTotal = 0;
        let grandTotal = 0;

        sortedDetails.forEach((d: any) => {
            const consultant = d.assignee_name || d.asignado || 'Sin Asignar';
            const hours = Number(d.horas) || 0;
            const ticket = d.clave || '';
            // Date removed as requested

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

        // Add Grand Total
        groupedRows.push([
            '',
            'TOTAL GENERAL',
            `${grandTotal.toFixed(2)} h`
        ]);

        // @ts-ignore
        const startPageHours = doc.internal.getNumberOfPages();

        autoTable(doc, {
            startY: yPos,
            head: [['Ticket', 'Consultor', 'Horas']],
            body: groupedRows,
            theme: 'striped',
            headStyles: { fillColor: secondaryColor, fontSize: 10, cellPadding: 4 },
            styles: { fontSize: 9, cellPadding: 4 }, // Increased font and padding
            columnStyles: {
                0: { cellWidth: 40 }, // Ticket
                1: { cellWidth: 100 }, // Consultor
                2: { cellWidth: 25, halign: 'right' } // Horas
            },
            margin: { left: margin, right: margin, top: 40 }, // Added top margin for header space on new pages
            didDrawPage: (data) => {
                // Add header to new pages generated by this table
                if (data.pageNumber > startPageHours) {
                    addHeader("Detalle de Horas");
                }
            },
            didParseCell: (data) => {
                const rawRow = data.row.raw as string[];
                const consultantCell = rawRow[1];

                // Style Subtotal rows
                if (consultantCell && consultantCell.startsWith('Subtotal')) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [220, 220, 220]; // Distinct Light Gray
                    data.cell.styles.textColor = [0, 0, 0];
                }

                // Style Grand Total row
                if (consultantCell === 'TOTAL GENERAL') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [52, 152, 219]; // Lighter Blue (Primary)
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

    // Group and Sort Details Data
    const groupedDetails = useMemo(() => {
        if (!detailsData) return [];

        // 1. Sort by Assignee, then Ticket Key (Numeric)
        const sorted = [...detailsData].sort((a, b) => {
            const assigneeA = (a.assignee_name || a.asignado || 'Sin Asignar').toLowerCase();
            const assigneeB = (b.assignee_name || b.asignado || 'Sin Asignar').toLowerCase();
            if (assigneeA !== assigneeB) return assigneeA.localeCompare(assigneeB);

            // If same assignee, sort by Ticket Key (Numeric if possible)
            const keyA = a.clave || '';
            const keyB = b.clave || '';

            // Extract numeric part from key (e.g., "BASH-1004" -> 1004)
            const matchA = keyA.match(/-(\d+)$/);
            const matchB = keyB.match(/-(\d+)$/);

            if (matchA && matchB) {
                const numA = parseInt(matchA[1], 10);
                const numB = parseInt(matchB[1], 10);
                if (numA !== numB) return numA - numB;
            }

            // Fallback to string compare if parsing fails
            return keyA.localeCompare(keyB);
        });

        // 2. Group by Assignee
        const groups: { assignee: string; tickets: any[]; totalHours: number }[] = [];
        let currentAssignee = '';
        let currentGroup: any = null;

        sorted.forEach(item => {
            const assignee = item.assignee_name || item.asignado || 'Sin Asignar';

            if (assignee !== currentAssignee) {
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentAssignee = assignee;
                currentGroup = {
                    assignee: assignee,
                    tickets: [],
                    totalHours: 0
                };
            }

            if (currentGroup) {
                currentGroup.tickets.push(item);
                currentGroup.totalHours += Number(item.horas) || 0;
            }
        });

        if (currentGroup) {
            groups.push(currentGroup);
        }

        return groups;
    }, [detailsData]);

    if (loading && !dashboardData && months.length === 0) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-[#0D1B2A] font-['Inter']">
            {/* Header */}
            <header className="bg-[#0D1B2A] border-b border-slate-700/30 sticky top-0 z-50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-800/50"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm font-normal hidden sm:inline">Dashboard</span>
                            </button>
                            <div className="h-6 w-px bg-slate-700/40 mx-2"></div>
                            <div className="flex items-center gap-3">
                                <img
                                    src="/gpartner_logo.png"
                                    alt="GPartner Logo"
                                    className="h-7 w-auto object-contain"
                                />
                                <div className="h-5 w-px bg-slate-700/40 mx-2"></div>
                                <h1 className="text-xl font-semibold text-white">
                                    {projectName || 'Cargando...'}
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* Project Selector */}
                            <div className="relative">
                                <select
                                    value={selectedMonth || ''}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="appearance-none bg-slate-800/50 border border-slate-700/50 text-white py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-medium shadow-sm transition-all duration-200"
                                >
                                    {months.map(month => (
                                        <option key={month} value={month}>
                                            {/* Format YYYY-MM to MonthName YYYY safely avoiding timezone rollover */}
                                            {new Date(`${month}-15T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>

                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-white">{user?.nombre}</p>
                                <p className="text-xs text-emerald-400/80 font-normal">Conectado</p>
                            </div>
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600/90 to-purple-600/90 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-slate-800/50">
                                {user?.nombre?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12 py-16">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {/* Total Tickets Card */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md relative overflow-hidden group hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                        </div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">TOTAL TICKETS</h3>
                        </div>
                        <p className="text-5xl font-bold text-white relative z-10">{dashboardData?.kpis.totalTickets}</p>
                    </div>

                    {/* Total Hours Card */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md relative overflow-hidden group hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                            <svg className="w-24 h-24 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
                        </div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">HORAS TOTALES</h3>
                        </div>
                        <p className="text-5xl font-bold text-emerald-400/90 relative z-10">{dashboardData?.kpis.totalHours.toFixed(2)}h</p>
                    </div>

                    {/* Closure Rate Card */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md relative overflow-hidden group hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                            <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                        </div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">TASA DE CIERRE</h3>
                        </div>
                        <p className="text-5xl font-bold text-blue-400/90 relative z-10">{dashboardData?.kpis.completionRate}%</p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div id="charts-container" className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Tickets by Status */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                        <h3 className="text-lg font-bold mb-6 text-white">Tickets por Estado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {dashboardData?.status.map((item: any) => {
                                // Determine colors based on status
                                let colorClass = 'text-slate-400';
                                let borderClass = 'border-slate-700';
                                let iconBgClass = 'bg-slate-800';
                                let bgGradient = 'bg-gradient-to-br from-slate-800 to-slate-900';

                                if (item.name === 'Bloqueado') {
                                    colorClass = 'text-red-500';
                                    iconBgClass = 'bg-red-500/10';
                                    borderClass = 'border-red-500/30';
                                    bgGradient = 'bg-gradient-to-br from-slate-800 to-red-900/10';
                                } else if (item.name === 'Cerrado') {
                                    colorClass = 'text-emerald-500';
                                    iconBgClass = 'bg-emerald-500/10';
                                    borderClass = 'border-emerald-500/30';
                                    bgGradient = 'bg-gradient-to-br from-slate-800 to-emerald-900/10';
                                } else if (item.name === 'Pruebas de usuario') {
                                    colorClass = 'text-yellow-500';
                                    iconBgClass = 'bg-yellow-500/10';
                                    borderClass = 'border-yellow-500/30';
                                    bgGradient = 'bg-gradient-to-br from-slate-800 to-yellow-900/10';
                                } else if (item.name === 'Trabajo en curso') {
                                    colorClass = 'text-blue-500';
                                    iconBgClass = 'bg-blue-500/10';
                                    borderClass = 'border-blue-500/30';
                                    bgGradient = 'bg-gradient-to-br from-slate-800 to-blue-900/10';
                                } else if (item.name === 'Cancelado') {
                                    colorClass = 'text-slate-400';
                                    iconBgClass = 'bg-slate-700/50';
                                    borderClass = 'border-slate-600';
                                }

                                return (
                                    <div key={item.name} className={`rounded-xl border ${borderClass} ${bgGradient} relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-lg flex items-center justify-between`} style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                                        <div className="flex flex-col gap-4 z-10">
                                            <span className={`text-sm font-bold uppercase tracking-wider ${colorClass}`}>
                                                {item.name}
                                            </span>
                                            <span className="text-5xl font-bold text-white tracking-tight">{item.value}</span>
                                        </div>

                                        <div className={`p-4 rounded-full ${iconBgClass} ${colorClass} flex items-center justify-center z-10`}>
                                            {React.cloneElement(getStatusIcon(item.name), { className: "w-8 h-8" })}
                                        </div>
                                    </div>
                                );

                            })}
                        </div>
                    </div>

                    {/* Tickets by Priority */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                        <h3 className="text-lg font-bold mb-6 text-white">Tickets por Prioridad</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dashboardData?.priority} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(51, 65, 85, 0.4)' }}
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '2px solid #3b82f6',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                                        }}
                                        labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                        {dashboardData?.priority.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                        <LabelList dataKey="pct" position="top" formatter={(value: any) => `${value}%`} style={{ fill: '#94a3b8', fontSize: '12px', fontWeight: '600' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tickets by Type */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                        <h3 className="text-lg font-bold mb-6 text-white">Tickets por Tipo</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dashboardData?.type}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ percent }: any) => `${(percent * 100).toFixed(2)}%`}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name"
                                    >
                                        {dashboardData?.type.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '2px solid #3b82f6',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                                        }}
                                        labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-slate-300 text-sm ml-2">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Hours by Module */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 shadow-md" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                        <h3 className="text-lg font-bold mb-6 text-white">Horas por Módulo</h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={dashboardData?.module}
                                    margin={{ top: 20, right: 50, left: 100, bottom: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={90}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(51, 65, 85, 0.4)' }}
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '2px solid #3b82f6',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                                        }}
                                        labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#fff', formatter: (value: any) => `${value}%` }}>
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Assignee Chart */}
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 lg:col-span-2 shadow-md" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
                        <h3 className="text-lg font-bold mb-6 text-white">Tickets por Asignado</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dashboardData?.assignee} margin={{ top: 20, right: 40, left: 40, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        interval={0}
                                        angle={-25}
                                        textAnchor="end"
                                        height={60}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '2px solid #3b82f6',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                                        }}
                                        labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        cursor={{ fill: 'rgba(51, 65, 85, 0.4)', opacity: 0.5 }}
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
                                    <Bar dataKey="tickets" radius={[8, 8, 0, 0]}>
                                        <LabelList
                                            dataKey="pctIssues"
                                            position="top"
                                            formatter={(val: any) => `${Number(val).toFixed(1)}%`}
                                            fill="#e2e8f0"
                                            style={{ fontSize: '11px', fontWeight: 'bold' }}
                                        />
                                        {dashboardData?.assignee?.map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Detailed Hours Table */}
                {/* Detailed Hours Table */}
                <div className="mt-8 bg-slate-800 rounded-xl border border-slate-700 shadow-lg" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-white">Detalle de Horas</h3>
                            <div className="bg-slate-900 px-6 py-3 rounded-full text-lg border border-slate-700">
                                <span className="text-slate-400 mr-3">Total:</span>
                                <span className="font-bold text-emerald-400">{totalHoursDetails.toFixed(2)}h</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <button
                                onClick={generatePDF}
                                className="flex items-center justify-center gap-2 bg-blue-600/90 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 w-full sm:w-auto"
                            >
                                <FileText className="w-4 h-4" />
                                Generar PDF
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={!detailsData || detailsData.length === 0}
                                className="flex items-center justify-center gap-2 border border-slate-600/50 hover:border-slate-500 bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium active:scale-95 w-full sm:w-auto"
                            >
                                <Download className="w-4 h-4" />
                                Exportar Excel
                            </button>
                        </div>
                    </div>


                    <div className="overflow-hidden border border-slate-700 rounded-xl bg-slate-800/50 backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                                    <tr className="border-b border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider">
                                        <th className="py-4 px-6 whitespace-nowrap">Clave</th>
                                        <th className="py-4 px-6 whitespace-nowrap">Asignado</th>
                                        <th className="py-4 px-6 whitespace-nowrap hidden sm:table-cell">Mes</th>
                                        <th className="py-4 px-6 whitespace-nowrap text-right">Horas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {groupedDetails.length > 0 ? (
                                        groupedDetails.map((group, groupIndex) => (
                                            <React.Fragment key={group.assignee}>
                                                {/* Map through tickets in the group */}
                                                {group.tickets.map((row: any, rowIndex: number) => (
                                                    <tr key={`${groupIndex}-${rowIndex}`} className="hover:bg-slate-700/30 transition-colors duration-150 even:bg-slate-800/20">
                                                        <td className="py-4 px-6 text-blue-400/90 font-medium">{row.clave}</td>
                                                        <td className="py-4 px-6 text-slate-300">{row.assignee_name || row.asignado}</td>
                                                        <td className="py-4 px-6 text-slate-400 hidden sm:table-cell">{selectedMonth}</td>
                                                        <td className="py-4 px-6 text-right font-mono text-slate-300">{Number(row.horas).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                {/* Subtotal Row */}
                                                <tr className="bg-slate-800/80 font-semibold text-slate-200">
                                                    <td colSpan={1} className="py-3 px-6 text-right hidden sm:table-cell"></td>
                                                    <td colSpan={2} className="py-3 px-6 text-left text-emerald-400">Total {group.assignee}:</td>
                                                    <td className="py-3 px-6 text-right font-mono text-emerald-400 border-t border-slate-600/50">
                                                        {group.totalHours.toFixed(2)}h
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-500">
                                                No hay datos disponibles para el mes seleccionado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
            <div className="mt-auto pt-12">
                <Footer />
            </div>
        </div >
    );
};

