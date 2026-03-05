import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getMiEmpresa, getEmpresa, getEmpresaUsuarios, getConsumoHistorial, getConsumoSheetNames, updateConsumoLead, deleteConsumoLead } from '../lib/api';
import type { EmpresaDetail, ExtensionUser, Consumo, LeadData } from '../lib/api';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Search, Download, X, ChevronLeft, ChevronRight, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../components/ui/alert-dialog';
import { Label } from '../components/ui/label';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date) {
    return d.toISOString().slice(0, 10);
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps { page: number; totalPages: number; onChange: (p: number) => void; }

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
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {pages.map((p, i) =>
                p === '...'
                    ? <span key={`e-${i}`} className="px-1.5 text-muted-foreground text-sm">…</span>
                    : <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0" onClick={() => onChange(p as number)}>{p}</Button>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Historial() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();
    const { user: authUser } = useAuth();
    const isSuperAdmin = authUser?.role === 'SUPERADMIN';

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [sdrs, setSdrs] = useState<ExtensionUser[]>([]);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [data, setData] = useState<Consumo[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loadingInit, setLoadingInit] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    // Detail panel
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedCapture, setSelectedCapture] = useState<{ consumoId: string; lead: LeadData; sheet_name: string | null } | null>(null);

    // Edit lead dialog
    const [editLeadOpen, setEditLeadOpen] = useState(false);
    const [editLeadFields, setEditLeadFields] = useState<Record<string, string>>({});
    const [savingLead, setSavingLead] = useState(false);

    // Delete lead dialog
    const [deleteLeadOpen, setDeleteLeadOpen] = useState(false);
    const [deletingLead, setDeletingLead] = useState(false);

    // Filters
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [usuarioId, setUsuarioId] = useState('');
    const [sheetNameFilter, setSheetNameFilter] = useState('');
    const [tipoFilter, setTipoFilter] = useState<'all' | 'captures' | 'credits'>('captures');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Debounce search input → commit to search state after 400ms idle
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // Clear empresa context on unmount
    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Init: load empresa + SDR list + sheet names
    useEffect(() => {
        const loadEmpresa = empresaId ? getEmpresa(empresaId) : getMiEmpresa();
        loadEmpresa
            .then(emp => {
                setEmpresa(emp);
                if (empresaId) setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url });
                return Promise.all([
                    getEmpresaUsuarios(emp.id),
                    getConsumoSheetNames(emp.id)
                ]);
            })
            .then(([users, names]) => {
                setSdrs(users);
                setSheetNames(names);
            })
            .catch(() => {
                if (!empresaId) {
                    // SUPERADMIN global view — no company context, fetch sheet names without filter
                    getConsumoSheetNames().then(setSheetNames).catch(() => {});
                } else {
                    toast.error('Error al inicializar');
                }
            })
            .finally(() => setLoadingInit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Fetch data when filters change
    const fetchData = useCallback(async (overridePage?: number) => {
        if (!empresa && !!empresaId) return; // empresa-specific route but empresa not yet loaded
        const currentPage = overridePage ?? page;
        setLoadingData(true);
        try {
            const result = await getConsumoHistorial({
                empresa_id: empresa?.id,
                desde: desde || undefined,
                hasta: hasta || undefined,
                usuario_id: usuarioId || undefined,
                sheet_name: sheetNameFilter || undefined,
                only_leads: tipoFilter === 'captures' ? true : undefined,
                search: search || undefined,
                page: currentPage,
                limit
            });
            // Client-side filter for "solo créditos" (lead_data == null)
            let rows = result.data;
            if (tipoFilter === 'credits') rows = rows.filter(c => !c.lead_data);
            setData(rows);
            setTotal(result.total);
            setTotalPages(result.totalPages);
        } catch (err: any) {
            toast.error(err.message || 'Error al cargar registros');
        } finally {
            setLoadingData(false);
        }
    }, [empresa, empresaId, desde, hasta, usuarioId, sheetNameFilter, tipoFilter, search, page, limit]);

    useEffect(() => {
        if (!loadingInit) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingInit, empresa, desde, hasta, usuarioId, sheetNameFilter, tipoFilter, search, page, limit]);

    const applyPreset = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1));
        d.setHours(0, 0, 0, 0);
        setDesde(toISO(d));
        setHasta(toISO(new Date()));
        setPage(1);
    };

    const clearFilters = () => {
        setSearchInput(''); setSearch('');
        setDesde(''); setHasta('');
        setUsuarioId(''); setSheetNameFilter('');
        setTipoFilter('captures'); setPage(1);
    };

    const hasActiveFilters = searchInput !== '' || usuarioId !== '' || sheetNameFilter !== ''
        || tipoFilter !== 'captures' || desde !== '' || hasta !== '';

    const sdrMap = new Map(sdrs.map(s => [s.id, s]));

    // Export filtered view as CSV (UTF-8 BOM for Excel compatibility)
    const handleExport = async () => {
        try {
            const result = await getConsumoHistorial({
                empresa_id: empresa?.id,
                desde: desde || undefined,
                hasta: hasta || undefined,
                usuario_id: usuarioId || undefined,
                sheet_name: sheetNameFilter || undefined,
                only_leads: tipoFilter === 'captures' ? true : undefined,
                search: search || undefined,
                page: 1,
                limit: 5000,
            });
            let rows = result.data;
            if (tipoFilter === 'credits') rows = rows.filter(c => !c.lead_data);

            const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const headers = [
                'Fecha', 'Nombre completo', 'Nombre', 'Apellido', 'Título',
                'Email principal', 'Email personal', 'Teléfono',
                'Empresa', 'Dominio', 'Industria', 'Ubicación', 'LinkedIn',
                'Estado email', 'Sheet', 'SDR', 'Créditos Mail', 'Créditos Tel.', 'Créditos Verif.'
            ];

            const csvRows = rows.map(c => {
                const ld = c.lead_data;
                const sdr = sdrMap.get(c.usuario_id);
                const sdrLabel = sdr?.nombre || sdr?.email || c.usuario?.email || '';
                const bd = c.credit_breakdown;
                const mailC = bd != null ? bd.email_credits : (c.sesion_apollo !== null ? c.sesion_apollo : c.creditos_apollo);
                const telC = bd != null ? bd.phone_credits : '';
                const verifC = bd != null ? bd.verification_credits : (c.sesion_verifier !== null ? c.sesion_verifier : c.creditos_verifier);
                return [
                    new Date(c.fecha).toLocaleString('es-CL'),
                    ld?.full_name, ld?.first_name, ld?.last_name, ld?.title,
                    ld?.primary_email, ld?.personal_email, ld?.phone_number,
                    ld?.company_name, ld?.company_domain, ld?.industry,
                    ld?.location, ld?.linkedin_url, ld?.email_status,
                    c.sheet_name, sdrLabel, mailC, telC, verifC,
                ].map(escape).join(',');
            });

            const csv = '\uFEFF' + [headers.map(escape).join(','), ...csvRows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err.message || 'Error al exportar');
        }
    };

    // ─ Render ─────────────────────────────────────────────────────────────────

    if (loadingInit) {
        return <div className="flex h-64 items-center justify-center"><div className="text-muted-foreground animate-pulse">Cargando...</div></div>;
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Registros</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Historial completo de extracciones y capturas de leads.
                </p>
            </div>

            {/* Compact filter toolbar */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
                {/* Row 1: Search + Selects + Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Buscar nombre, email, empresa..."
                            className="h-9 pl-8 text-sm"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                    </div>

                    <Select value={usuarioId || '__all'} onValueChange={v => { setUsuarioId(v === '__all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Todos los SDRs" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">Todos los SDRs</SelectItem>
                            {sdrs.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre || s.email}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {sheetNames.length > 0 && (
                        <Select value={sheetNameFilter || '__all'} onValueChange={v => { setSheetNameFilter(v === '__all' ? '' : v); setPage(1); }}>
                            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Todos los sheets" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all">Todos los sheets</SelectItem>
                                {sheetNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v as any); setPage(1); }}>
                        <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="captures">Solo capturas</SelectItem>
                            <SelectItem value="credits">Solo créditos</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex-1" />

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" className="h-9 px-2.5 gap-1.5 text-muted-foreground" onClick={clearFilters}>
                            <X className="h-3.5 w-3.5" /> Limpiar
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport} disabled={loadingData}>
                        <Download className="h-3.5 w-3.5" /> Exportar CSV
                    </Button>
                </div>

                {/* Row 2: Date presets + date range */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        {[{ label: 'Hoy', days: 1 }, { label: '7 días', days: 7 }, { label: '30 días', days: 30 }].map(p => (
                            <Button
                                key={p.label}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => applyPreset(p.days)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Desde</span>
                        <Input
                            type="date"
                            className="h-7 w-36 text-xs px-2"
                            value={desde}
                            max={hasta || undefined}
                            onChange={e => { setDesde(e.target.value); setPage(1); }}
                        />
                        <span className="text-xs text-muted-foreground">hasta</span>
                        <Input
                            type="date"
                            className="h-7 w-36 text-xs px-2"
                            value={hasta}
                            min={desde || undefined}
                            onChange={e => { setHasta(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
            </div>

            {/* Results table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-3">
                    <div>
                        <CardTitle>Resultados</CardTitle>
                        <CardDescription>
                            {loadingData ? 'Cargando...' : total === 0 ? 'Sin resultados'
                                : `Mostrando ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total} registros`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Por página:</span>
                        <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1); }}>
                            <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
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
                                <TableHead>Prospecto</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>SDR</TableHead>
                                <TableHead>Sheet</TableHead>
                                <TableHead>Vía</TableHead>
                                <TableHead className="text-right">Mail</TableHead>
                                <TableHead className="text-right">Tel.</TableHead>
                                <TableHead className="text-right pr-6">Verif.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingData ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground animate-pulse">Cargando...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Sin registros para los filtros seleccionados.</TableCell>
                                </TableRow>
                            ) : (
                                data.map(c => {
                                    const ld = c.lead_data;
                                    const sdr = sdrMap.get(c.usuario_id);
                                    const sdrLabel = sdr?.nombre || sdr?.email || c.usuario?.email || c.usuario_id;
                                    const isCapture = !!ld;
                                    const prov = ld?.enrichment_provider || null;
                                    return (
                                        <TableRow
                                            key={c.id}
                                            className={isCapture ? 'cursor-pointer hover:bg-muted/50' : ''}
                                            onClick={isCapture ? () => { setSelectedCapture({ consumoId: c.id, lead: ld!, sheet_name: c.sheet_name }); setPanelOpen(true); } : undefined}
                                        >
                                            <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(c.fecha).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell>
                                                {isCapture ? (
                                                    <div>
                                                        <p className="text-sm font-medium leading-tight">
                                                            {ld!.full_name || `${ld!.first_name || ''} ${ld!.last_name || ''}`.trim() || '—'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{ld!.primary_email || ''}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Solo créditos</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {isCapture ? (ld!.company_name || '—') : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {sdr?.avatar_url
                                                        ? <img src={sdr.avatar_url} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                                                        : <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{(sdrLabel).charAt(0).toUpperCase()}</div>
                                                    }
                                                    <span className="text-sm truncate max-w-[140px]">{sdrLabel}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.sheet_name || '—'}</TableCell>
                                            <TableCell>
                                                {prov ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <img
                                                            src={`${import.meta.env.BASE_URL}${{ apollo: 'apolloicon.png', prospeo: 'prospeoicon.png', findymail: 'findymail-logo.png', leadmagic: 'leadmagic-logo.jpeg' }[prov] ?? 'apolloicon.png'}`}
                                                            alt={prov}
                                                            className="h-4 w-4 object-contain rounded"
                                                        />
                                                        <span className="text-xs text-muted-foreground capitalize">{prov}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(() => {
                                                    const bd = c.credit_breakdown;
                                                    let v: number;
                                                    if (bd != null) {
                                                        v = bd.email_credits; // nuevo sistema
                                                    } else if (isCapture) {
                                                        v = c.sesion_apollo !== null ? c.sesion_apollo : c.creditos_apollo; // captura antigua
                                                    } else {
                                                        v = c.creditos_apollo; // registro solo-crédito: solo sus créditos directos
                                                    }
                                                    return v > 0 ? <Badge variant="secondary">{v}</Badge> : <span className="text-muted-foreground text-sm">—</span>;
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(() => {
                                                    const bd = c.credit_breakdown;
                                                    if (!bd) return <span className="text-muted-foreground text-sm">—</span>;
                                                    return bd.phone_credits > 0
                                                        ? <Badge variant="secondary">{bd.phone_credits}</Badge>
                                                        : <span className="text-muted-foreground text-sm">—</span>;
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {(() => {
                                                    const bd = c.credit_breakdown;
                                                    let v: number;
                                                    if (bd != null) {
                                                        v = bd.verification_credits; // nuevo sistema
                                                    } else if (isCapture) {
                                                        v = c.sesion_verifier !== null ? c.sesion_verifier : c.creditos_verifier; // captura antigua
                                                    } else {
                                                        v = c.creditos_verifier; // registro solo-crédito: solo sus créditos directos
                                                    }
                                                    return v > 0 ? <Badge variant="outline">{v}</Badge> : <span className="text-muted-foreground text-sm">—</span>;
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
                            <Pagination page={page} totalPages={totalPages} onChange={p => setPage(p)} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail panel */}
            <Sheet open={panelOpen} onOpenChange={open => { setPanelOpen(open); if (!open) setSelectedCapture(null); }}>
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
                    {selectedCapture && (() => {
                        const ld = selectedCapture.lead;
                        const statusMap: Record<string, string> = { valid: 'Válido', invalid: 'Inválido', catch_all: 'Catch-All' };
                        const statusLabel = ld.email_status ? (statusMap[ld.email_status] || ld.email_status) : 'Sin verificar';
                        const statusVariant = ld.email_status === 'valid' ? 'default' : ld.email_status === 'invalid' ? 'destructive' : 'secondary';
                        return (
                            <>
                                <SheetHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <SheetTitle>{ld.full_name || `${ld.first_name || ''} ${ld.last_name || ''}`.trim() || 'Prospecto'}</SheetTitle>
                                            <SheetDescription className="flex flex-wrap gap-1.5 items-center mt-1">
                                                {ld.title && <span>{ld.title}</span>}
                                                {ld.company_name && <span>· {ld.company_name}</span>}
                                            </SheetDescription>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-8 w-8 p-0"
                                                title="Editar datos"
                                                onClick={() => {
                                                    setEditLeadFields({
                                                        full_name: ld.full_name || '',
                                                        first_name: ld.first_name || '',
                                                        last_name: ld.last_name || '',
                                                        title: ld.title || '',
                                                        primary_email: ld.primary_email || '',
                                                        personal_email: ld.personal_email || '',
                                                        phone_number: ld.phone_number || '',
                                                        company_name: ld.company_name || '',
                                                        company_domain: ld.company_domain || '',
                                                        industry: ld.industry || '',
                                                        location: ld.location || '',
                                                    });
                                                    setEditLeadOpen(true);
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            {isSuperAdmin && (
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    title="Eliminar datos del lead"
                                                    onClick={() => setDeleteLeadOpen(true)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </SheetHeader>
                                <div className="px-6 pb-6 space-y-4">
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto</p>
                                        <dl className="space-y-1.5 text-sm">
                                            {ld.primary_email && (
                                                <div className="flex gap-2 items-start">
                                                    <dt className="text-muted-foreground w-28 shrink-0">Email principal</dt>
                                                    <dd className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium break-all">{ld.primary_email}</span>
                                                        <Badge variant={statusVariant as any} className="text-[10px] shrink-0">{statusLabel}</Badge>
                                                    </dd>
                                                </div>
                                            )}
                                            {ld.personal_email && ld.personal_email !== ld.primary_email && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Email personal</dt><dd className="break-all">{ld.personal_email}</dd></div>}
                                            {ld.phone_number && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Teléfono</dt><dd>{ld.phone_number}</dd></div>}
                                        </dl>
                                    </div>
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
                                        <dl className="space-y-1.5 text-sm">
                                            {ld.company_name && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Nombre</dt><dd className="font-medium">{ld.company_name}</dd></div>}
                                            {ld.company_domain && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Dominio</dt><dd>{ld.company_domain}</dd></div>}
                                            {ld.industry && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Industria</dt><dd>{ld.industry}</dd></div>}
                                            {ld.location && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Ubicación</dt><dd>{ld.location}</dd></div>}
                                        </dl>
                                    </div>
                                    {ld.linkedin_url && (
                                        <>
                                            <Separator />
                                            <a href={ld.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                                                <ExternalLink className="h-3.5 w-3.5" />Ver perfil LinkedIn
                                            </a>
                                        </>
                                    )}
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SDR</p>
                                        <dl className="space-y-1.5 text-sm">
                                            {ld.sdr_name && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Nombre</dt><dd className="font-medium">{ld.sdr_name}</dd></div>}
                                            {ld.sdr_mail && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Email</dt><dd className="break-all">{ld.sdr_mail}</dd></div>}
                                            {ld.created_at && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Capturado</dt><dd>{new Date(ld.created_at).toLocaleString('es-CL')}</dd></div>}
                                        </dl>
                                    </div>
                                    {selectedCapture.sheet_name && (
                                        <>
                                            <Separator />
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sheet</p>
                                                <p className="text-sm">{selectedCapture.sheet_name}</p>
                                            </div>
                                        </>
                                    )}
                                    {ld.enrichment_provider && (() => {
                                        const provIcons: Record<string, string> = { apollo: 'apolloicon.png', prospeo: 'prospeoicon.png', findymail: 'findymail-logo.png', leadmagic: 'leadmagic-logo.jpeg' };
                                        const provNames: Record<string, string> = { apollo: 'Apollo', prospeo: 'Prospeo', findymail: 'Findymail', leadmagic: 'LeadMagic' };
                                        const chip = (id: string) => (
                                            <div className="flex items-center gap-1.5">
                                                <img src={`${import.meta.env.BASE_URL}${provIcons[id] ?? 'apolloicon.png'}`} alt={id} className="h-4 w-4 object-contain rounded" />
                                                <span className="text-sm">{provNames[id] ?? id}</span>
                                            </div>
                                        );
                                        const dash = <span className="text-xs text-muted-foreground">—</span>;
                                        return (
                                            <>
                                                <Separator />
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vía de captura</p>
                                                    <div className="grid grid-cols-[80px_1fr] gap-y-2 items-center">
                                                        <span className="text-muted-foreground text-xs">Principal</span>
                                                        {chip(ld.enrichment_provider!)}
                                                        <span className="text-muted-foreground text-xs">Email</span>
                                                        {ld.email_provider ? chip(ld.email_provider) : dash}
                                                        <span className="text-muted-foreground text-xs">Teléfono</span>
                                                        {ld.phone_provider ? chip(ld.phone_provider) : dash}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    {selectedCapture && (() => {
                                        const consumo = data.find(c => c.id === selectedCapture.consumoId);
                                        const bd = consumo?.credit_breakdown;
                                        if (!bd) return null;
                                        const provNames: Record<string, string> = { apollo: 'Apollo', prospeo: 'Prospeo', findymail: 'Findymail', leadmagic: 'LeadMagic', millionverifier: 'MillionVerifier' };
                                        return (
                                            <>
                                                <Separator />
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Créditos consumidos</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                                            <p className="text-[10px] text-muted-foreground">Mail</p>
                                                            <p className="text-base font-bold">{bd.email_credits}</p>
                                                        </div>
                                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                                            <p className="text-[10px] text-muted-foreground">Tel.</p>
                                                            <p className="text-base font-bold">{bd.phone_credits}</p>
                                                        </div>
                                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                                            <p className="text-[10px] text-muted-foreground">Verif.</p>
                                                            <p className="text-base font-bold">{bd.verification_credits}</p>
                                                        </div>
                                                    </div>
                                                    {Object.keys(bd.providers).length > 0 && (
                                                        <div className="space-y-1 pt-1">
                                                            {Object.entries(bd.providers).map(([prov, credits]) => (
                                                                <div key={prov} className="flex items-center justify-between text-xs">
                                                                    <span className="text-muted-foreground">{provNames[prov] ?? prov}</span>
                                                                    <Badge variant="secondary" className="text-[10px]">{credits} créditos</Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </>
                        );
                    })()}
                </SheetContent>
            </Sheet>

            {/* Edit lead dialog */}
            <Dialog open={editLeadOpen} onOpenChange={v => { if (!v) setEditLeadOpen(false); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar datos del lead</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'full_name', label: 'Nombre completo' },
                                { key: 'first_name', label: 'Nombre' },
                                { key: 'last_name', label: 'Apellido' },
                                { key: 'title', label: 'Cargo' },
                                { key: 'primary_email', label: 'Email principal' },
                                { key: 'personal_email', label: 'Email personal' },
                                { key: 'phone_number', label: 'Teléfono' },
                            ].map(({ key, label }) => (
                                <div key={key} className={key === 'full_name' || key === 'primary_email' || key === 'personal_email' ? 'col-span-2' : ''}>
                                    <Label className="text-xs">{label}</Label>
                                    <Input
                                        className="h-8 text-sm mt-1"
                                        value={editLeadFields[key] ?? ''}
                                        onChange={e => setEditLeadFields(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="—"
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Empresa</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'company_name', label: 'Empresa' },
                                { key: 'company_domain', label: 'Dominio' },
                                { key: 'industry', label: 'Industria' },
                                { key: 'location', label: 'Ubicación' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <Label className="text-xs">{label}</Label>
                                    <Input
                                        className="h-8 text-sm mt-1"
                                        value={editLeadFields[key] ?? ''}
                                        onChange={e => setEditLeadFields(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="—"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditLeadOpen(false)}>Cancelar</Button>
                        <Button
                            disabled={savingLead}
                            onClick={async () => {
                                if (!selectedCapture) return;
                                setSavingLead(true);
                                try {
                                    await updateConsumoLead(selectedCapture.consumoId, editLeadFields as any);
                                    const updatedLead = { ...selectedCapture.lead, ...editLeadFields };
                                    setSelectedCapture({ ...selectedCapture, lead: updatedLead as LeadData });
                                    setData(prev => prev.map(c =>
                                        c.id === selectedCapture.consumoId
                                            ? { ...c, lead_data: updatedLead }
                                            : c
                                    ));
                                    toast.success('Lead actualizado');
                                    setEditLeadOpen(false);
                                } catch (err: any) {
                                    toast.error(err.message || 'Error al actualizar');
                                } finally {
                                    setSavingLead(false);
                                }
                            }}
                        >
                            {savingLead ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete lead confirmation */}
            <AlertDialog open={deleteLeadOpen} onOpenChange={v => { if (!v) setDeleteLeadOpen(false); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar datos del lead?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se borrarán los datos de contacto y empresa de este registro.
                            El registro de créditos se conservará. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deletingLead}
                            onClick={async () => {
                                if (!selectedCapture) return;
                                setDeletingLead(true);
                                try {
                                    await deleteConsumoLead(selectedCapture.consumoId);
                                    setData(prev => prev.map(c =>
                                        c.id === selectedCapture.consumoId
                                            ? { ...c, lead_data: null }
                                            : c
                                    ));
                                    toast.success('Datos del lead eliminados');
                                    setDeleteLeadOpen(false);
                                    setPanelOpen(false);
                                    setSelectedCapture(null);
                                } catch (err: any) {
                                    toast.error(err.message || 'Error al eliminar');
                                } finally {
                                    setDeletingLead(false);
                                }
                            }}
                        >
                            {deletingLead ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
