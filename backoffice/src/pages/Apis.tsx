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

    const saveApiKey = async (
        field: 'apollo_api_key' | 'millionverifier_api_key' | 'prospeo_api_key' | 'findymail_api_key' | 'leadmagic_api_key',
        value: string
    ) => {
        if (!empresa) throw new Error('No hay empresa cargada');
        const updated = await updateEmpresa(empresa.id, { [field]: value });
        setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
    };

    const saveProvider = async (provider: 'apollo' | 'prospeo' | 'findymail' | 'leadmagic') => {
        if (!empresa) throw new Error('No hay empresa cargada');
        const updated = await updateEmpresa(empresa.id, { enrichment_provider: provider });
        setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
        const names: Record<string, string> = { apollo: 'Apollo.io', prospeo: 'Prospeo', findymail: 'Findymail', leadmagic: 'LeadMagic' };
        toast.success(`Proveedor principal: ${names[provider]}`);
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

    const currentProvider = empresa.enrichment_provider || 'apollo';

    const enrichmentProviders: { id: typeof currentProvider; logo: string; name: string; desc: string }[] = [
        { id: 'apollo',    logo: `${import.meta.env.BASE_URL}apolloicon.png`,   name: 'Apollo.io',  desc: 'Email + Teléfono async webhook.' },
        { id: 'prospeo',   logo: `${import.meta.env.BASE_URL}prospeoicon.png`,  name: 'Prospeo',    desc: 'Email + Teléfono sincrónico. $39/mes.' },
        { id: 'findymail', logo: `${import.meta.env.BASE_URL}apolloicon.png`,   name: 'Findymail',  desc: 'Email por LinkedIn URL. $49/mes.' },
        { id: 'leadmagic', logo: `${import.meta.env.BASE_URL}apolloicon.png`,   name: 'LeadMagic',  desc: 'Email + Teléfono. 300 req/min. $99/mes.' },
    ];

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold">Integraciones API</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Configura los proveedores de enriquecimiento. El proveedor principal se usa en la extracción inicial;
                    los demás configurados estarán disponibles en la cascada.
                </p>
            </div>

            {/* ── Proveedor Principal ───────────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border bg-muted">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Proveedor Principal</CardTitle>
                            <CardDescription className="mt-0.5 text-xs">
                                Usado en la extracción inicial. Los demás aparecen en la cascada de búsqueda.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                        {enrichmentProviders.map(p => (
                            <button
                                key={p.id}
                                onClick={() => saveProvider(p.id)}
                                className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                                    currentProvider === p.id
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border hover:border-muted-foreground/40'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <img src={p.logo} alt={p.name} className="h-5 object-contain" />
                                    {currentProvider === p.id && (
                                        <Badge variant="default" className="text-[10px] py-0">Principal</Badge>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold">{p.name}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ── Claves de API ────────────────────────────────────────────── */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Claves de acceso</p>

            <ApiKeyCard
                title="Apollo.io"
                description="Email + teléfono async (webhook). Requiere plan Organization para teléfonos."
                logoUrl={`${import.meta.env.BASE_URL}Apollo-Logo.png`}
                initialValue={empresa.apollo_api_key ?? ''}
                placeholder="sk_..."
                docsUrl="https://app.apollo.io"
                onSave={(key) => saveApiKey('apollo_api_key', key)}
            />

            <ApiKeyCard
                title="Prospeo"
                description="Email + teléfono sincrónico en la misma respuesta. Desde $39/mes."
                logoUrl={`${import.meta.env.BASE_URL}prospeoicon.png`}
                initialValue={empresa.prospeo_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://prospeo.io"
                onSave={(key) => saveApiKey('prospeo_api_key', key)}
            />

            <ApiKeyCard
                title="Findymail"
                description="Email por LinkedIn URL directo. 1 crédito/email encontrado. $49/mes."
                Icon={Zap}
                iconClass="text-blue-400"
                initialValue={empresa.findymail_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://findymail.com"
                onSave={(key) => saveApiKey('findymail_api_key', key)}
            />

            <ApiKeyCard
                title="LeadMagic"
                description="Email (nombre+dominio) + teléfono directo (5 créditos/teléfono). $99/mes."
                Icon={Zap}
                iconClass="text-purple-400"
                initialValue={empresa.leadmagic_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://leadmagic.io"
                onSave={(key) => saveApiKey('leadmagic_api_key', key)}
            />

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Verificación</p>

            <ApiKeyCard
                title="MillionVerifier"
                description="Verifica si un email es válido antes de guardarlo en el sheet."
                logoUrl={`${import.meta.env.BASE_URL}MillionVerifier-Logo.png`}
                initialValue={empresa.millionverifier_api_key ?? ''}
                placeholder="••••••••••••••••"
                docsUrl="https://millionverifier.com"
                onSave={(key) => saveApiKey('millionverifier_api_key', key)}
            />
        </div>
    );
}
