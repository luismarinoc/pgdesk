import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Clock,
    Target,
    Users,
    TrendingUp,
    Settings,
    ChevronLeft,
    ChevronRight,
    PieChart,
    Layers
} from 'lucide-react';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const location = useLocation();

    // Extract project ID from URL if present
    const pathParts = location.pathname.split('/');
    const projectId = pathParts[1] === 'project' ? pathParts[2] : null;
    const basePath = projectId ? `/project/${projectId}` : '';

    const mainNav = [
        { path: `${basePath}/overview`, icon: LayoutDashboard, label: 'Overview' },
        { path: `${basePath}/analisis`, icon: PieChart, label: 'Análisis Detallado' },
    ];

    const analyticsNav = [
        { path: `${basePath}/horas`, icon: Clock, label: 'Horas & Recursos' },
        { path: `${basePath}/tickets`, icon: Target, label: 'Tickets & Entregas' },
        { path: `${basePath}/equipo`, icon: Users, label: 'Equipo & Capacidad' },
        { path: `${basePath}/rendimiento`, icon: TrendingUp, label: 'Rendimiento' },
    ];

    const settingsNav = [
        { path: `${basePath}/configuracion`, icon: Settings, label: 'Configuración' },
    ];

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ item }: { item: any }) => {
        const active = isActive(item.path);
        const Icon = item.icon;

        return (
            <Link
                to={item.path}
                className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-md mx-3 transition-all duration-200 ease-out
                    ${active
                        ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                    }
                    ${collapsed ? 'justify-center mx-2' : ''}
                `}
                title={collapsed ? item.label : ''}
            >
                <Icon
                    strokeWidth={1.5}
                    className={`
                        w-5 h-5 transition-colors duration-200
                        ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}
                    `}
                />
                {!collapsed && (
                    <span className="text-[14px] font-medium tracking-wide">
                        {item.label}
                    </span>
                )}
                {!collapsed && active && (
                    <div className="ml-auto w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                )}
            </Link>
        );
    };

    return (
        <aside
            className={`
                relative h-screen flex flex-col flex-shrink-0
                bg-[#0A0F16] border-r border-white/5
                transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                ${collapsed ? 'w-20' : 'w-[280px]'}
            `}
        >
            {/* Background Gradient Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />

            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-8 bg-[#0A0F16] border border-white/10 rounded-full p-1 
                         text-slate-400 hover:text-white hover:border-white/20 transition-all duration-200 z-50
                         shadow-lg shadow-black/50"
            >
                {collapsed ? (
                    <ChevronRight size={14} strokeWidth={1.5} />
                ) : (
                    <ChevronLeft size={14} strokeWidth={1.5} />
                )}
            </button>

            {/* Logo Area */}
            <div className={`h-20 flex items-center px-6 ${collapsed ? 'justify-center px-0' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <Layers className="text-white w-5 h-5" strokeWidth={2} />
                </div>
                {!collapsed && (
                    <div className="ml-3">
                        <h1 className="text-white font-semibold tracking-wide text-sm">GPartner</h1>
                        <p className="text-slate-500 text-xs">Analytics</p>
                    </div>
                )}
            </div>

            {/* Scrollable Nav Area */}
            <nav className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-hide">

                {/* Main Section */}
                <div className="space-y-1">
                    {!collapsed && (
                        <h3 className="px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Principal
                        </h3>
                    )}
                    {mainNav.map((item) => <NavItem key={item.path} item={item} />)}
                </div>

                {/* Analytics Section */}
                <div className="space-y-1">
                    {!collapsed && (
                        <h3 className="px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Analítica
                        </h3>
                    )}
                    {analyticsNav.map((item) => <NavItem key={item.path} item={item} />)}
                </div>

                {/* Settings Section */}
                <div className="space-y-1">
                    {!collapsed && (
                        <h3 className="px-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Sistema
                        </h3>
                    )}
                    {settingsNav.map((item) => <NavItem key={item.path} item={item} />)}
                </div>

            </nav>

            {/* User/Footer Area */}
            <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-slate-300">LM</span>
                    </div>
                    {!collapsed && (
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate">Luis Marino</p>
                            <p className="text-xs text-slate-500 truncate">Admin</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
