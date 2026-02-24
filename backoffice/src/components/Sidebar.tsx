import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getEmpresas } from '../lib/api';
import type { EmpresaDetail } from '../lib/api';
import {
    Building2, LogOut, LayoutDashboard, PlugZap, History, Users,
    ArrowLeft, ChevronLeft, ChevronRight, ArrowLeftRight, Globe, Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from './ui/dialog';

export function Sidebar() {
    const { user, logoutUser } = useAuth();
    const { activeEmpresa } = useActiveEmpresa();
    const location = useLocation();
    const navigate = useNavigate();

    const [collapsed, setCollapsed] = useState(() =>
        localStorage.getItem('sidebar-collapsed') === 'true'
    );

    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [empresas, setEmpresas] = useState<EmpresaDetail[] | null>(null);
    const [loadingEmpresas, setLoadingEmpresas] = useState(false);

    const toggleCollapsed = () => {
        setCollapsed(v => {
            localStorage.setItem('sidebar-collapsed', String(!v));
            return !v;
        });
    };

    // Lazy-load empresas when switcher opens (only once)
    useEffect(() => {
        if (!switcherOpen || empresas !== null) return;
        setLoadingEmpresas(true);
        getEmpresas()
            .then(setEmpresas)
            .catch(() => setEmpresas([]))
            .finally(() => setLoadingEmpresas(false));
    }, [switcherOpen, empresas]);

    // Detect if SuperAdmin is viewing an empresa (/empresas/:id/*)
    const empresaMatch = location.pathname.match(/^\/empresas\/([^/]+)/);
    const isInEmpresaContext = !!empresaMatch && user?.role === 'SUPERADMIN';
    const contextEmpresaId = empresaMatch?.[1];

    // Show empresa header: Admin always, SA only when inside an empresa route
    const showEmpresaHeader = activeEmpresa !== null && (user?.role === 'ADMIN' || isInEmpresaContext);

    // Nav items depend on role + context
    const navItems = (() => {
        if (user?.role === 'SUPERADMIN' && isInEmpresaContext && contextEmpresaId) {
            const base = `/empresas/${contextEmpresaId}`;
            return [
                { to: base, label: 'Dashboard', Icon: LayoutDashboard, exact: true },
                { to: `${base}/historial`, label: 'Historial', Icon: History },
                { to: `${base}/empresa`, label: 'Empresa', Icon: Building2 },
                { to: `${base}/apis`, label: 'APIs', Icon: PlugZap },
                { to: `${base}/extension`, label: 'Extensión Chrome', Icon: Globe },
            ];
        }
        if (user?.role === 'SUPERADMIN') {
            return [
                { to: '/empresas', label: 'Empresas', Icon: Building2, exact: false },
                { to: '/usuarios', label: 'Usuarios', Icon: Users, exact: false },
            ];
        }
        return [
            { to: '/mi-empresa', label: 'Dashboard', Icon: LayoutDashboard, exact: false },
            { to: '/historial', label: 'Historial', Icon: History, exact: false },
            { to: '/empresa', label: 'Empresa', Icon: Building2, exact: false },
            { to: '/apis', label: 'APIs', Icon: PlugZap, exact: false },
            { to: '/extension', label: 'Extensión Chrome', Icon: Globe, exact: false },
        ];
    })();

    const isActive = (to: string, exact = false) =>
        exact ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(to + '/');

    // ── Empresa Header ──────────────────────────────────────────────────

    const EmpresaHeader = () => {
        if (!showEmpresaHeader || !activeEmpresa) return null;

        const logoSmall = activeEmpresa.logo_url ? (
            <img src={activeEmpresa.logo_url} alt={activeEmpresa.nombre}
                className="h-8 w-8 rounded-lg object-contain border p-0.5 bg-background" />
        ) : (
            <div className="h-8 w-8 rounded-lg border bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {activeEmpresa.nombre.charAt(0).toUpperCase()}
            </div>
        );

        if (collapsed) {
            return (
                <div className="flex items-center justify-center border-b py-2.5">
                    <button
                        onClick={isInEmpresaContext ? () => setSwitcherOpen(true) : undefined}
                        title={isInEmpresaContext ? `${activeEmpresa.nombre} — Cambiar empresa` : activeEmpresa.nombre}
                        className={isInEmpresaContext ? 'cursor-pointer' : 'cursor-default'}
                    >
                        {logoSmall}
                    </button>
                </div>
            );
        }

        return (
            <div className="border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    {activeEmpresa.logo_url ? (
                        <img src={activeEmpresa.logo_url} alt={activeEmpresa.nombre}
                            className="h-10 w-10 rounded-xl object-contain border p-1 bg-background shrink-0" />
                    ) : (
                        <div className="h-10 w-10 rounded-xl border bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
                            {activeEmpresa.nombre.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate leading-tight">
                            {activeEmpresa.nombre}
                        </p>
                        {isInEmpresaContext ? (
                            <button
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-0.5"
                                onClick={() => setSwitcherOpen(true)}
                            >
                                <ArrowLeftRight className="h-2.5 w-2.5" />
                                Cambiar empresa
                            </button>
                        ) : (
                            <p className="text-[11px] text-muted-foreground mt-0.5">Tu empresa</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className={`relative flex h-screen flex-col border-r bg-background transition-[width] duration-200 ease-in-out ${collapsed ? 'w-[58px]' : 'w-64'}`}>

            {/* ── Top: logo + collapse toggle — always in same position ── */}
            <div className={`flex h-16 items-center justify-between border-b shrink-0 ${collapsed ? 'px-2' : 'px-4'}`}>
                {collapsed ? (
                    <Link to="/" className="flex items-center" title="MR. PROSPECT">
                        <img src="/isotipo.png" alt="MR. PROSPECT" className="h-7 w-7 object-contain" />
                    </Link>
                ) : (
                    <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
                        <img src="/isotipo.png" alt="MR. PROSPECT" className="h-7 w-7 object-contain shrink-0" />
                        <span className="font-bold text-sm tracking-wide text-foreground whitespace-nowrap">
                            MR. PROSPECT
                        </span>
                    </Link>
                )}
                <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground"
                    onClick={toggleCollapsed}
                    title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* ── Empresa header ── */}
            <EmpresaHeader />

            {/* ── Navigation ── */}
            <div className="flex-1 overflow-auto py-3">
                <div className={collapsed ? 'px-1.5' : 'px-3'}>
                    {!collapsed && (
                        <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                            Menú
                        </p>
                    )}
                    <nav className="space-y-0.5">
                        {navItems.map(({ to, label, Icon, exact }) => {
                            const active = isActive(to, exact);
                            if (collapsed) {
                                return (
                                    <Link
                                        key={to} to={to} title={label}
                                        className={`flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-all
                                            ${active
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </Link>
                                );
                            }
                            return (
                                <Link
                                    key={to} to={to}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all
                                        ${active
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* ── Footer: user info + logout ── */}
            <div className={`border-t shrink-0 ${collapsed ? 'p-1.5 space-y-0.5' : 'p-4 space-y-2'}`}>
                {collapsed ? (
                    <>
                        <div
                            className="flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs cursor-default"
                            title={`${user?.email} (${user?.role})`}
                        >
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <button
                            onClick={logoutUser}
                            title="Cerrar sesión"
                            className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-3 px-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 font-semibold rounded-full">
                                    {user?.role}
                                </Badge>
                            </div>
                        </div>
                        <Button
                            variant="outline" size="sm"
                            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                            onClick={logoutUser}
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Cerrar sesión
                        </Button>
                    </>
                )}
            </div>

            {/* ── Empresa Switcher Dialog ── */}
            <Dialog open={switcherOpen} onOpenChange={setSwitcherOpen}>
                <DialogContent className="max-w-sm p-0 overflow-hidden">
                    <DialogHeader className="px-4 pt-4 pb-3 border-b">
                        <DialogTitle className="text-sm">Seleccionar empresa</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-72 overflow-y-auto">
                        {loadingEmpresas ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : !empresas?.length ? (
                            <p className="text-center py-8 text-sm text-muted-foreground">No hay empresas</p>
                        ) : (
                            <div className="py-1">
                                {empresas.map(emp => {
                                    const isCurrent = emp.id === contextEmpresaId;
                                    return (
                                        <button
                                            key={emp.id}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors
                                                ${isCurrent ? 'bg-primary/5' : ''}`}
                                            onClick={() => {
                                                setSwitcherOpen(false);
                                                navigate(`/empresas/${emp.id}`);
                                            }}
                                        >
                                            {emp.logo_url ? (
                                                <img src={emp.logo_url} alt={emp.nombre}
                                                    className="h-7 w-7 rounded-md object-contain border bg-background p-0.5 shrink-0" />
                                            ) : (
                                                <div className="h-7 w-7 rounded-md border bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                                                    {emp.nombre.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="flex-1 text-left truncate">{emp.nombre}</span>
                                            {isCurrent && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                                    Actual
                                                </Badge>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="border-t px-4 py-3">
                        <button
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                                setSwitcherOpen(false);
                                navigate('/empresas');
                            }}
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Volver al Panel SuperAdmin
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
