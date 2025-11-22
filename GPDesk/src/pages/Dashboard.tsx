import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-slate-400">Bienvenido, {user?.nombre}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg transition-colors border border-red-500/20"
                    >
                        Cerrar Sesión
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">Proyectos Activos</h3>
                        <p className="text-3xl font-bold text-blue-400">0</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">Mis Tareas</h3>
                        <p className="text-3xl font-bold text-purple-400">0</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">Horas Reportadas</h3>
                        <p className="text-3xl font-bold text-emerald-400">0h</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
