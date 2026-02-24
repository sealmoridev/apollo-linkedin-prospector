import { createContext, useContext, useState } from 'react';

export interface ActiveEmpresaInfo {
    id: string;
    nombre: string;
    logo_url: string | null;
}

interface ActiveEmpresaContextType {
    activeEmpresa: ActiveEmpresaInfo | null;
    setActiveEmpresa: (e: ActiveEmpresaInfo | null) => void;
}

const ActiveEmpresaContext = createContext<ActiveEmpresaContextType>({
    activeEmpresa: null,
    setActiveEmpresa: () => {}
});

export function ActiveEmpresaProvider({ children }: { children: React.ReactNode }) {
    const [activeEmpresa, setActiveEmpresa] = useState<ActiveEmpresaInfo | null>(null);
    return (
        <ActiveEmpresaContext.Provider value={{ activeEmpresa, setActiveEmpresa }}>
            {children}
        </ActiveEmpresaContext.Provider>
    );
}

export const useActiveEmpresa = () => useContext(ActiveEmpresaContext);
