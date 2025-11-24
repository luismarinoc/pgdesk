import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.png';

interface Project {
    id: string;
    nombre: string;
    descripcion: string;
    estado: string;
}

export const Dashboard = () => {
    const { user, logout } = useAuth();
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

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-4">
                        <img
                            src={logo}
                            alt="GPDesk Logo"
                            className="h-12 object-contain"
                        />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-white font-medium">{user?.nombre}</p>
                            <p className="text-slate-400 text-xs">Conectado</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            {user?.nombre?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <button
                            onClick={logout}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg transition-colors border border-slate-700"
                            title="Cerrar Sesión"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </header>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                        Mis Proyectos Asignados
                    </h2>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-slate-800/50 h-32 rounded-lg animate-pulse border border-slate-700/50"></div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
                            {error}
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-700/50 border-dashed">
                            <p className="text-slate-400 text-sm">No tienes proyectos asignados actualmente.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => window.location.href = `/project/${project.id}`}
                                    className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-lg p-4 transition-all duration-300 hover:shadow-md hover:shadow-blue-500/10 cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate pr-2">
                                            {project.nombre}
                                        </h3>
                                        <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0 ${project.estado === 'activo'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-slate-700 text-slate-400'
                                            }`}>
                                            {project.estado}
                                        </div>
                                    </div>
                                    <p className="text-slate-400 text-xs line-clamp-2 mb-3 h-8">
                                        {project.descripcion || 'Sin descripción'}
                                    </p>
                                    <div className="flex items-center text-xs text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                                        Ver detalles
                                        <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
