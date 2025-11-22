import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
    correo: string;
    nombre: string;
    rol: string;
}

interface AuthContextType {
    user: User | null;
    login: (correo: string, clave: string) => Promise<{ error: string | null }>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for persisted session
        const storedUser = localStorage.getItem('gpdesk_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (correo: string, clave: string) => {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('correo', correo)
                .eq('clave', clave) // WARNING: Plain text comparison as requested
                .eq('activo', true)
                .single();

            if (error || !data) {
                return { error: 'Credenciales inválidas o usuario inactivo' };
            }

            const userData = {
                correo: data.correo,
                nombre: data.nombre,
                rol: data.rol,
            };

            setUser(userData);
            localStorage.setItem('gpdesk_user', JSON.stringify(userData));
            return { error: null };
        } catch (err) {
            return { error: 'Ocurrió un error al iniciar sesión' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('gpdesk_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
