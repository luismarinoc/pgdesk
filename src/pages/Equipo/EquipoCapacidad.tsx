import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
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
    Cell,
    PieChart,
    Pie,
    Legend,
    LabelList
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const EquipoCapacidad: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [consultantData, setConsultantData] = useState<any[]>([]);
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);
    const [totalTeamHours, setTotalTeamHours] = useState(0);
    const [totalTeamTickets, setTotalTeamTickets] = useState(0);

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

                // Fetch Consultant/Team Member Data
                const { data: consultantResult } = await supabase
                    .from('v_issues_mes_proyecto_asignacion')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                const processedData = consultantResult?.map((d: any) => ({
                    name: d.asignado || d.assignee_name || 'Unknown',
                    tickets: Number(d.total_issues) || 0,
                    hours: Number(d.total_horas) || 0,
                    pctTickets: Number(d.porcentaje_issues) || 0,
                    pctHours: Number(d.porcentaje_horas) || 0
                })) || [];

                setConsultantData(processedData);

                // Calculate totals
                const totalH = processedData.reduce((sum, c) => sum + c.hours, 0);
                const totalT = processedData.reduce((sum, c) => sum + c.tickets, 0);
                setTotalTeamHours(totalH);
                setTotalTeamTickets(totalT);

            } catch (error) {
                console.error('Error fetching team data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    const avgHoursPerTicket = totalTeamTickets > 0 ? totalTeamHours / totalTeamTickets : 0;

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
                    <div className="bg-amber-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <Users className="w-8 h-8 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Equipo & Capacidad</h1>
                        <p className="text-slate-400 mt-1">Análisis de rendimiento y distribución del equipo</p>
                    </div>
                </div>

                {/* Team KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Miembros del Equipo</p>
                        <p className="text-4xl font-bold text-white">{consultantData.length}</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Total Horas del Equipo</p>
                        <p className="text-4xl font-bold text-white">{totalTeamHours.toFixed(1)}h</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Promedio h/Ticket</p>
                        <p className="text-4xl font-bold text-white">{avgHoursPerTicket.toFixed(1)}h</p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Workload Distribution by Hours */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Distribución de Horas por Consultor</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={consultantData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    label={({ percent }: any) => `${(percent * 100).toFixed(1)}%`}
                                    outerRadius={90}
                                    fill="#8884d8"
                                    dataKey="hours"
                                    nameKey="name"
                                >
                                    {consultantData.map((entry, index) => (
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
                                    formatter={(value: any) => `${Number(value).toFixed(2)} h`}
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

                    {/* Tickets by Team Member */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                        <h2 className="text-xl font-bold text-white mb-6">Tickets por Consultor</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={consultantData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
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
                                <Bar dataKey="tickets" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="tickets" position="top" fill="#fff" style={{ fontWeight: 'bold' }} />
                                    {consultantData.map((entry, index) => (
                                        <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Detailed Team Performance Table */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Rendimiento Detallado del Equipo</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Consultor</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">% Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Horas</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">% Horas</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Promedio h/t</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Eficiencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consultantData.map((consultant, index) => {
                                    const avgHours = consultant.tickets > 0 ? consultant.hours / consultant.tickets : 0;
                                    const efficiency = avgHoursPerTicket > 0 ? ((avgHoursPerTicket / avgHours) * 100) : 0;
                                    const efficiencyColor = efficiency > 100 ? 'text-emerald-400' : efficiency > 80 ? 'text-amber-400' : 'text-red-400';

                                    return (
                                        <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium">{consultant.name}</td>
                                            <td className="py-3 px-4 text-right text-slate-300">{consultant.tickets}</td>
                                            <td className="py-3 px-4 text-right text-blue-400">{consultant.pctTickets.toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                                                {consultant.hours.toFixed(2)}h
                                            </td>
                                            <td className="py-3 px-4 text-right text-purple-400">{consultant.pctHours.toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-right text-slate-300">
                                                {avgHours.toFixed(2)}h
                                            </td>
                                            <td className={`py - 3 px - 4 text - right font - semibold ${efficiencyColor} `}>
                                                {efficiency > 0 ? `${efficiency.toFixed(0)}% ` : 'N/A'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {consultantData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-6 text-center text-slate-500">
                                            No hay datos del equipo para este período
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {consultantData.length > 0 && (
                                <tfoot className="border-t-2 border-slate-600">
                                    <tr className="font-bold">
                                        <td className="py-3 px-4 text-white">TOTAL</td>
                                        <td className="py-3 px-4 text-right text-slate-300">{totalTeamTickets}</td>
                                        <td className="py-3 px-4 text-right text-blue-400">100%</td>
                                        <td className="py-3 px-4 text-right text-emerald-400">{totalTeamHours.toFixed(2)}h</td>
                                        <td className="py-3 px-4 text-right text-purple-400">100%</td>
                                        <td className="py-3 px-4 text-right text-slate-300">{avgHoursPerTicket.toFixed(2)}h</td>
                                        <td className="py-3 px-4 text-right text-amber-400">Promedio</td>
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

export default EquipoCapacidad;
