import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getMiEmpresa } from '../lib/api';
import { Sidebar } from './Sidebar';

/**
 * Carga la empresa del Admin automáticamente al montar el layout,
 * de modo que el sidebar siempre tenga el logo y nombre disponibles.
 * Para SuperAdmin, el contexto lo setean las páginas de empresa al cargar.
 */
function EmpresaAutoLoader() {
    const { user } = useAuth();
    const { activeEmpresa, setActiveEmpresa } = useActiveEmpresa();

    useEffect(() => {
        if (user?.role === 'ADMIN' && !activeEmpresa) {
            getMiEmpresa()
                .then(emp => setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url }))
                .catch(() => {}); // silencioso — el dashboard mostrará su propio error si falla
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    return null;
}

export function Layout() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <EmpresaAutoLoader />
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 lg:p-8">
                <Outlet />
            </main>
        </div>
    );
}
