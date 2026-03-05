import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getApiCredits, getEmpresa } from '../lib/api';
import type { ApiCreditsResult } from '../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

// ─── Provider meta ───────────────────────────────────────────────────────────

const PROVIDERS = [
    {
        id: 'apollo',
        name: 'Apollo.io',
        logo: 'Apollo-Logo.png',
        dashboardUrl: 'https://app.apollo.io/#/settings/credits/current',
        color: 'text-orange-500',
    },
    {
        id: 'prospeo',
        name: 'Prospeo',
        logo: 'prospeoicon.png',
        dashboardUrl: 'https://prospeo.io/dashboard',
        color: 'text-blue-500',
    },
    {
        id: 'leadmagic',
        name: 'LeadMagic',
        logo: 'leadmagic-logo.jpeg',
        dashboardUrl: 'https://app.leadmagic.io',
        color: 'text-purple-500',
    },
    {
        id: 'findymail',
        name: 'Findymail',
        logo: 'findymail-logo.png',
        dashboardUrl: 'https://app.findymail.com',
        color: 'text-green-500',
    },
    {
        id: 'millionverifier',
        name: 'MillionVerifier',
        logo: 'MillionVerifier-Logo.png',
        dashboardUrl: 'https://app.millionverifier.com',
        color: 'text-teal-500',
    },
] as const;

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-semibold tabular-nums ${dim ? 'text-muted-foreground font-normal' : ''}`}>
                {value}
            </span>
        </div>
    );
}

// ─── Individual provider card ─────────────────────────────────────────────────

function ProviderCard({
    meta,
    data,
    loading,
}: {
    meta: typeof PROVIDERS[number];
    data: ApiCreditsResult[keyof ApiCreditsResult] | undefined;
    loading: boolean;
}) {
    const d = data as any;
    const configured = !!d?.configured;

    const renderBody = () => {
        if (loading) {
            return (
                <div className="space-y-2 mt-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-6 rounded bg-muted animate-pulse" />
                    ))}
                </div>
            );
        }
        if (!configured) {
            return (
                <p className="text-xs text-muted-foreground mt-4 text-center py-4">
                    API Key no configurada
                </p>
            );
        }
        if (d?.error) {
            return (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs">{d.error}</p>
                </div>
            );
        }

        // ── Apollo ───────────────────────────────────────────────────────────
        if (meta.id === 'apollo') {
            return (
                <div className="mt-3 space-y-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Uso registrado (nuestra DB)</p>
                    <StatRow label="Créditos este mes" value={d.db?.thisMonth ?? 0} />
                    <StatRow label="Enriquecimientos este mes" value={d.db?.enrichmentsThisMonth ?? 0} />
                    <StatRow label="Créditos totales histórico" value={d.db?.total ?? 0} dim />
                    <p className="text-[11px] text-muted-foreground mt-3">
                        Apollo no expone balance vía API. Para ver el balance exacto ve a tu dashboard de Apollo.
                    </p>
                </div>
            );
        }

        // ── Prospeo ──────────────────────────────────────────────────────────
        if (meta.id === 'prospeo') {
            return (
                <div className="mt-3 space-y-0">
                    {d.current_plan && <StatRow label="Plan" value={d.current_plan} />}
                    {d.remaining_credits != null && (
                        <StatRow label="Créditos restantes" value={d.remaining_credits.toLocaleString()} />
                    )}
                    {d.used_credits != null && (
                        <StatRow label="Créditos usados" value={d.used_credits.toLocaleString()} dim />
                    )}
                    {d.next_quota_renewal_date && (
                        <StatRow
                            label="Renovación"
                            value={new Date(d.next_quota_renewal_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                            dim
                        />
                    )}
                </div>
            );
        }

        // ── LeadMagic ────────────────────────────────────────────────────────
        if (meta.id === 'leadmagic') {
            const balance = d.credits ?? d.balance ?? d.remaining ?? d.credit_balance;
            return (
                <div className="mt-3 space-y-0">
                    {balance != null ? (
                        <StatRow label="Balance actual" value={Number(balance).toLocaleString()} />
                    ) : (
                        <p className="text-xs text-muted-foreground mt-2">Sin datos disponibles</p>
                    )}
                </div>
            );
        }

        // ── Findymail ────────────────────────────────────────────────────────
        if (meta.id === 'findymail') {
            const balance = d.credits ?? d.credits_remaining ?? d.remaining ?? d.available;
            const used = d.credits_used ?? d.used;
            return (
                <div className="mt-3 space-y-0">
                    {balance != null ? (
                        <StatRow label="Créditos disponibles" value={Number(balance).toLocaleString()} />
                    ) : null}
                    {used != null ? (
                        <StatRow label="Créditos usados" value={Number(used).toLocaleString()} dim />
                    ) : null}
                    {balance == null && used == null && (
                        <p className="text-xs text-muted-foreground mt-2">Sin datos disponibles</p>
                    )}
                </div>
            );
        }

        // ── MillionVerifier ──────────────────────────────────────────────────
        if (meta.id === 'millionverifier') {
            const balance = d.credits ?? d.balance ?? d.remaining ?? d.available_credits;
            return (
                <div className="mt-3 space-y-0">
                    {balance != null ? (
                        <StatRow label="Créditos disponibles" value={Number(balance).toLocaleString()} />
                    ) : (
                        <p className="text-xs text-muted-foreground mt-2">Sin datos de la API</p>
                    )}
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mt-3 mb-1">Uso registrado (nuestra DB)</p>
                    <StatRow label="Verificaciones este mes" value={d.db?.thisMonth ?? 0} />
                    <StatRow label="Verificaciones totales" value={d.db?.total ?? 0} dim />
                </div>
            );
        }

        return null;
    };

    return (
        <Card className={!configured ? 'opacity-50' : ''}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border bg-white overflow-hidden p-1">
                            <img
                                src={`${import.meta.env.BASE_URL}${meta.logo}`}
                                alt={meta.name}
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <div>
                            <CardTitle className="text-base">{meta.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                                {meta.id === 'apollo' ? 'Email · Teléfono async'
                                    : meta.id === 'prospeo' ? 'Email + Teléfono sync'
                                    : meta.id === 'leadmagic' ? 'Email + Teléfono directo'
                                    : meta.id === 'findymail' ? 'Buscador de email'
                                    : 'Verificación de email'}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <Badge variant={configured ? 'default' : 'secondary'} className="text-[10px] gap-1 shrink-0">
                            <span className={`h-1.5 w-1.5 rounded-full ${configured ? 'bg-green-400' : 'bg-muted-foreground/50'}`} />
                            {configured ? 'Activa' : 'Sin configurar'}
                        </Badge>
                        {configured && (
                            <a
                                href={meta.dashboardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-2.5 w-2.5" />
                                Dashboard
                            </a>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {renderBody()}
            </CardContent>
        </Card>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiCredits() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();

    const [credits, setCredits] = useState<ApiCreditsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Load empresa name for SA context
    useEffect(() => {
        if (!empresaId) return;
        getEmpresa(empresaId)
            .then(emp => setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url }))
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const data = await getApiCredits(empresaId);
            setCredits(data);
            setLastUpdated(new Date());
        } catch (err: any) {
            toast.error(err.message || 'Error al cargar créditos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [empresaId]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Consumos de API</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Balance y uso de créditos de cada proveedor integrado.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {lastUpdated && !loading && (
                        <span className="text-xs text-muted-foreground">
                            Actualizado {lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <Button
                        variant="outline" size="sm"
                        onClick={() => load(true)}
                        disabled={loading || refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {PROVIDERS.map(p => (
                    <ProviderCard
                        key={p.id}
                        meta={p}
                        data={credits?.[p.id as keyof ApiCreditsResult]}
                        loading={loading}
                    />
                ))}
            </div>
        </div>
    );
}
