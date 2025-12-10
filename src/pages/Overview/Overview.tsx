import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LayoutDashboard, CheckCircle2, Clock, TrendingUp, Target } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { supabase } from '../../lib/supabase';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
    'Bloqueado': '#ef4444',
    'Cancelado': '#9ca3af',
    'Cerrado': '#10b981',
    'Pruebas de usuario': '#eab308',
    'Trabajo en curso': '#3b82f6'
};

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'Alta': return '#ef4444';
        case 'Media': return '#eab308';
        case 'Baja': return '#3b82f6';
        default: return '#94a3b8';
    }
};

const Overview: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [projectName, setProjectName] = useState('');
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);

    // KPIs
    const [totalTickets, setTotalTickets] = useState(0);
    const [totalHours, setTotalHours] = useState(0);
    const [completionRate, setCompletionRate] = useState(0);
    const [contractedHours, setContractedHours] = useState(0);

    // Charts data
    const [statusData, setStatusData] = useState<any[]>([]);
    const [priorityData, setPriorityData] = useState<any[]>([]);

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!id) return;
            const { data } = await supabase
                .from('proyectos')
                .select('nombre, jira_id, horas_contratadas')
                .eq('id', id)
                .single();
            if (data) {
                setProjectName((data as any).nombre);
                setProjectJiraId((data as any).jira_id);
                setContractedHours(Number((data as any).horas_contratadas) || 0);
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

                // Fetch KPIs
                const { data: statusResult } = await supabase
                    .from('v_issues_mes_proyecto_estado')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                const { data: hoursResult } = await supabase
                    .from('v_horas_mes_proyecto')
                    .select('total_horas')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate)
                    .single();

                const { data: priorityResult } = await supabase
                    .from('v_tickets_mes_proyecto_prioridad_pct')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Calculate totals
                const total = statusResult?.reduce((sum: number, d: any) =>
                    sum + (Number(d.total_issues) || Number(d.total_tickets) || 0), 0) || 0;

                const closedTickets = statusResult?.find((d: any) =>
                    (d.estado || d.status) === 'Cerrado')?.total_issues || 0;

                const rate = total > 0 ? Math.round((closedTickets / total) * 100) : 0;

                setTotalTickets(total);
                setTotalHours(hoursResult?.total_horas || 0);
                setCompletionRate(rate);

                // Process status data for chart
                const processedStatus = statusResult?.map((d: any) => ({
                    name: d.estado || d.status,
                    value: Number(d.total_issues) || Number(d.total_tickets) || 0
                })).filter((d: any) => d.value > 0) || [];

                setStatusData(processedStatus);

                // Process priority data
                setPriorityData(priorityResult?.map((d: any) => ({
                    name: d.priorida || d.prioridad || d.priority || 'Unknown',
                    value: Number(d.total) || Number(d.total_tickets) || 0
                })) || []);

            } catch (error) {
                console.error('Error fetching overview data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    const consumptionPercentage = contractedHours > 0 ? (totalHours / contractedHours) * 100 : 0;

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
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <LayoutDashboard className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{projectName}</h1>
                        <p className="text-slate-400 mt-1">Resumen ejecutivo del proyecto</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Tickets */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-sm">Total Tickets</p>
                            <Target className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-4xl font-bold text-white">{totalTickets}</p>
                    </div>

                    {/* Total Hours */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-sm">Total Horas</p>
                            <Clock className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-4xl font-bold text-white">{totalHours.toFixed(1)}h</p>
                    </div>

                    {/* Completion Rate */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-sm">Tasa de Cierre</p>
                            <CheckCircle2 className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="text-4xl font-bold text-white">{completionRate}%</p>
                    </div>

                    {/* Hour Consumption */}
                    <div className={`bg-gradient-to-br ${consumptionPercentage > 100 ? 'from-red-500/10 to-red-600/10 border-red-500/20' : 'from-amber-500/10 to-amber-600/10 border-amber-500/20'} border rounded-xl`} style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-sm">Consumo</p>
                            <TrendingUp className={`w-5 h-5 ${consumptionPercentage > 100 ? 'text-red-400' : 'text-amber-400'}`} />
                        </div>
                        <p className={`text-4xl font-bold ${consumptionPercentage > 100 ? 'text-red-400' : 'text-white'}`}>
                            {consumptionPercentage.toFixed(0)}%
                        </p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Status Distribution */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Distribución por Estado</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    label={({ percent }: any) => `${(percent * 100).toFixed(1)}%`}
                                    outerRadius={90}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
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
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Priority Distribution */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Distribución por Prioridad</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={priorityData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
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
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                    {priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getPriorityColor(entry.name)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h3 className="text-lg font-semibold text-white mb-2">Horas Contratadas</h3>
                        <p className="text-3xl font-bold text-blue-400">{contractedHours.toFixed(1)}h</p>
                        <p className="text-slate-400 text-sm mt-2">Presupuesto del mes</p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h3 className="text-lg font-semibold text-white mb-2">Tickets Cerrados</h3>
                        <p className="text-3xl font-bold text-emerald-400">
                            {statusData.find(s => s.name === 'Cerrado')?.value || 0}
                        </p>
                        <p className="text-slate-400 text-sm mt-2">De {totalTickets} totales</p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h3 className="text-lg font-semibold text-white mb-2">Promedio h/Ticket</h3>
                        <p className="text-3xl font-bold text-purple-400">
                            {totalTickets > 0 ? (totalHours / totalTickets).toFixed(1) : '0'}h
                        </p>
                        <p className="text-slate-400 text-sm mt-2">Eficiencia del equipo</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Overview;
