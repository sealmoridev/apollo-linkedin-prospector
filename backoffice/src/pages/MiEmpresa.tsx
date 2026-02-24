import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getMiEmpresa, getEmpresa, getEmpresaUsuarios, getConsumos } from '../lib/api';
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
import { Users, Zap, CheckCircle, Activity, RefreshCw } from 'lucide-react';

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
    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [usuarios, setUsuarios] = useState<ExtensionUser[]>([]);
    const [consumos, setConsumos] = useState<Consumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingConsumos, setLoadingConsumos] = useState(false);
    const [refreshingUsuarios, setRefreshingUsuarios] = useState(false);

    // Date range
    const [preset, setPreset] = useState<RangePreset>('7d');
    const [customDesde, setCustomDesde] = useState(toISO(new Date()));
    const [customHasta, setCustomHasta] = useState(toISO(new Date()));
    const [appliedRange, setAppliedRange] = useState(() => presetRange('7d'));

    // Clear empresa context on unmount (SuperAdmin leaving empresa view)
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

    // Apply a preset
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
        if (customDesde > customHasta) {
            toast.error('La fecha "desde" debe ser anterior a "hasta"');
            return;
        }
        setAppliedRange({ desde: customDesde, hasta: customHasta });
    };

    // ─ Derived data ──────────────────────────────────────────────────────────

    const totalExtracciones = consumos.length;
    const totalApollo = useMemo(() => consumos.reduce((s, c) => s + c.creditos_apollo, 0), [consumos]);
    const totalVerifier = useMemo(() => consumos.reduce((s, c) => s + c.creditos_verifier, 0), [consumos]);
    const sdrsActivos = useMemo(() => new Set(consumos.map(c => c.usuario_id)).size, [consumos]);

    const chartData = useMemo(() => {
        const byDate = new Map<string, { date: string; extracciones: number; apollo: number }>();
        consumos.forEach(c => {
            const date = new Date(c.fecha).toLocaleDateString('sv');
            const prev = byDate.get(date) || { date, extracciones: 0, apollo: 0 };
            prev.extracciones += 1;
            prev.apollo += c.creditos_apollo;
            byDate.set(date, prev);
        });
        // Fill all dates in range with 0
        return fillDateRange(appliedRange.desde, appliedRange.hasta).map(date => ({
            date,
            extracciones: byDate.get(date)?.extracciones ?? 0,
            apollo: byDate.get(date)?.apollo ?? 0
        }));
    }, [consumos, appliedRange]);

    const userBreakdown = useMemo(() => {
        const byUser = new Map<string, { email: string; extracciones: number; apollo: number; verifier: number }>();
        consumos.forEach(c => {
            const email = c.usuario?.email ?? c.usuario_id;
            const prev = byUser.get(email) || { email, extracciones: 0, apollo: 0, verifier: 0 };
            prev.extracciones += 1;
            prev.apollo += c.creditos_apollo;
            prev.verifier += c.creditos_verifier;
            byUser.set(email, prev);
        });
        return Array.from(byUser.values()).sort((a, b) => b.extracciones - a.extracciones);
    }, [consumos]);

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
                    <Button
                        key={p.key}
                        variant={preset === p.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyPreset(p.key)}
                    >
                        {p.label}
                    </Button>
                ))}
                <Button
                    variant={preset === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreset('custom')}
                >
                    Personalizado
                </Button>

                {preset === 'custom' && (
                    <div className="flex items-center gap-2 ml-1">
                        <Input
                            type="date"
                            className="h-8 w-36 text-sm"
                            value={customDesde}
                            max={customHasta}
                            onChange={e => setCustomDesde(e.target.value)}
                        />
                        <span className="text-muted-foreground text-sm">→</span>
                        <Input
                            type="date"
                            className="h-8 w-36 text-sm"
                            value={customHasta}
                            min={customDesde}
                            onChange={e => setCustomHasta(e.target.value)}
                        />
                        <Button size="sm" onClick={applyCustom}>Aplicar</Button>
                    </div>
                )}

                {loadingConsumos && (
                    <span className="text-xs text-muted-foreground animate-pulse ml-1">Actualizando...</span>
                )}
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
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatAxisDate}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="extracciones"
                                    name="Extracciones"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fill="url(#gradExt)"
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* User breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Actividad por SDR</CardTitle>
                </CardHeader>
                <CardContent>
                    {userBreakdown.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            Sin actividad en el período seleccionado.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SDR</TableHead>
                                    <TableHead className="text-right">Extracciones</TableHead>
                                    <TableHead className="text-right">Apollo</TableHead>
                                    <TableHead className="text-right">Verifier</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userBreakdown.map(u => (
                                    <TableRow key={u.email}>
                                        <TableCell className="font-medium">{u.email}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary">{u.extracciones}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">{u.apollo}</TableCell>
                                        <TableCell className="text-right text-sm">{u.verifier}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* SDRs registrados */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle>SDRs registrados ({usuarios.length})</CardTitle>
                    <Button variant="ghost" size="sm" onClick={refreshUsuarios} disabled={refreshingUsuarios} className="h-8 w-8 p-0">
                        <RefreshCw className={`h-4 w-4 ${refreshingUsuarios ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent>
                    {usuarios.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">
                            Aún no hay SDRs conectados.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SDR</TableHead>
                                    <TableHead className="text-right">Búsquedas totales</TableHead>
                                    <TableHead>Desde</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                {u.avatar_url
                                                    ? <img src={u.avatar_url} alt={u.nombre || u.email} className="h-7 w-7 rounded-full object-cover shrink-0" />
                                                    : <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                        {(u.nombre || u.email).charAt(0).toUpperCase()}
                                                      </div>
                                                }
                                                <div>
                                                    {u.nombre && <p className="text-sm font-medium leading-none">{u.nombre}</p>}
                                                    <p className={`text-muted-foreground ${u.nombre ? 'text-xs mt-0.5' : 'text-sm font-medium'}`}>{u.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{u._count.consumos}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(u.createdAt).toLocaleDateString('es-CL')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
