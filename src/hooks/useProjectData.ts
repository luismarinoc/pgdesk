import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface ProjectAnalyticsData {
    projectInfo: any;
    kpis: any;
    statusData: any[];
    priorityData: any[];
    assigneeData: any[];
    typeData: any[];
    moduleData: any[];
    totalHours: any;
    detailsData: any[];
    calendarIssues: any[];
    topTickets: any[];
    consultantData: any[];
}

const fetchProjectMonths = async (projectId: string | undefined) => {
    if (!projectId) return [];

    // First get the Jira ID
    const { data: project } = await supabase
        .from('proyectos')
        .select('jira_id')
        .eq('id', projectId)
        .single();

    if (!project?.jira_id) return [];

    const { data: monthData } = await supabase
        .from('v_horas_mes_proyecto')
        .select('mes')
        .eq('proyecto', project.jira_id.trim());

    if (!monthData) return [];

    const uniqueMonths = Array.from(new Set(monthData.map((item: any) => {
        const dateStr = typeof item.mes === 'string' ? item.mes : String(item.mes);
        return dateStr.substring(0, 7); // Extract YYYY-MM
    })));

    return uniqueMonths.sort().reverse();
};

const fetchProjectAnalytics = async (projectId: string | undefined, month: string): Promise<ProjectAnalyticsData> => {
    if (!projectId || !month) throw new Error('Project ID and Month are required');

    // 1. Fetch Project Info to get Jira ID
    const { data: project } = await supabase
        .from('proyectos')
        .select('nombre, jira_id, horas_contratadas')
        .eq('id', projectId)
        .single();

    if (!project) throw new Error('Project not found');
    const cleanJiraId = project.jira_id?.trim();
    const monthDate = `${month}-01`;

    // Calculate next month for date ranges
    const [year, monthNum] = month.split('-').map(Number);
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;


    // Parallel Data Fetching
    const [
        kpiResult,
        statusResult,
        priorityResult,
        assigneeResult,
        typeResult,
        moduleResult,
        hoursResult,
        detailsResult,
        calendarResult,
        topTicketsResult
    ] = await Promise.all([
        // 1. KPIs
        supabase
            .from('v_tickets_mes_proyecto')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate)
            .single(),
        // 2. Status
        supabase
            .from('v_issues_mes_proyecto_estado')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate),
        // 3. Priority
        supabase
            .from('v_tickets_mes_proyecto_prioridad_pct')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate),
        // 4. Assignee (Consultant)
        supabase
            .from('v_issues_mes_proyecto_asignacion')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate),
        // 5. Type
        supabase
            .from('v_issues_mes_proyecto_tipo')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate),
        // 6. Module
        supabase
            .from('v_horas_mes_modulo_proyecto')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate),
        // 7. Total Hours
        supabase
            .from('v_horas_mes_proyecto')
            .select('total_horas')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate)
            .single(),
        // 8. Details (Hours Logs)
        supabase
            .from('v_horas_totales_detalles')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate)
            .order('created_at_jira', { ascending: false }),
        // 9. Calendar Issues (Raw)
        supabase
            .from('issues')
            .select('clave, fechacreacion, resumen, estado')
            .eq('proyecto', cleanJiraId)
            .gte('fechacreacion', monthDate)
            .lt('fechacreacion', endDate),
        // 10. Top Tickets
        supabase
            .from('v_horas_totales_por_proyecto_ticket')
            .select('*')
            .eq('proyecto', cleanJiraId)
            .eq('mes', monthDate)
            .order('ticket_horas', { ascending: false })
            .limit(10)
    ]);

    return {
        projectInfo: project,
        kpis: kpiResult.data || null,
        statusData: statusResult.data || [],
        priorityData: priorityResult.data || [],
        assigneeData: assigneeResult.data || [],
        typeData: typeResult.data || [],
        moduleData: moduleResult.data || [],
        totalHours: hoursResult.data || null,
        detailsData: detailsResult.data || [],
        calendarIssues: calendarResult.data || [],
        topTickets: topTicketsResult.data || [],
        consultantData: assigneeResult.data || [] // Duplicate ref for PDF convenience
    };
};

export const useProjectMonths = (projectId: string | undefined) => {
    return useQuery({
        queryKey: ['projectMonths', projectId],
        queryFn: () => fetchProjectMonths(projectId),
        enabled: !!projectId,
        staleTime: 1000 * 60 * 30, // 30 min (months don't change often)
    });
};

export const useActiveIssuesMetadata = (projectId: string | undefined, ticketKeys: string[]) => {
    return useQuery({
        queryKey: ['activeIssuesMetadata', projectId, ticketKeys],
        queryFn: async () => {
            if (!projectId || ticketKeys.length === 0) return [];

            // Need Jira ID to ensure we are querying right project, but 'clave' (Key) is usually unique enough or prefixed?
            // Safer to use keys directly if they are globally unique or sufficiently scoped.
            // But we should filter by project too if possible.
            // The caller handles extracting keys from worklogs which are already project-filtered.

            const { data, error } = await supabase
                .from('issues')
                .select('*')
                .in('clave', ticketKeys);

            if (error) throw error;
            return data || [];
        },
        enabled: !!projectId && ticketKeys.length > 0,
        staleTime: 1000 * 60 * 5 // 5 min
    });
};

export const useProjectData = (projectId: string | undefined, month: string | null) => {
    return useQuery({
        queryKey: ['projectAnalytics', projectId, month],
        queryFn: () => fetchProjectAnalytics(projectId, month!),
        enabled: !!projectId && !!month,
        staleTime: 1000 * 60 * 5, // 5 min
    });
};
