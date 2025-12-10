import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { supabase } from '../../lib/supabase';

const Rendimiento: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);

    // Performance metrics
    const [completionRate, setCompletionRate] = useState(0);
    const [avgHoursPerTicket, setAvgHoursPerTicket] = useState(0);
    const [velocity, setVelocity] = useState(0);
    const [efficiency, setEfficiency] = useState(0);
    const [totalTickets, setTotalTickets] = useState(0);
    const [totalHours, setTotalHours] = useState(0);

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!id) return;
            const { data } = await supabase
                .from('proyectos')
                .select('jira_id')
                .eq('id', id)
                .single();
            if (data) {
                setProjectJiraId((data as any).jira_id);
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

                // Fetch status data for completion rate
                const { data: statusResult } = await supabase
                    .from('v_issues_mes_proyecto_estado')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Fetch hours data
                const { data: hoursResult } = await supabase
                    .from('v_horas_mes_proyecto')
                    .select('total_horas')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate)
                    .single();

                // Calculate metrics
                const total = statusResult?.reduce((sum: number, d: any) =>
                    sum + (Number(d.total_issues) || Number(d.total_tickets) || 0), 0) || 0;

                const closedTickets = statusResult?.find((d: any) =>
                    (d.estado || d.status) === 'Cerrado')?.total_issues || 0;

                const rate = total > 0 ? Math.round((closedTickets / total) * 100) : 0;
                const hours = hoursResult?.total_horas || 0;
                const avgHours = total > 0 ? hours / total : 0;

                setTotalTickets(total);
                setTotalHours(hours);
                setCompletionRate(rate);
                setAvgHoursPerTicket(avgHours);
                setVelocity(closedTickets); // Velocity = tickets closed in the period

                // Efficiency: lower avg hours/ticket = higher efficiency
                // Let's say ideal is 1h/ticket, so efficiency = (1 / avgHours) * 100, capped at 100
                const eff = avgHours > 0 ? Math.min((1 / avgHours) * 100, 100) : 0;
                setEfficiency(Math.round(eff));

            } catch (error) {
                console.error('Error fetching performance data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D1B2A]" style={{ padding: '2rem' }}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-white">Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D1B2A]" style={{ padding: '2rem' }}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-pink-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <TrendingUp className="w-8 h-8 text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Rendimiento</h1>
                        <p className="text-slate-400 mt-1">Métricas de eficiencia y calidad del proyecto</p>
                    </div>
                </div>

                {/* Performance KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Completion Rate */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Tasa de Cierre</p>
                        <p className="text-4xl font-bold text-white">{completionRate}%</p>
                        <p className="text-slate-500 text-xs mt-2">Tickets completados</p>
                    </div>

                    {/* Velocity */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Velocidad</p>
                        <p className="text-4xl font-bold text-white">{velocity}</p>
                        <p className="text-slate-500 text-xs mt-2">Tickets cerrados</p>
                    </div>

                    {/* Avg Hours per Ticket */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Promedio h/Ticket</p>
                        <p className="text-4xl font-bold text-white">{avgHoursPerTicket.toFixed(1)}h</p>
                        <p className="text-slate-500 text-xs mt-2">Eficiencia del equipo</p>
                    </div>

                    {/* Efficiency Score */}
                    <div className={`bg-gradient-to-br ${efficiency > 70 ? 'from-pink-500/10 to-pink-600/10 border-pink-500/20' : 'from-amber-500/10 to-amber-600/10 border-amber-500/20'} border rounded-xl`} style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Índice de Eficiencia</p>
                        <p className={`text-4xl font-bold ${efficiency > 70 ? 'text-pink-400' : 'text-amber-400'}`}>
                            {efficiency}%
                        </p>
                        <p className="text-slate-500 text-xs mt-2">Rendimiento global</p>
                    </div>
                </div>

                {/* Performance Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Quality Metrics */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Métricas de Calidad</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-700/20 rounded-lg">
                                <div>
                                    <p className="text-slate-400 text-sm">Total de Tickets</p>
                                    <p className="text-2xl font-bold text-white">{totalTickets}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-sm">Cerrados</p>
                                    <p className="text-2xl font-bold text-emerald-400">{velocity}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-700/20 rounded-lg">
                                <div>
                                    <p className="text-slate-400 text-sm">Total Horas</p>
                                    <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}h</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-sm">Por Ticket</p>
                                    <p className="text-2xl font-bold text-purple-400">{avgHoursPerTicket.toFixed(1)}h</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Indicators */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Indicadores de Rendimiento</h2>
                        <div className="space-y-6">
                            {/* Completion Rate Bar */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-400 text-sm">Tasa de Cierre</span>
                                    <span className="text-white font-semibold">{completionRate}%</span>
                                </div>
                                <div className="w-full bg-slate-700/50 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${completionRate > 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                            completionRate > 50 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                                'bg-gradient-to-r from-amber-500 to-amber-600'
                                            }`}
                                        style={{ width: `${completionRate}%` }}
                                    />
                                </div>
                            </div>

                            {/* Efficiency Bar */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-400 text-sm">Eficiencia</span>
                                    <span className="text-white font-semibold">{efficiency}%</span>
                                </div>
                                <div className="w-full bg-slate-700/50 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${efficiency > 70 ? 'bg-gradient-to-r from-pink-500 to-pink-600' :
                                            efficiency > 40 ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                                                'bg-gradient-to-r from-slate-500 to-slate-600'
                                            }`}
                                        style={{ width: `${efficiency}%` }}
                                    />
                                </div>
                            </div>

                            {/* Velocity Indicator */}
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-400 text-sm font-medium">Velocidad del Sprint</p>
                                        <p className="text-slate-400 text-xs mt-1">Tickets cerrados en el período</p>
                                    </div>
                                    <p className="text-3xl font-bold text-blue-400">{velocity}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '2rem' }}>
                    <h2 className="text-xl font-bold text-white mb-4">Resumen de Rendimiento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <p className="text-slate-400 text-sm mb-2">Estado General</p>
                            <p className={`text-2xl font-bold ${completionRate > 75 && efficiency > 70 ? 'text-emerald-400' :
                                completionRate > 50 || efficiency > 40 ? 'text-amber-400' :
                                    'text-red-400'
                                }`}>
                                {completionRate > 75 && efficiency > 70 ? 'Excelente' :
                                    completionRate > 50 || efficiency > 40 ? 'Bueno' :
                                        'Necesita Mejora'}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-400 text-sm mb-2">Productividad</p>
                            <p className="text-2xl font-bold text-blue-400">
                                {velocity > 10 ? 'Alta' : velocity > 5 ? 'Media' : 'Baja'}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-400 text-sm mb-2">Calidad</p>
                            <p className="text-2xl font-bold text-purple-400">
                                {avgHoursPerTicket < 2 ? 'Óptima' : avgHoursPerTicket < 4 ? 'Buena' : 'Regular'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Rendimiento;
