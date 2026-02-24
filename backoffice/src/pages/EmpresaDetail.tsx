import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEmpresa, getEmpresaUsuarios, getConsumos, updateEmpresa, toggleTenantKey, regenerateTenantKey } from '../lib/api';
import type { EmpresaDetail as EmpresaDetailType, ExtensionUser, Consumo } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../components/ui/alert-dialog';
import { ArrowLeft, Copy, Users, Zap, CheckCircle, Eye, EyeOff, RefreshCw, PowerOff, Power } from 'lucide-react';

export default function EmpresaDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [empresa, setEmpresa] = useState<EmpresaDetailType | null>(null);
    const [usuarios, setUsuarios] = useState<ExtensionUser[]>([]);
    const [consumos, setConsumos] = useState<Consumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showApollo, setShowApollo] = useState(false);
    const [showMillion, setShowMillion] = useState(false);
    const [keyActionLoading, setKeyActionLoading] = useState<'toggle' | 'regen' | null>(null);
    const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

    // Form state
    const [editNombre, setEditNombre] = useState('');
    const [editApollo, setEditApollo] = useState('');
    const [editMillion, setEditMillion] = useState('');
    const [editLogoUrl, setEditLogoUrl] = useState('');

    useEffect(() => {
        if (!id) return;
        Promise.all([
            getEmpresa(id),
            getEmpresaUsuarios(id),
            getConsumos(id)
        ]).then(([emp, users, cons]) => {
            setEmpresa(emp);
            setEditNombre(emp.nombre);
            setEditApollo(emp.apollo_api_key || '');
            setEditMillion(emp.millionverifier_api_key || '');
            setEditLogoUrl(emp.logo_url || '');
            setUsuarios(users);
            setConsumos(cons);
        }).catch(() => toast.error('Error al cargar empresa'))
          .finally(() => setLoading(false));
    }, [id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        try {
            const updated = await updateEmpresa(id, {
                nombre: editNombre,
                apollo_api_key: editApollo,
                millionverifier_api_key: editMillion,
                logo_url: editLogoUrl
            });
            setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
            toast.success('Cambios guardados');
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyKey = () => {
        if (!empresa) return;
        navigator.clipboard.writeText(empresa.tenant_api_key);
        toast.success('Copiado al portapapeles');
    };

    const handleToggleKey = async () => {
        if (!empresa || !id) return;
        setKeyActionLoading('toggle');
        try {
            const { key_active } = await toggleTenantKey(id);
            setEmpresa(prev => prev ? { ...prev, key_active } : prev);
            toast.success(key_active ? 'Key habilitada' : 'Key inhabilitada');
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar estado');
        } finally {
            setKeyActionLoading(null);
        }
    };

    const handleRegenerateKey = async () => {
        if (!empresa || !id) return;
        setKeyActionLoading('regen');
        try {
            const { tenant_api_key } = await regenerateTenantKey(id);
            setEmpresa(prev => prev ? { ...prev, tenant_api_key } : prev);
            toast.success('Key regenerada — avisa a los SDRs para que actualicen la extensión.');
        } catch (error: any) {
            toast.error(error.message || 'Error al regenerar la key');
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
        return (
            <div className="text-center py-12 text-muted-foreground">
                Empresa no encontrada.
            </div>
        );
    }

    const totalApollo = consumos.reduce((s, c) => s + c.creditos_apollo, 0);
    const totalVerifier = consumos.reduce((s, c) => s + c.creditos_verifier, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/empresas')}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Empresas
                </Button>
                <div className="flex items-center gap-4">
                    {empresa.logo_url ? (
                        <img
                            src={empresa.logo_url}
                            alt={empresa.nombre}
                            className="h-12 w-12 object-contain rounded-xl border p-1"
                        />
                    ) : (
                        <div className="h-12 w-12 rounded-xl border bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                            {empresa.nombre.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold">{empresa.nombre}</h1>
                        <Badge variant="secondary" className="gap-1 mt-0.5">
                            <Users className="h-3 w-3" />
                            {empresa._count.extensionUsers} usuarios
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios activos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{empresa._count.extensionUsers}</div>
                        <p className="text-xs text-muted-foreground mt-1">SDRs conectados</p>
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
            </div>

            {/* Two-column: edit form + tenant key */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Edit form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Datos de la Empresa</CardTitle>
                        <CardDescription>Edita el nombre, logo y claves de integración.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>URL del Logo</Label>
                                <Input
                                    value={editLogoUrl}
                                    onChange={e => setEditLogoUrl(e.target.value)}
                                    placeholder="https://ejemplo.com/logo.png"
                                />
                                {editLogoUrl && (
                                    <img src={editLogoUrl} alt="preview" className="h-10 object-contain rounded border p-1" />
                                )}
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Apollo API Key</Label>
                                <div className="relative">
                                    <Input
                                        type={showApollo ? 'text' : 'password'}
                                        value={editApollo}
                                        onChange={e => setEditApollo(e.target.value)}
                                        placeholder="sk_..."
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowApollo(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                                        {showApollo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>MillionVerifier API Key</Label>
                                <div className="relative">
                                    <Input
                                        type={showMillion ? 'text' : 'password'}
                                        value={editMillion}
                                        onChange={e => setEditMillion(e.target.value)}
                                        placeholder="••••••••"
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowMillion(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                                        {showMillion ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <Button type="submit" disabled={saving} className="w-full">
                                {saving ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Tenant Key */}
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                        <div>
                            <CardTitle>MrProspect Tenant Key</CardTitle>
                            <CardDescription className="mt-1">
                                Comparte esta clave con los SDRs para configurar la extensión Chrome.
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
                        <div className="flex items-center gap-2 pt-1">
                            <Button
                                variant="outline"
                                size="sm"
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
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                                disabled={keyActionLoading !== null}
                                onClick={() => setConfirmRegenOpen(true)}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${keyActionLoading === 'regen' ? 'animate-spin' : ''}`} />
                                Regenerar key
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* Usuarios de extensión */}
            <Card>
                <CardHeader>
                    <CardTitle>Usuarios de la Extensión</CardTitle>
                    <CardDescription>SDRs autenticados con Google que usan este tenant.</CardDescription>
                </CardHeader>
                <CardContent>
                    {usuarios.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            Aún no hay usuarios conectados.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Búsquedas</TableHead>
                                    <TableHead>Desde</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.email}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary">{u._count.consumos}</Badge>
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

            {/* Consumos */}
            <Card>
                <CardHeader>
                    <CardTitle>Historial de consumo</CardTitle>
                    <CardDescription>Últimas 200 búsquedas de esta empresa.</CardDescription>
                </CardHeader>
                <CardContent>
                    {consumos.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            Sin registros de consumo aún.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead className="text-right">Apollo</TableHead>
                                    <TableHead className="text-right">Verifier</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consumos.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(c.fecha).toLocaleString('es-CL')}
                                        </TableCell>
                                        <TableCell className="text-sm">{c.usuario?.email}</TableCell>
                                        <TableCell className="text-right">{c.creditos_apollo}</TableCell>
                                        <TableCell className="text-right">{c.creditos_verifier}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Regenerar Tenant Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se generará una nueva clave para <strong>{empresa.nombre}</strong>.
                            Todos los SDRs que tengan la key anterior configurada en la extensión
                            dejarán de poder conectarse hasta que actualicen su configuración.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRegenerateKey}
                        >
                            Sí, regenerar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
