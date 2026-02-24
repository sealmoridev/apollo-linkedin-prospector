import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getMiEmpresa, getEmpresa, getEmpresaUsuarios, getConsumoHistorial } from '../lib/api';
import type { EmpresaDetail, ExtensionUser, Consumo } from '../lib/api';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date) {
    return d.toISOString().slice(0, 10);
}

function defaultDesde() {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return toISO(d);
}

// ─── Pagination component ─────────────────────────────────────────────────────

interface PaginationProps {
    page: number;
    totalPages: number;
    onChange: (p: number) => void;
}

function Pagination({ page, totalPages, onChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (page > 3) pages.push('...');
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
        if (page < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline" size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
            >
                <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {pages.map((p, i) =>
                p === '...'
                    ? <span key={`ellipsis-${i}`} className="px-1.5 text-muted-foreground text-sm">…</span>
                    : (
                        <Button
                            key={p}
                            variant={p === page ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => onChange(p as number)}
                        >
                            {p}
                        </Button>
                    )
            )}
            <Button
                variant="outline" size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= totalPages}
                onClick={() => onChange(page + 1)}
            >
                <ChevronRight className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Historial() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [sdrs, setSdrs] = useState<ExtensionUser[]>([]);
    const [data, setData] = useState<Consumo[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loadingInit, setLoadingInit] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    // Filters
    const [desde, setDesde] = useState(defaultDesde);
    const [hasta, setHasta] = useState(toISO(new Date()));
    const [usuarioId, setUsuarioId] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Pending (uncommitted) filter state — applied on "Aplicar" or preset click
    const [pendingDesde, setPendingDesde] = useState(defaultDesde);
    const [pendingHasta, setPendingHasta] = useState(toISO(new Date()));

    // Clear empresa context on unmount
    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Init: load empresa + SDR list
    useEffect(() => {
        const fetchEmpresa = empresaId ? getEmpresa(empresaId) : getMiEmpresa();

        fetchEmpresa
            .then(emp => {
                setEmpresa(emp);
                if (empresaId) setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url });
                return getEmpresaUsuarios(emp.id);
            })
            .then(setSdrs)
            .catch(() => toast.error('Error al inicializar'))
            .finally(() => setLoadingInit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Fetch data when any filter changes
    const fetchData = useCallback(async (overridePage?: number) => {
        if (!empresa) return;
        const currentPage = overridePage ?? page;
        setLoadingData(true);
        try {
            const result = await getConsumoHistorial({
                desde,
                hasta,
                usuario_id: usuarioId || undefined,
                page: currentPage,
                limit
            });
            setData(result.data);
            setTotal(result.total);
            setTotalPages(result.totalPages);
        } catch (err: any) {
            toast.error(err.message || 'Error al cargar historial');
        } finally {
            setLoadingData(false);
        }
    }, [empresa, desde, hasta, usuarioId, page, limit]);

    useEffect(() => {
        if (empresa) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresa, desde, hasta, usuarioId, page, limit]);

    // Quick date presets
    const applyPreset = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1));
        d.setHours(0, 0, 0, 0);
        const newDesde = toISO(d);
        const newHasta = toISO(new Date());
        setPendingDesde(newDesde);
        setPendingHasta(newHasta);
        setDesde(newDesde);
        setHasta(newHasta);
        setPage(1);
    };

    const applyDateFilter = () => {
        if (pendingDesde > pendingHasta) {
            toast.error('"Desde" debe ser anterior a "Hasta"');
            return;
        }
        setDesde(pendingDesde);
        setHasta(pendingHasta);
        setPage(1);
    };

    const clearFilters = () => {
        const newDesde = defaultDesde();
        const newHasta = toISO(new Date());
        setPendingDesde(newDesde);
        setPendingHasta(newHasta);
        setDesde(newDesde);
        setHasta(newHasta);
        setUsuarioId('');
        setPage(1);
    };

    const hasActiveFilters = usuarioId !== '' || desde !== defaultDesde() || hasta !== toISO(new Date());

    // ─ Render ─────────────────────────────────────────────────────────────────

    if (loadingInit) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Historial de consumo</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Log detallado del uso de créditos por fecha y usuario.
                </p>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Filtros</CardTitle>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost" size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground gap-1 ml-auto"
                                onClick={clearFilters}
                            >
                                <X className="h-3 w-3" />
                                Limpiar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'Hoy', days: 1 },
                            { label: 'Ayer', days: 2 },
                            { label: '7 días', days: 7 },
                            { label: '30 días', days: 30 }
                        ].map(p => (
                            <Button
                                key={p.label}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => applyPreset(p.days)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>

                    {/* Date range + user filter */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Desde</p>
                            <Input
                                type="date"
                                className="h-8 w-36 text-sm"
                                value={pendingDesde}
                                max={pendingHasta}
                                onChange={e => setPendingDesde(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Hasta</p>
                            <Input
                                type="date"
                                className="h-8 w-36 text-sm"
                                value={pendingHasta}
                                min={pendingDesde}
                                onChange={e => setPendingHasta(e.target.value)}
                            />
                        </div>
                        <Button size="sm" className="h-8" onClick={applyDateFilter}>
                            Aplicar fechas
                        </Button>

                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">SDR</p>
                            <Select value={usuarioId || '__all'} onValueChange={v => { setUsuarioId(v === '__all' ? '' : v); setPage(1); }}>
                                <SelectTrigger className="h-8 w-52 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all">Todos los usuarios</SelectItem>
                                    {sdrs.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.email || s.id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-3">
                    <div>
                        <CardTitle>Registros</CardTitle>
                        <CardDescription>
                            {loadingData
                                ? 'Cargando...'
                                : total === 0
                                    ? 'Sin resultados'
                                    : `Mostrando ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total} registros`
                            }
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Por página:</span>
                        <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1); }}>
                            <SelectTrigger className="h-7 w-16 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Fecha</TableHead>
                                <TableHead>Usuario (SDR)</TableHead>
                                <TableHead className="text-right">Apollo</TableHead>
                                <TableHead className="text-right pr-6">Verifier</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingData ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground animate-pulse">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                        Sin registros para los filtros seleccionados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="pl-6 text-sm text-muted-foreground whitespace-nowrap">
                                            {new Date(c.fecha).toLocaleString('es-CL', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </TableCell>
                                        <TableCell className="text-sm">{c.usuario?.email ?? c.usuario_id}</TableCell>
                                        <TableCell className="text-right">
                                            {c.creditos_apollo > 0
                                                ? <Badge variant="secondary">{c.creditos_apollo}</Badge>
                                                : <span className="text-muted-foreground text-sm">—</span>
                                            }
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            {c.creditos_verifier > 0
                                                ? <Badge variant="outline">{c.creditos_verifier}</Badge>
                                                : <span className="text-muted-foreground text-sm">—</span>
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <p className="text-xs text-muted-foreground">
                                Página {page} de {totalPages}
                            </p>
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                onChange={p => setPage(p)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
