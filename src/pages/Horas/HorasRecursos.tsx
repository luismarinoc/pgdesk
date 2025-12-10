import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
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
    LabelList
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const HorasRecursos: React.FC = () => {
    const { id } = useParams();
    const { selectedMonth } = useFilters();
    const [loading, setLoading] = useState(true);
    const [totalHours, setTotalHours] = useState(0);
    const [moduleData, setModuleData] = useState<any[]>([]);
    const [consultantData, setConsultantData] = useState<any[]>([]);
    const [contractedHours, setContractedHours] = useState(0);
    const [projectJiraId, setProjectJiraId] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!id) return;
            const { data } = await supabase
                .from('proyectos')
                .select('jira_id, horas_contratadas')
                .eq('id', id)
                .single();
            if (data) {
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

                // Fetch Total Hours
                const { data: hoursResult } = await supabase
                    .from('v_horas_mes_proyecto')
                    .select('total_horas')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate)
                    .single();

                setTotalHours(hoursResult?.total_horas || 0);

                // Fetch Module Hours
                const { data: moduleResult } = await supabase
                    .from('v_horas_mes_modulo_proyecto')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                setModuleData(moduleResult?.map((d: any) => ({
                    name: d.modulo || d.module || 'Unknown',
                    value: Number(d.total_horas) || 0
                })) || []);

                // Fetch Consultant Hours (from assignee data)
                const { data: consultantResult } = await supabase
                    .from('v_issues_mes_proyecto_asignacion')
                    .select('*')
                    .eq('proyecto', projectJiraId)
                    .eq('mes', monthDate);

                setConsultantData(consultantResult?.map((d: any) => ({
                    name: d.asignado || d.assignee_name || 'Unknown',
                    hours: Number(d.total_horas) || 0,
                    tickets: Number(d.total_issues) || 0
                })) || []);

            } catch (error) {
                console.error('Error fetching hours data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectJiraId, selectedMonth]);

    const consumptionPercentage = contractedHours > 0 ? (totalHours / contractedHours) * 100 : 0;
    const isOverBudget = consumptionPercentage > 100;

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
                    <div className="bg-emerald-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <Clock className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Horas & Recursos</h1>
                        <p className="text-slate-400 mt-1">Análisis profundo de consumo de horas y recursos</p>
                    </div>
                </div>

                {/* KPI Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Hours */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Total de Horas</p>
                        <p className="text-4xl font-bold text-white">{totalHours.toFixed(1)}h</p>
                    </div>

                    {/* Contracted Hours */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl" style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Horas Contratadas</p>
                        <p className="text-4xl font-bold text-white">{contractedHours.toFixed(1)}h</p>
                    </div>

                    {/* Consumption Percentage */}
                    <div className={`bg-gradient-to-br ${isOverBudget ? 'from-red-500/10 to-red-600/10 border-red-500/20' : 'from-purple-500/10 to-purple-600/10 border-purple-500/20'} border rounded-xl`} style={{ padding: '1.5rem' }}>
                        <p className="text-slate-400 text-sm mb-1">Consumo</p>
                        <div className="flex items-end gap-3">
                            <p className={`text-4xl font-bold ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                                {consumptionPercentage.toFixed(1)}%
                            </p>
                            {isOverBudget && (
                                <span className="text-red-400 text-sm pb-1.5">¡Excedido!</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Consumption Progress Bar */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl mb-6" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-4">Progreso de Consumo</h2>
                    <div className="relative w-full bg-slate-700/50 rounded-full h-8 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`}
                            style={{ width: `${Math.min(consumptionPercentage, 100)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                                {totalHours.toFixed(1)}h / {contractedHours.toFixed(1)}h
                            </span>
                        </div>
                    </div>
                    {isOverBudget && (
                        <p className="text-red-400 text-sm mt-3">
                            Horas adicionales: {(totalHours - contractedHours).toFixed(1)}h
                        </p>
                    )}
                </div>

                {/* Module Hours Chart */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl mb-6" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Horas por Módulo</h2>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={moduleData}>
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
                                formatter={(value: any) => [`${Number(value).toFixed(2)}h`, 'Horas']}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    formatter={(val: any) => `${Number(val).toFixed(1)}h`}
                                    fill="#e2e8f0"
                                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                                />
                                {moduleData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Consultant Hours Table */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl" style={{ padding: '1.5rem' }}>
                    <h2 className="text-xl font-bold text-white mb-6">Horas por Consultor</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left text-slate-400 font-medium py-3 px-4">Consultor</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Horas</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Tickets</th>
                                    <th className="text-right text-slate-400 font-medium py-3 px-4">Promedio h/ticket</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consultantData.map((consultant, index) => (
                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                        <td className="py-3 px-4 text-white">{consultant.name}</td>
                                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                                            {consultant.hours.toFixed(2)}h
                                        </td>
                                        <td className="py-3 px-4 text-right text-slate-300">
                                            {consultant.tickets}
                                        </td>
                                        <td className="py-3 px-4 text-right text-slate-400">
                                            {consultant.tickets > 0 ? (consultant.hours / consultant.tickets).toFixed(2) : '0'}h
                                        </td>
                                    </tr>
                                ))}
                                {consultantData.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-slate-500">
                                            No hay datos de consultores para este período
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

export default HorasRecursos;
