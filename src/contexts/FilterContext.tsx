import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface FilterContextType {
    selectedProject: string | null;
    selectedMonth: string | null;
    setSelectedProject: (project: string) => void;
    setSelectedMonth: (month: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

    return (
        <FilterContext.Provider
            value={{
                selectedProject,
                selectedMonth,
                setSelectedProject,
                setSelectedMonth,
            }}
        >
            {children}
        </FilterContext.Provider>
    );
};

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
};
