import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FilterProvider } from './contexts/FilterContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProjectAnalytics } from './pages/ProjectAnalytics';
import SidebarLayout from './components/Layout/SidebarLayout';
import Overview from './pages/Overview/Overview';
import HorasRecursos from './pages/Horas/HorasRecursos';
import TicketsEntregas from './pages/Tickets/TicketsEntregas';
import EquipoCapacidad from './pages/Equipo/EquipoCapacidad';
import Rendimiento from './pages/Rendimiento/Rendimiento';
import AnalisisDetallado from './pages/Analisis/AnalisisDetallado';
import Configuracion from './pages/Configuracion/Configuracion';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return <>{children}</>;
};

function App() {
    return (
        <AuthProvider>
            <FilterProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* Legacy routes (without sidebar) */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />

                        {/* New routes with sidebar */}
                        <Route
                            path="/project/:id"
                            element={
                                <ProtectedRoute>
                                    <SidebarLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route path="overview" element={<Overview />} />
                            <Route path="horas" element={<HorasRecursos />} />
                            <Route path="tickets" element={<TicketsEntregas />} />
                            <Route path="equipo" element={<EquipoCapacidad />} />
                            <Route path="rendimiento" element={<Rendimiento />} />
                            <Route path="analisis" element={<AnalisisDetallado />} />
                            <Route path="configuracion" element={<Configuracion />} />
                            {/* Default redirect to overview */}
                            <Route index element={<Navigate to="overview" replace />} />
                        </Route>

                        {/* Legacy analytics route (redirect to new structure) */}
                        <Route
                            path="/project/:projectId/analytics"
                            element={
                                <ProtectedRoute>
                                    <ProjectAnalytics />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </BrowserRouter>
            </FilterProvider>
        </AuthProvider>
    );
}

export default App;

