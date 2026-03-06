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
import { LeadDetailSheet } from '../components/LeadDetailSheet';
import { Zap, CheckCircle, Activity, RefreshCw, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Date helpers ─────────────────────────────────────────────────────────────

type RangePreset = 'hoy' | '7d' | '30d' | '3m' | 'custom';

function toISO(d: Date) {
    return d.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<RangePreset, 'custom'>): { desde: string; hasta: string } {
    const hasta = new Date();
    const desde = new Date();
    if (preset === '7d') desde.setDate(desde.getDate() - 6);
    else if (preset === '30d') desde.setDate(desde.getDate() - 29);
    else if (preset === '3m') desde.setMonth(desde.getMonth() - 3);
    // 'hoy': desde = hasta = today
    desde.setHours(0, 0, 0, 0);
    return { desde: toISO(desde), hasta: toISO(hasta) };
}

function formatAxisDate(iso: string) {
    const [, m, d] = iso.split('-');
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(d)} ${monthNames[parseInt(m) - 1]}`;
}

function formatAxisHour(hhmm: string) {
    return `${parseInt(hhmm)}h`;
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
    // Label is either an ISO date ("2026-03-05") or an hour string ("09:00")
    const isHour = /^\d{2}:\d{2}$/.test(label ?? '');
    const displayLabel = isHour ? label : (label ? formatAxisDate(label) : '');
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium mb-1">{displayLabel}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
}

// ─── SDR Sparkline ────────────────────────────────────────────────────────────

function buildSparkData(dates: Date[]): { h: number; v: number }[] {
    if (dates.length === 0) return [];
    const hours = dates.map(d => d.getHours());
    const minH = Math.min(...hours);
    const maxH = Math.max(...hours);
    const result: { h: number; v: number }[] = [];
    for (let h = minH; h <= maxH; h++) {
        result.push({ h, v: hours.filter(hh => hh === h).length });
    }
    return result;
}

function Sparkline({ data, id }: { data: { h: number; v: number }[]; id: string }) {
    return (
        <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="h"
                    tickFormatter={h => `${h}h`}
                    tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                />
                <Area
                    type="monotone" dataKey="v"
                    stroke="hsl(var(--primary))" strokeWidth={1.5}
                    fill={`url(#${id})`} dot={false} isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
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
    const [capturePanel, setCapturePanel] = useState<Consumo | null>(null);

    // Ranking SDR — fecha independiente del filtro del dashboard
    const [rankingDate, setRankingDate] = useState(() => toISO(new Date()));
    const [rankingCaptures, setRankingCaptures] = useState<Consumo[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);

    // Date range
    const [preset, setPreset] = useState<RangePreset>('hoy');
    const [customDesde, setCustomDesde] = useState(toISO(new Date()));
    const [customHasta, setCustomHasta] = useState(toISO(new Date()));
    const [appliedRange, setAppliedRange] = useState(() => presetRange('hoy'));

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

    // Fetch ranking captures for the selected day (independent of dashboard range)
    useEffect(() => {
        if (!empresa) return;
        setLoadingRanking(true);
        getConsumos(empresa.id, rankingDate, rankingDate)
            .then(cs => setRankingCaptures(cs.filter(c => c.lead_data != null)))
            .catch(() => {})
            .finally(() => setLoadingRanking(false));
    }, [empresa, rankingDate]);

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

    const shiftRankingDate = (days: number) => {
        const d = new Date(rankingDate + 'T00:00:00');
        d.setDate(d.getDate() + days);
        const next = toISO(d);
        if (next <= toISO(new Date())) setRankingDate(next);
    };

    // ─ Derived data ──────────────────────────────────────────────────────────

    // Map: sesion_id → { email, verif } from captures with credit_breakdown.
    // A solo consumo (enrich/verify) sharing a sesion_id is only skipped if the
    // corresponding credit is already > 0 in the capture's breakdown, preventing
    // double-counting while still surfacing credits when the old extension sent
    // verifierCalled=false (verification_credits=0 in bd, but creditos_verifier=1 in solo record).
    const sesionBreakdownMap = useMemo(() => {
        const map = new Map<string, { email: number; verif: number }>();
        consumos.forEach(c => {
            if (c.credit_breakdown != null && c.sesion_id != null) {
                map.set(c.sesion_id, {
                    email: c.credit_breakdown.email_credits,
                    verif: c.credit_breakdown.verification_credits,
                });
            }
        });
        return map;
    }, [consumos]);

    // Extracciones = solo capturas (lead guardado), no registros intermedios
    const totalExtracciones = useMemo(() => consumos.filter(c => c.lead_data != null).length, [consumos]);

    const totalMailCredits = useMemo(() => consumos.reduce((s, c) => {
        if (c.credit_breakdown != null) return s + c.credit_breakdown.email_credits;
        if (c.sesion_id) {
            const bd = sesionBreakdownMap.get(c.sesion_id);
            if (bd && bd.email > 0) return s; // already covered in capture breakdown
        }
        return s + c.creditos_apollo;
    }, 0), [consumos, sesionBreakdownMap]);

    const totalPhoneCredits = useMemo(() => consumos.reduce((s, c) => {
        if (c.credit_breakdown != null) return s + c.credit_breakdown.phone_credits;
        return s;
    }, 0), [consumos]);

    const totalVerifCredits = useMemo(() => consumos.reduce((s, c) => {
        if (c.credit_breakdown != null) return s + c.credit_breakdown.verification_credits;
        if (c.sesion_id) {
            const bd = sesionBreakdownMap.get(c.sesion_id);
            if (bd && bd.verif > 0) return s; // already covered in capture breakdown
        }
        return s + c.creditos_verifier;
    }, 0), [consumos, sesionBreakdownMap]);


    const chartData = useMemo(() => {
        if (preset === 'hoy') {
            // Agrupación horaria — rango dinámico desde primera hasta última extracción
            const byHour = new Map<number, number>();
            consumos.filter(c => c.lead_data != null).forEach(c => {
                const h = new Date(c.fecha).getHours();
                byHour.set(h, (byHour.get(h) ?? 0) + 1);
            });
            if (byHour.size === 0) return [];
            const hours = Array.from(byHour.keys());
            const minH = Math.min(...hours);
            const maxH = Math.max(...hours);
            return Array.from({ length: maxH - minH + 1 }, (_, i) => {
                const h = minH + i;
                return {
                    date: `${h.toString().padStart(2, '0')}:00`,
                    extracciones: byHour.get(h) ?? 0,
                    apollo: 0,
                };
            });
        }

        // Agrupación diaria para rangos multi-día
        const byDate = new Map<string, { date: string; extracciones: number; apollo: number }>();
        consumos.forEach(c => {
            const date = new Date(c.fecha).toLocaleDateString('sv');
            const prev = byDate.get(date) || { date, extracciones: 0, apollo: 0 };
            if (c.lead_data != null) prev.extracciones += 1;
            if (c.credit_breakdown != null) {
                prev.apollo += c.credit_breakdown.email_credits + c.credit_breakdown.phone_credits;
            } else {
                const bd = c.sesion_id ? sesionBreakdownMap.get(c.sesion_id) : undefined;
                if (!bd || bd.email === 0) prev.apollo += c.creditos_apollo;
            }
            byDate.set(date, prev);
        });
        return fillDateRange(appliedRange.desde, appliedRange.hasta).map(date => ({
            date,
            extracciones: byDate.get(date)?.extracciones ?? 0,
            apollo: byDate.get(date)?.apollo ?? 0,
        }));
    }, [consumos, appliedRange, sesionBreakdownMap, preset]);

    // Ranking SDR: basado en rankingDate (independiente del filtro del dashboard).
    // Muestra extracciones del día con primera/última captura, sparkline horario y sheets trabajados.
    const sdrRanking = useMemo(() => {
        const emailToUser = new Map(usuarios.map(u => [u.email, u]));
        const byEmail = new Map<string, { email: string; extracciones: number; dates: Date[]; sheets: Map<string, number> }>();

        rankingCaptures.forEach(c => {
            const email = c.usuario?.email
                ?? usuarios.find(u => u.id === c.usuario_id)?.email
                ?? c.usuario_id;
            const entry = byEmail.get(email) || { email, extracciones: 0, dates: [] as Date[], sheets: new Map<string, number>() };
            entry.extracciones += 1;
            entry.dates.push(new Date(c.fecha));
            const sheetKey = c.sheet_name || 'Sin hoja';
            entry.sheets.set(sheetKey, (entry.sheets.get(sheetKey) ?? 0) + 1);
            byEmail.set(email, entry);
        });

        // Incluir SDRs registrados sin actividad en el día
        usuarios.forEach(u => {
            if (!byEmail.has(u.email)) byEmail.set(u.email, { email: u.email, extracciones: 0, dates: [], sheets: new Map() });
        });

        return Array.from(byEmail.values())
            .sort((a, b) => b.extracciones - a.extracciones)
            .map(r => {
                const sorted = [...r.dates].sort((a, b) => a.getTime() - b.getTime());
                return {
                    email: r.email,
                    extracciones: r.extracciones,
                    first: sorted[0] ?? null,
                    last: sorted[sorted.length - 1] ?? null,
                    sparkData: buildSparkData(r.dates),
                    sheets: r.sheets,
                    sdr: emailToUser.get(r.email),
                };
            });
    }, [rankingCaptures, usuarios]);

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
        { key: 'hoy', label: 'Hoy' },
        { key: '7d', label: '7 días' },
        { key: '30d', label: '30 días' },
        { key: '3m', label: '3 meses' },
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
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Mail</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalMailCredits}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total consumidos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Tel.</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalPhoneCredits}</div>
                        <p className="text-xs text-muted-foreground mt-1">Teléfonos encontrados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Verif.</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalVerifCredits}</div>
                        <p className="text-xs text-muted-foreground mt-1">Emails verificados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Activity chart */}
            <Card>
                <CardHeader>
                    <CardTitle>{preset === 'hoy' ? 'Extracciones por hora · hoy' : 'Extracciones por día'}</CardTitle>
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
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={preset === 'hoy' ? formatAxisHour : formatAxisDate}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false} axisLine={false}
                                    interval={preset === 'hoy' ? 0 : Math.max(0, Math.floor(chartData.length / 8) - 1)}
                                />
                                <YAxis allowDecimals={false}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="extracciones" name="Extracciones"
                                    stroke="hsl(var(--primary))" strokeWidth={2}
                                    fill="url(#gradExt)" dot={preset === 'hoy'} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* SDR Ranking — fecha propia con sparkline horario */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                    <div>
                        <CardTitle>Ranking de SDRs</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{sdrRanking.filter(r => r.extracciones > 0).length}</span> activos
                            · <span className="font-medium text-foreground">{usuarios.length}</span> registrados
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => shiftRankingDate(-1)}>
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                            type="date"
                            className="h-7 w-36 text-xs px-2"
                            value={rankingDate}
                            max={toISO(new Date())}
                            onChange={e => {
                                if (e.target.value && e.target.value <= toISO(new Date())) setRankingDate(e.target.value);
                            }}
                        />
                        <Button
                            variant="ghost" size="sm" className="h-7 w-7 p-0"
                            disabled={rankingDate >= toISO(new Date())}
                            onClick={() => shiftRankingDate(1)}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        {rankingDate < toISO(new Date()) && (
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setRankingDate(toISO(new Date()))}>
                                Hoy
                            </Button>
                        )}
                        {loadingRanking && <span className="text-xs text-muted-foreground animate-pulse px-1">...</span>}
                        <Button variant="ghost" size="sm" onClick={refreshUsuarios} disabled={refreshingUsuarios} className="h-7 w-7 p-0 ml-0.5">
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshingUsuarios ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {sdrRanking.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">Aún no hay SDRs registrados.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>SDR</TableHead>
                                    <TableHead className="text-right w-14">Extr.</TableHead>
                                    <TableHead className="min-w-[240px]">Actividad</TableHead>
                                    <TableHead>Sheets</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sdrRanking.map((r, i) => {
                                    const u = r.sdr;
                                    const displayName = u?.nombre || r.email;
                                    const displayEmail = u?.nombre ? r.email : undefined;
                                    const fmt = (d: Date) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <TableRow key={r.email}>
                                            <TableCell className="text-muted-foreground font-medium">
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
                                            <TableCell>
                                                {r.sparkData.length > 0 ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                                                            {r.first ? fmt(r.first) : ''}
                                                        </span>
                                                        <div className="flex-1 min-w-[160px]">
                                                            <Sparkline data={r.sparkData} id={`spark-${i}`} />
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-10">
                                                            {r.last ? fmt(r.last) : ''}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {r.sheets.size > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.from(r.sheets.entries()).map(([name, count]) => (
                                                            <Badge key={name} variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                                                                {name} · {count}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">—</span>
                                                )}
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
                                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setCapturePanel(c)}>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(c.fecha).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

            <LeadDetailSheet
                consumo={capturePanel}
                onClose={() => setCapturePanel(null)}
                onLeadUpdated={(consumoId, newLead) => {
                    setLastCaptures(prev => prev.map(c =>
                        c.id === consumoId ? { ...c, lead_data: newLead } : c
                    ));
                    setCapturePanel(prev => prev && prev.id === consumoId
                        ? { ...prev, lead_data: newLead }
                        : prev
                    );
                }}
                onLeadDeleted={(consumoId) => {
                    setLastCaptures(prev => prev.map(c =>
                        c.id === consumoId ? { ...c, lead_data: null } : c
                    ));
                    setCapturePanel(null);
                }}
            />
        </div>
    );
}
