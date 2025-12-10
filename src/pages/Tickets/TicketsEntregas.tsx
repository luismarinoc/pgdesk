import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Target, CheckCircle2, XCircle, AlertCircle, Clock, HelpCircle } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { supabase } from '../../lib/supabase';
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

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string; chartColor: string }> = {
    'Bloqueado': { color: 'text-red-500', icon: XCircle, label: 'Bloqueado', chartColor: '#ef4444' },
    'Cancelado': { color: 'text-gray-400', icon: AlertCircle, label: 'Cancelado', chartColor: '#9ca3af' },
    'Cerrado': { color: 'text-green-500', icon: CheckCircle2, label: 'Cerrado', chartColor: '#10b981' },
    'Pruebas de usuario': { color: 'text-yellow-500', icon: AlertCircle, label: 'Pruebas de usuario', chartColor: '#eab308' },
    'Trabajo en curso': { color: 'text-blue-500', icon: Clock, label: 'Trabajo en curso', chartColor: '#3b82f6' }
};

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'Alta': return '#ef4444';
        case 'Media': return '#eab308';
        case 'Baja': return '#3b82f6';
        default: return '#94a3b8';
    }
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const TicketsEntregas: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState<any[]>([]);
    const [priorityData, setPriorityData] = useState<any[]>([]);
    const [typeData, setTypeData] = useState<any[]>([]);
    const [totalTickets, setTotalTickets] = useState(0);
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjectJiraId = async () => {
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
        fetchProjectJiraId();
    }, [id]);

    useEffect(() => {
        const fetchData = async () => {
            if (!projectJiraId || !selectedMonth) return;

            setLoading(true);
            try {
                const monthDate = `${selectedMonth}-01`;

                // Fetch Status Data
                const { data: statusResult } = await supabase
                    .from('v_issues_mes_proyecto_estado')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Fetch Priority Data
                const { data: priorityResult } = await supabase
                    .from('v_tickets_mes_proyecto_prioridad_pct')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Fetch Type Data
                const { data: typeResult } = await supabase
                    .from('v_issues_mes_proyecto_tipo')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                // Process Status Data
                const FIXED_STATUSES = ['Bloqueado', 'Cancelado', 'Cerrado', 'Pruebas de usuario', 'Trabajo en curso'];
                const statusMap = new Map(statusResult?.map((d: any) => [d.estado || d.status, Number(d.total_issues) || Number(d.total_tickets)]) || []);

                const mergedStatusData = FIXED_STATUSES.map(status => {
                    const config = STATUS_CONFIG[status] || { color: 'text-slate-400', icon: HelpCircle, label: status, chartColor: '#94a3b8' };
                    return {
                        name: status,
                        value: statusMap.get(status) || 0,
                        ...config
                    };
                });

                const total = statusResult?.reduce((sum: number, d: any) => sum + (Number(d.total_issues) || Number(d.total_tickets) || 0), 0) || 0;

                setStatusData(mergedStatusData);
                setTotalTickets(total);

                // Process Priority Data
                setPriorityData(priorityResult?.map((d: any) => ({
                    name: d.priorida || d.prioridad || d.priority || 'Unknown',
                    value: Number(d.total) || Number(d.total_tickets) || 0,
                    pct: d.pct_mes || 0
                })) || []);

                // Process Type Data
                setTypeData(typeResult?.map((d: any) => ({
                    name: d.issuetype || d.tipo || d.type || 'Unknown',
                    value: Number(d.total_issues) || Number(d.total) || Number(d.cantidad) || 0
                })) || []);

            } catch (error) {
                console.error('Error fetching tickets data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    const renderCustomLabel = (props: any) => {
        const { x, y, width, value, index } = props;
        const item = priorityData[index];
        return (
            <text x={x + width + 5} y={y + 15} fill="#e2e8f0" fontSize="14" fontWeight="600">
                {value} ({item?.pct}%)
            </text>
        );
    };

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
                    <div className="bg-purple-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <Target className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Tickets & Entregas</h1>
                        <p className="text-slate-400 mt-1">Monitoreo del flujo de trabajo y entregas</p>
                    </div>
                </div>

                {/* KPI Card */}
                <div className="mb-8">
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">Total de Tickets</p>
                                <p className="text-4xl font-bold text-white">{totalTickets}</p>
                            </div>
                            <Target className="w-12 h-12 text-purple-400/50" />
                        </div>
                    </div>
                </div>

                {/* Status Chart */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl mb-6" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Tickets por Estado</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Chart */}
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} />
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
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                        <LabelList dataKey="value" position="right" fill="#fff" formatter={(val: any) => val} />
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.chartColor} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-col justify-center space-y-4">
                            {statusData.map((item) => {
                                const Icon = item.icon;
                                const percentage = totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0';
                                return (
                                    <div key={item.name} className="flex items-center justify-between bg-slate-700/20 rounded-lg p-4">
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-5 h-5 ${item.color}`} />
                                            <span className="text-slate-300 font-medium">{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-white font-bold text-lg">{item.value}</span>
                                            <span className="text-slate-400 text-sm w-12 text-right">{percentage}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Priority and Type Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Priority Chart */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Tickets por Prioridad</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={priorityData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
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
                                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                    <LabelList dataKey="value" content={renderCustomLabel} />
                                    {priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getPriorityColor(entry.name)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Type Chart */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Tickets por Tipo</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    label={({ percent }: any) => `${(percent * 100).toFixed(1)}%`}
                                    outerRadius={90}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {typeData.map((entry, index) => (
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
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketsEntregas;
