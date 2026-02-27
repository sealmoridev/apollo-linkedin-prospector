import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getMiEmpresa, getEmpresa, updateEmpresa } from '../lib/api';
import type { EmpresaDetail } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Eye, EyeOff, Zap } from 'lucide-react';

// ─── ApiKeyCard — reusable, independiente por integración ─────────────────────

interface ApiKeyCardProps {
    title: string;
    description: string;
    logoUrl?: string;
    Icon?: React.ElementType;
    iconClass?: string;
    initialValue: string;
    placeholder: string;
    docsUrl?: string;
    onSave: (key: string) => Promise<void>;
}

function ApiKeyCard({
    title, description, logoUrl, Icon, iconClass,
    initialValue, placeholder, docsUrl, onSave
}: ApiKeyCardProps) {
    const [value, setValue] = useState(initialValue);
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const isConfigured = !!initialValue;

    useEffect(() => { setValue(initialValue); }, [initialValue]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(value);
            toast.success(`${title} actualizada`);
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border bg-white overflow-hidden p-1">
                            {logoUrl
                                ? <img src={logoUrl} alt={title} className="h-full w-full object-contain" />
                                : Icon && <Icon className={`h-5 w-5 ${iconClass ?? ''}`} />
                            }
                        </div>
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
                        </div>
                    </div>
                    <Badge
                        variant={isConfigured ? 'default' : 'secondary'}
                        className="shrink-0 text-xs gap-1"
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-muted-foreground/50'}`} />
                        {isConfigured ? 'Configurada' : 'No configurada'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Input
                                type={show ? 'text' : 'password'}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder={placeholder}
                                className="pr-10 font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShow(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                tabIndex={-1}
                            >
                                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <Button type="submit" size="sm" disabled={saving} className="shrink-0">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                    {docsUrl && (
                        <p className="text-xs text-muted-foreground">
                            Obtén tu clave en{' '}
                            <a
                                href={docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                {docsUrl.replace(/^https?:\/\//, '').split('/')[0]}
                            </a>
                        </p>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Apis() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Cleanup on unmount (SA only)
    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    useEffect(() => {
        const fetch = empresaId ? getEmpresa(empresaId) : getMiEmpresa();
        fetch
            .then(emp => {
                setEmpresa(emp);
                if (empresaId) setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url });
            })
            .catch(() => toast.error('Error al cargar APIs'))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    const saveApiKey = async (field: 'apollo_api_key' | 'millionverifier_api_key' | 'prospeo_api_key', value: string) => {
        if (!empresa) throw new Error('No hay empresa cargada');
        const updated = await updateEmpresa(empresa.id, { [field]: value });
        setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
    };

    const saveProvider = async (provider: 'apollo' | 'prospeo') => {
        if (!empresa) throw new Error('No hay empresa cargada');
        const updated = await updateEmpresa(empresa.id, { enrichment_provider: provider });
        setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
        toast.success(`Proveedor cambiado a ${provider === 'apollo' ? 'Apollo.io' : 'Prospeo'}`);
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando...</div>
            </div>
        );
    }

    if (!empresa) {
        return <div className="text-center py-12 text-muted-foreground">No hay empresa configurada.</div>;
    }

    const currentProvider: 'apollo' | 'prospeo' = (empresa.enrichment_provider as 'apollo' | 'prospeo') || 'apollo';

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold">Integraciones API</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Claves de acceso para los servicios externos que usa la extensión Chrome.
                    Cada API se guarda de forma independiente.
                </p>
            </div>

            {/* ── Proveedor de Enriquecimiento ─────────────────────────────── */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border bg-muted">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Proveedor de Enriquecimiento</CardTitle>
                            <CardDescription className="mt-0.5 text-xs">
                                Selecciona qué API usará la extensión para extraer datos de perfiles LinkedIn.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => saveProvider('apollo')}
                            className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                                currentProvider === 'apollo'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-muted-foreground/40'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <img src={`${import.meta.env.BASE_URL}Apollo-Logo.png`} alt="Apollo" className="h-6 object-contain" />
                                {currentProvider === 'apollo' && (
                                    <Badge variant="default" className="text-xs">Activo</Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium">Apollo.io</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Teléfono vía webhook async. Requiere plan Organization.
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => saveProvider('prospeo')}
                            className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                                currentProvider === 'prospeo'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-muted-foreground/40'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-semibold tracking-tight">Prospeo</span>
                                {currentProvider === 'prospeo' && (
                                    <Badge variant="default" className="text-xs">Activo</Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium">Prospeo.io</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Teléfono sincrónico en la misma respuesta. Desde $39/mes.
                                </p>
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* ── Claves de API ────────────────────────────────────────────── */}
            <ApiKeyCard
                title="Apollo.io"
                description="Enriquecimiento de perfiles de LinkedIn — contactos, emails y datos laborales."
                logoUrl={`${import.meta.env.BASE_URL}Apollo-Logo.png`}
                initialValue={empresa.apollo_api_key ?? ''}
                placeholder="sk_..."
                docsUrl="https://app.apollo.io"
                onSave={(key) => saveApiKey('apollo_api_key', key)}
            />

            <ApiKeyCard
                title="Prospeo.io"
                description="Alternativa a Apollo con teléfono sincrónico. Desde plan Starter ($39/mes)."
                Icon={Zap}
                iconClass="text-orange-400"
                initialValue={empresa.prospeo_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://prospeo.io"
                onSave={(key) => saveApiKey('prospeo_api_key', key)}
            />

            <ApiKeyCard
                title="MillionVerifier"
                description="Verificación de validez de emails antes de guardarlos en el sheet."
                logoUrl={`${import.meta.env.BASE_URL}MillionVerifier-Logo.png`}
                initialValue={empresa.millionverifier_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://millionverifier.com"
                onSave={(key) => saveApiKey('millionverifier_api_key', key)}
            />
        </div>
    );
}
