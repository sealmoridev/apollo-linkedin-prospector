import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getMiEmpresa, getEmpresa, toggleTenantKey, regenerateTenantKey } from '../lib/api';
import type { EmpresaDetail } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../components/ui/alert-dialog';
import { Copy, RefreshCw, PowerOff, Power } from 'lucide-react';

export default function ExtensionChrome() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [keyActionLoading, setKeyActionLoading] = useState<'toggle' | 'regen' | null>(null);
    const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

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
            .catch(() => toast.error('Error al cargar datos'))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    const handleCopyKey = () => {
        if (!empresa) return;
        navigator.clipboard.writeText(empresa.tenant_api_key);
        toast.success('Copiado al portapapeles');
    };

    const handleToggleKey = async () => {
        if (!empresa) return;
        setKeyActionLoading('toggle');
        try {
            const { key_active } = await toggleTenantKey(empresa.id);
            setEmpresa(prev => prev ? { ...prev, key_active } : prev);
            toast.success(key_active ? 'Key habilitada' : 'Key inhabilitada');
        } catch (err: any) {
            toast.error(err.message || 'Error');
        } finally {
            setKeyActionLoading(null);
        }
    };

    const handleRegenerate = async () => {
        if (!empresa) return;
        setKeyActionLoading('regen');
        try {
            const { tenant_api_key } = await regenerateTenantKey(empresa.id);
            setEmpresa(prev => prev ? { ...prev, tenant_api_key } : prev);
            toast.success('Key regenerada — avisa a tus SDRs para que actualicen la extensión.');
        } catch (err: any) {
            toast.error(err.message || 'Error');
        } finally {
            setKeyActionLoading(null);
        }
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

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold">Extensión Chrome</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    API Key para conectar la extensión MrProspect con esta empresa.
                    Compártela con tus SDRs.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                    <div>
                        <CardTitle>API Key de la extensión</CardTitle>
                        <CardDescription className="mt-1">
                            Ingresa esta clave en los ajustes de la extensión MrProspect para
                            vincularla a esta empresa.
                        </CardDescription>
                    </div>
                    <Badge
                        variant={empresa.key_active ? 'default' : 'destructive'}
                        className="shrink-0 mt-0.5"
                    >
                        {empresa.key_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono select-all break-all">
                            {empresa.tenant_api_key}
                        </code>
                        <Button variant="outline" size="sm" onClick={handleCopyKey}>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copiar
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            className={empresa.key_active
                                ? 'gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive'
                                : 'gap-1.5 text-green-600 border-green-400/40 hover:bg-green-50 hover:text-green-700'
                            }
                            disabled={keyActionLoading !== null}
                            onClick={handleToggleKey}
                        >
                            {empresa.key_active
                                ? <><PowerOff className="h-3.5 w-3.5" /> Inhabilitar key</>
                                : <><Power className="h-3.5 w-3.5" /> Habilitar key</>
                            }
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            className="gap-1.5 text-muted-foreground hover:text-foreground"
                            disabled={keyActionLoading !== null}
                            onClick={() => setConfirmRegenOpen(true)}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${keyActionLoading === 'regen' ? 'animate-spin' : ''}`} />
                            Regenerar key
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Al regenerar se invalida la clave anterior. Los SDRs deberán actualizar su configuración.
                    </p>
                </CardContent>
            </Card>

            <AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Regenerar API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se generará una nueva clave para <strong>{empresa.nombre}</strong>.
                            Todos los SDRs con la clave anterior dejarán de conectarse hasta
                            que actualicen la extensión.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRegenerate}
                        >
                            Sí, regenerar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
