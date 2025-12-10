import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Calendar, Home, LogOut, ChevronRight } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import { useFilters } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Footer } from '../Footer';

const SidebarLayout: React.FC = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { selectedMonth, setSelectedMonth } = useFilters();
    const [months, setMonths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectName, setProjectName] = useState<string>('');

    useEffect(() => {
        const fetchMonths = async () => {
            if (!id) return;

            try {
                // Get project data
                const { data: project } = await supabase
                    .from('proyectos')
                    .select('jira_id, nombre')
                    .eq('id', id)
                    .single();

                if (project && (project as any).jira_id) {
                    setProjectName((project as any).nombre || 'Proyecto');

                    // Get available months from v_horas_mes_proyecto
                    const { data: monthData } = await supabase
                        .from('v_horas_mes_proyecto')
                        .select('mes')
                        .eq('proyecto', (project as any).jira_id);

                    if (monthData && monthData.length > 0) {
                        const uniqueMonths = Array.from(new Set(monthData.map((item: any) => {
                            const dateStr = typeof item.mes === 'string' ? item.mes : String(item.mes);
                            return dateStr.substring(0, 7);
                        })));

                        const sortedMonths = uniqueMonths.sort().reverse();
                        setMonths(sortedMonths);

                        if (sortedMonths.length > 0 && !selectedMonth) {
                            setSelectedMonth(sortedMonths[0]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching months:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMonths();
    }, [id, selectedMonth, setSelectedMonth]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex min-h-screen bg-[#0D1B2A]">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 overflow-x-hidden flex flex-col">
                {/* Topbar with Logo, Project Info, and User */}
                <header className="bg-slate-800/40 border-b border-slate-700/30 px-8 py-6 sticky top-0 z-50 backdrop-blur-sm">
                    <div className="flex justify-between items-center">
                        {/* Left: Logo and Breadcrumb */}
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/gpartner_logo.png"
                                    alt="GPartner Logo"
                                    className="h-10 w-auto object-contain"
                                />
                                <div className="h-6 w-px bg-slate-700/40"></div>
                                <span className="text-emerald-500/90 font-medium tracking-wide text-xs uppercase leading-tight">
                                    Technology<br />Partner
                                </span>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 group"
                                >
                                    <Home className="w-4 h-4" />
                                    <span className="text-sm font-medium group-hover:underline">Dashboard</span>
                                </button>
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                                <span className="text-sm font-semibold text-white">{projectName}</span>
                            </div>
                        </div>

                        {/* Right: User Profile and Logout */}
                        <div className="flex items-center gap-6">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-white">{user?.nombre}</p>
                                <p className="text-xs text-emerald-400/80 font-normal">Conectado</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600/90 to-purple-600/90 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-slate-800/50">
                                    {user?.nombre?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                                    title="Cerrar sesión"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Month Filter Bar */}
                <div className="bg-slate-800/40 border-b border-slate-700/30 px-8 py-6 z-40 backdrop-blur-sm mb-8">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <span className="text-slate-400 text-sm font-medium">Período:</span>
                        </div>
                        {loading ? (
                            <div className="text-slate-500 text-sm">Cargando...</div>
                        ) : (
                            <select
                                value={selectedMonth || ''}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-pointer hover:bg-slate-700"
                            >
                                {months.length === 0 && <option value="">No hay meses disponibles</option>}
                                {months.map((month) => (
                                    <option key={month} value={month}>
                                        {new Date(`${month}-15T12:00:00`).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1">
                    <Outlet />
                </div>

                <Footer />
            </main>
        </div>
    );
};

export default SidebarLayout;
