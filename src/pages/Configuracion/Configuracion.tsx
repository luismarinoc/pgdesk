import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProjectConfig {
    nombre: string;
    jira_id: string;
    horas_contratadas: number;
}

const Configuracion: React.FC = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);

    useEffect(() => {
        const fetchProjectConfig = async () => {
            if (!id) return;

            setLoading(true);
            try {
                const { data } = await supabase
                    .from('proyectos')
                    .select('nombre, jira_id, horas_contratadas')
                    .eq('id', id)
                    .single();

                if (data) {
                    setProjectConfig(data as ProjectConfig);
                }
            } catch (error) {
                console.error('Error fetching project configuration:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectConfig();
    }, [id]);

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
                    <div className="bg-slate-500/10 rounded-lg" style={{ padding: '0.75rem' }}>
                        <Settings className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Configuración</h1>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40" style={{ padding: '1.5rem' }}>
                        <h3 className="text-lg font-semibold text-white mb-2">Usuarios</h3>
                        <p className="text-slate-400 text-sm">Gestión de permisos y accesos</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Configuracion;
