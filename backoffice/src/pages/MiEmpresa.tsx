import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMiEmpresa, getEmpresa, getEmpresaUsuarios, getConsumos, getConsumoHistorial } from '../lib/api';
import type { EmpresaDetail, ExtensionUser, Consumo } from '../lib/api';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip
} from 'recharts';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import type { LeadData } from '../lib/api';
import { Users, Zap, CheckCircle, Activity, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';

// ─── Date helpers ─────────────────────────────────────────────────────────────

type RangePreset = '7d' | '30d' | '3m' | 'custom';

function toISO(d: Date) {
    return d.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<RangePreset, 'custom'>): { desde: string; hasta: string } {
    const hasta = new Date();
    const desde = new Date();
    if (preset === '7d') desde.setDate(desde.getDate() - 6);
    else if (preset === '30d') desde.setDate(desde.getDate() - 29);
    else desde.setMonth(desde.getMonth() - 3);
    desde.setHours(0, 0, 0, 0);
    return { desde: toISO(desde), hasta: toISO(hasta) };
}

function formatAxisDate(iso: string) {
    const [, m, d] = iso.split('-');
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(d)} ${monthNames[parseInt(m) - 1]}`;
}

function fillDateRange(desde: string, hasta: string) {
    const dates: string[] = [];
    const cur = new Date(desde + 'T00:00:00');
    const end = new Date(hasta + 'T00:00:00');
    while (cur <= end) {
        dates.push(toISO(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium mb-1">{label ? formatAxisDate(label) : ''}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MiEmpresa() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();
    const navigate = useNavigate();

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [usuarios, setUsuarios] = useState<ExtensionUser[]>([]);
    const [consumos, setConsumos] = useState<Consumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingConsumos, setLoadingConsumos] = useState(false);
    const [refreshingUsuarios, setRefreshingUsuarios] = useState(false);

    // Últimas capturas (preview)
    const [lastCaptures, setLastCaptures] = useState<Consumo[]>([]);
    const [loadingCaptures, setLoadingCaptures] = useState(false);
    const [capturePanel, setCapturePanel] = useState<{ lead: LeadData; sheet_name: string | null } | null>(null);

    // Date range
    const [preset, setPreset] = useState<RangePreset>('7d');
    const [customDesde, setCustomDesde] = useState(toISO(new Date()));
    const [customHasta, setCustomHasta] = useState(toISO(new Date()));
    const [appliedRange, setAppliedRange] = useState(() => presetRange('7d'));

    // Clear empresa context on unmount
    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Initial load
    useEffect(() => {
        const fetchEmpresa = empresaId ? getEmpresa(empresaId) : getMiEmpresa();
        fetchEmpresa
            .then(emp => {
                setEmpresa(emp);
                if (empresaId) setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url });
                return Promise.all([
                    getEmpresaUsuarios(emp.id),
                    getConsumos(emp.id, appliedRange.desde, appliedRange.hasta)
                ]);
            })
            .then(([users, cons]) => {
                setUsuarios(users);
                setConsumos(cons);
            })
            .catch(() => toast.error('Error al cargar datos'))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Refetch consumos when date range changes
    useEffect(() => {
        if (!empresa) return;
        setLoadingConsumos(true);
        getConsumos(empresa.id, appliedRange.desde, appliedRange.hasta)
            .then(setConsumos)
            .catch(() => toast.error('Error al cargar consumos'))
            .finally(() => setLoadingConsumos(false));
    }, [empresa, appliedRange]);

    // Load last 10 captures for preview
    useEffect(() => {
        if (!empresa) return;
        setLoadingCaptures(true);
        getConsumoHistorial({ empresa_id: empresa.id, only_leads: true, limit: 10, page: 1 })
            .then(r => setLastCaptures(r.data))
            .catch(() => {})
            .finally(() => setLoadingCaptures(false));
    }, [empresa]);

    const applyPreset = (p: Exclude<RangePreset, 'custom'>) => {
        setPreset(p);
        setAppliedRange(presetRange(p));
    };

    const refreshUsuarios = () => {
        if (!empresa) return;
        setRefreshingUsuarios(true);
        getEmpresaUsuarios(empresa.id)
            .then(setUsuarios)
            .catch(() => toast.error('Error al recargar usuarios'))
            .finally(() => setRefreshingUsuarios(false));
    };

    const applyCustom = () => {
        if (!customDesde || !customHasta) return;
        if (customDesde > customHasta) { toast.error('La fecha "desde" debe ser anterior a "hasta"'); return; }
        setAppliedRange({ desde: customDesde, hasta: customHasta });
    };

    // ─ Derived data ──────────────────────────────────────────────────────────

    const totalExtracciones = consumos.length;
    const totalApollo = useMemo(() => consumos.reduce((s, c) => s + c.creditos_apollo, 0), [consumos]);
    const totalVerifier = useMemo(() => consumos.reduce((s, c) => s + c.creditos_verifier, 0), [consumos]);
    const sdrsActivos = useMemo(() => new Set(consumos.map(c => c.usuario?.email ?? c.usuario_id)).size, [consumos]);

    const chartData = useMemo(() => {
        const byDate = new Map<string, { date: string; extracciones: number; apollo: number }>();
        consumos.forEach(c => {
            const date = new Date(c.fecha).toLocaleDateString('sv');
            const prev = byDate.get(date) || { date, extracciones: 0, apollo: 0 };
            prev.extracciones += 1;
            prev.apollo += c.creditos_apollo;
            byDate.set(date, prev);
        });
        return fillDateRange(appliedRange.desde, appliedRange.hasta).map(date => ({
            date,
            extracciones: byDate.get(date)?.extracciones ?? 0,
            apollo: byDate.get(date)?.apollo ?? 0
        }));
    }, [consumos, appliedRange]);

    // Ranking SDR: agrupa por email para unificar IDs distintos del mismo SDR
    const sdrRanking = useMemo(() => {
        // email → primer usuario que tenga ese email (para avatar/nombre)
        const emailToUser = new Map(usuarios.map(u => [u.email, u]));
        const byEmail = new Map<string, { email: string; extracciones: number; apollo: number; verifier: number }>();
        consumos.forEach(c => {
            const email = c.usuario?.email
                ?? usuarios.find(u => u.id === c.usuario_id)?.email
                ?? c.usuario_id;
            const prev = byEmail.get(email) || { email, extracciones: 0, apollo: 0, verifier: 0 };
            prev.extracciones += 1;
            prev.apollo += c.creditos_apollo;
            prev.verifier += c.creditos_verifier;
            byEmail.set(email, prev);
        });
        // Incluir SDRs registrados sin actividad en el período
        usuarios.forEach(u => {
            if (!byEmail.has(u.email)) byEmail.set(u.email, { email: u.email, extracciones: 0, apollo: 0, verifier: 0 });
        });
        return Array.from(byEmail.values())
            .sort((a, b) => b.extracciones - a.extracciones)
            .map(r => ({ ...r, sdr: emailToUser.get(r.email) }));
    }, [consumos, usuarios]);

    const registrosRoute = empresaId ? `/empresas/${empresaId}/historial` : '/historial';

    // ─ Render ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando...</div>
            </div>
        );
    }

    if (!empresa) {
        return <div className="text-center py-12 text-muted-foreground">No tienes una empresa asignada.</div>;
    }

    const presets: { key: Exclude<RangePreset, 'custom'>; label: string }[] = [
        { key: '7d', label: '7 días' },
        { key: '30d', label: '30 días' },
        { key: '3m', label: '3 meses' }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                {empresa.logo_url ? (
                    <img src={empresa.logo_url} alt={empresa.nombre}
                        className="h-12 w-12 object-contain rounded-xl border p-1" />
                ) : (
                    <div className="h-12 w-12 rounded-xl border bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                        {empresa.nombre.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-bold">{empresa.nombre}</h1>
                    <p className="text-sm text-muted-foreground">Dashboard de actividad</p>
                </div>
            </div>

            {/* Date range selector */}
            <div className="flex flex-wrap items-center gap-2">
                {presets.map(p => (
                    <Button key={p.key} variant={preset === p.key ? 'default' : 'outline'} size="sm" onClick={() => applyPreset(p.key)}>
                        {p.label}
                    </Button>
                ))}
                <Button variant={preset === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setPreset('custom')}>
                    Personalizado
                </Button>
                {preset === 'custom' && (
                    <div className="flex items-center gap-2 ml-1">
                        <Input type="date" className="h-8 w-36 text-sm" value={customDesde} max={customHasta} onChange={e => setCustomDesde(e.target.value)} />
                        <span className="text-muted-foreground text-sm">→</span>
                        <Input type="date" className="h-8 w-36 text-sm" value={customHasta} min={customDesde} onChange={e => setCustomHasta(e.target.value)} />
                        <Button size="sm" onClick={applyCustom}>Aplicar</Button>
                    </div>
                )}
                {loadingConsumos && <span className="text-xs text-muted-foreground animate-pulse ml-1">Actualizando...</span>}
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Extracciones</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalExtracciones}</div>
                        <p className="text-xs text-muted-foreground mt-1">Perfiles consultados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Apollo</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalApollo}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total consumidos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Verifier</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalVerifier}</div>
                        <p className="text-xs text-muted-foreground mt-1">Emails verificados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">SDRs activos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{sdrsActivos}</div>
                        <p className="text-xs text-muted-foreground mt-1">Con extracciones en el período</p>
                    </CardContent>
                </Card>
            </div>

            {/* Activity chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Extracciones por día</CardTitle>
                </CardHeader>
                <CardContent>
                    {totalExtracciones === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                            Sin actividad en el período seleccionado.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id="gradExt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tickFormatter={formatAxisDate}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false} axisLine={false}
                                    interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                                <YAxis allowDecimals={false}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="extracciones" name="Extracciones"
                                    stroke="hsl(var(--primary))" strokeWidth={2}
                                    fill="url(#gradExt)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* SDR Ranking — fusiona actividad + perfil */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle>Ranking de SDRs</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{usuarios.length} registrados · ordenados por extracciones en el período</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={refreshUsuarios} disabled={refreshingUsuarios} className="h-8 w-8 p-0">
                        <RefreshCw className={`h-4 w-4 ${refreshingUsuarios ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent>
                    {sdrRanking.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">Aún no hay SDRs registrados.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>SDR</TableHead>
                                    <TableHead className="text-right">Extracciones</TableHead>
                                    <TableHead className="text-right">Apollo</TableHead>
                                    <TableHead className="text-right">Verifier</TableHead>
                                    <TableHead className="text-right">Desde</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sdrRanking.map((r, i) => {
                                    const u = r.sdr;
                                    const displayName = u?.nombre || r.email;
                                    const displayEmail = u?.nombre ? r.email : undefined;
                                    return (
                                        <TableRow key={r.email}>
                                            <TableCell className="text-muted-foreground font-medium w-8">
                                                {i + 1}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    {u?.avatar_url
                                                        ? <img src={u.avatar_url} alt={displayName} className="h-7 w-7 rounded-full object-cover shrink-0" />
                                                        : <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                            {displayName.charAt(0).toUpperCase()}
                                                          </div>
                                                    }
                                                    <div>
                                                        <p className="text-sm font-medium leading-none">{displayName}</p>
                                                        {displayEmail && <p className="text-xs text-muted-foreground mt-0.5">{displayEmail}</p>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={r.extracciones > 0 ? 'secondary' : 'outline'}>{r.extracciones}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm">{r.apollo || '—'}</TableCell>
                                            <TableCell className="text-right text-sm">{r.verifier || '—'}</TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {u?.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CL') : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Últimas capturas — preview */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle>Últimas capturas</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Leads guardados recientemente en Google Sheets</p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(registrosRoute)}>
                        Ver más <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {loadingCaptures ? (
                        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground animate-pulse">Cargando...</div>
                    ) : lastCaptures.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">
                            Aún no hay leads capturados en sheets.
                        </p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>SDR</TableHead>
                                        <TableHead>Empresa</TableHead>
                                        <TableHead>Sheet</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lastCaptures.map(c => {
                                        const ld = c.lead_data!;
                                        const sdr = usuarios.find(u => u.id === c.usuario_id);
                                        const sdrLabel = sdr?.nombre || sdr?.email || c.usuario?.email || '—';
                                        return (
                                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setCapturePanel({ lead: ld, sheet_name: c.sheet_name })}>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(c.fecha).toLocaleDateString('es-CL')}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">
                                                    {ld.full_name || `${ld.first_name || ''} ${ld.last_name || ''}`.trim() || '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {ld.primary_email || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        {sdr?.avatar_url
                                                            ? <img src={sdr.avatar_url} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                                                            : <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{sdrLabel.charAt(0).toUpperCase()}</div>
                                                        }
                                                        <span className="text-sm truncate max-w-[120px]">{sdrLabel}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{ld.company_name || '—'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{c.sheet_name || '—'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <div className="pt-3 flex justify-end">
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(registrosRoute)}>
                                    Ver todos los registros <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Panel lateral de detalle de captura */}
            <Sheet open={!!capturePanel} onOpenChange={open => { if (!open) setCapturePanel(null); }}>
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
                    {capturePanel && (() => {
                        const ld = capturePanel.lead;
                        const statusMap: Record<string, string> = { valid: 'Válido', invalid: 'Inválido', catch_all: 'Catch-All' };
                        const statusLabel = ld.email_status ? (statusMap[ld.email_status] || ld.email_status) : 'Sin verificar';
                        const statusVariant = ld.email_status === 'valid' ? 'default' : ld.email_status === 'invalid' ? 'destructive' : 'secondary';
                        return (
                            <>
                                <SheetHeader>
                                    <SheetTitle>{ld.full_name || `${ld.first_name || ''} ${ld.last_name || ''}`.trim() || 'Prospecto'}</SheetTitle>
                                    <SheetDescription className="flex flex-wrap gap-1.5 items-center">
                                        {ld.title && <span>{ld.title}</span>}
                                        {ld.company_name && <span>· {ld.company_name}</span>}
                                    </SheetDescription>
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
                                    {capturePanel.sheet_name && (
                                        <>
                                            <Separator />
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sheet</p>
                                                <p className="text-sm">{capturePanel.sheet_name}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </SheetContent>
            </Sheet>
        </div>
    );
}
