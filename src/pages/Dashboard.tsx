import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom'; // Added import
import logo from '../assets/logo.png';
import { Footer } from '../components/Footer';

interface Project {
    id: string;
    nombre: string;
    descripcion: string;
    estado: string;
}

export const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); // Initialize hook
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user?.correo) return;

            try {
                const { data, error } = await supabase
                    .from('usuarios_proyectos')
                    .select(`
                        proyecto_id,
                        proyectos (
                            id,
                            nombre,
                            descripcion,
                            estado
                        )
                    `)
                    .eq('usuario_correo', user.correo)
                    .eq('activo', true);

                if (error) throw error;

                // Transform data to match Project interface
                const formattedProjects = data
                    .map((item: any) => item.proyectos)
                    .flat()
                    .filter((p: any) => p && p.estado === 'activo');
                setProjects(formattedProjects);
            } catch (err) {
                console.error('Error fetching projects:', err);
                setError('No se pudieron cargar los proyectos asignados.');
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, [user]);

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="min-h-screen bg-[#0D1B2A] font-['Inter']">
            {/* Header */}
            <header className="bg-[#0D1B2A] border-b border-slate-700/30 sticky top-0 z-50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo and Title */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/gpartner_logo.png"
                                    alt="GPartner Logo"
                                    className="h-10 w-auto object-contain"
                                />
                                <div className="h-6 w-px bg-slate-700/40 mx-2"></div>
                                <span className="text-emerald-500/90 font-medium tracking-wide text-xs uppercase">Technology<br />Partner</span>
                            </div>
                            <h1 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-500/80 to-purple-600/80 ml-6">
                                Dashboard
                            </h1>
                        </div>

                        {/* User Profile */}
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
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12 py-16">
                {/* Welcome Section */}
                <div className="mb-20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                        <h2 className="text-2xl font-bold text-white">Mis Proyectos Asignados</h2>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-slate-800 h-64 rounded-xl animate-pulse border border-slate-700"></div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-6 rounded-xl">
                        {error}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-slate-700/40 border-dashed">
                        <p className="text-slate-400 text-base">No tienes proyectos asignados actualmente.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => navigate(`/project/${project.id}`)}
                                className="group bg-slate-800/40 border border-slate-700/40 hover:border-blue-500/30 rounded-xl transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-blue-500/20 cursor-pointer relative overflow-hidden hover:-translate-y-1"
                                style={{
                                    transform: 'translateY(0)',
                                    paddingLeft: '2rem',
                                    paddingRight: '2rem',
                                    paddingTop: '2rem',
                                    paddingBottom: '2rem'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    if (rect.width >= 768) { // md breakpoint
                                        e.currentTarget.style.paddingLeft = '3rem';
                                        e.currentTarget.style.paddingRight = '3rem';
                                        e.currentTarget.style.paddingTop = '3rem';
                                        e.currentTarget.style.paddingBottom = '3rem';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.paddingLeft = '2rem';
                                    e.currentTarget.style.paddingRight = '2rem';
                                    e.currentTarget.style.paddingTop = '2rem';
                                    e.currentTarget.style.paddingBottom = '2rem';
                                }}
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <h3 className="text-xl font-semibold text-white group-hover:text-blue-400/90 transition-colors duration-300 truncate pr-2">
                                        {project.nombre}
                                    </h3>
                                    <div className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wide shrink-0 ${project.estado === 'activo'
                                        ? 'bg-emerald-500/5 text-emerald-400/90 border border-emerald-500/10'
                                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                                        }`}>
                                        {project.estado}
                                    </div>
                                </div>
                                <p className="text-slate-400/90 text-sm leading-relaxed line-clamp-2 mb-12 min-h-[2.5rem]">
                                    {project.descripcion || 'Sin descripción'}
                                </p>
                                <div className="flex items-center text-sm text-blue-400/90 font-medium group-hover:gap-2 transition-all duration-300">
                                    Ver detalles
                                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <div className="mt-auto">
                <Footer />
            </div>
        </div>
    );
};
