import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveEmpresa } from '../ActiveEmpresaContext';
import { getMiEmpresa, getEmpresa, updateEmpresa } from '../lib/api';
import type { EmpresaDetail } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ImageIcon } from 'lucide-react';

export default function EmpresaConfig() {
    const { id: empresaId } = useParams<{ id?: string }>();
    const { setActiveEmpresa } = useActiveEmpresa();

    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editNombre, setEditNombre] = useState('');
    const [editLogoUrl, setEditLogoUrl] = useState('');

    // Cleanup context on unmount (SA only)
    useEffect(() => {
        return () => { if (empresaId) setActiveEmpresa(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    useEffect(() => {
        const fetch = empresaId ? getEmpresa(empresaId) : getMiEmpresa();
        fetch
            .then(emp => {
                setEmpresa(emp);
                setEditNombre(emp.nombre);
                setEditLogoUrl(emp.logo_url || '');
                if (empresaId) setActiveEmpresa({ id: emp.id, nombre: emp.nombre, logo_url: emp.logo_url });
            })
            .catch(() => toast.error('Error al cargar datos de empresa'))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empresa) return;
        setSaving(true);
        try {
            const updated = await updateEmpresa(empresa.id, {
                nombre: editNombre,
                logo_url: editLogoUrl
            });
            setEmpresa(prev => prev ? { ...prev, ...updated } : updated);
            // Update sidebar context with new nombre/logo
            setActiveEmpresa({ id: empresa.id, nombre: editNombre, logo_url: editLogoUrl || null });
            toast.success('Datos de empresa guardados');
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
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
                <h1 className="text-2xl font-bold">Configuración de empresa</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Nombre, identidad visual y clave de acceso para la extensión Chrome.
                </p>
            </div>

            {/* Nombre + Logo */}
            <Card>
                <CardHeader>
                    <CardTitle>Identidad de la empresa</CardTitle>
                    <CardDescription>Nombre y logo que aparecen en el panel de administración.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre de la empresa</Label>
                            <Input
                                value={editNombre}
                                onChange={e => setEditNombre(e.target.value)}
                                required
                                placeholder="Acme Corp"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>URL del logo</Label>
                            <Input
                                value={editLogoUrl}
                                onChange={e => setEditLogoUrl(e.target.value)}
                                placeholder="https://ejemplo.com/logo.png"
                            />
                            <p className="text-xs text-muted-foreground">
                                Se mostrará en el sidebar y en el dashboard de actividad.
                            </p>
                        </div>

                        {/* Logo preview */}
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                            {editLogoUrl ? (
                                <img
                                    src={editLogoUrl}
                                    alt="preview"
                                    className="h-12 w-12 rounded-lg object-contain border p-1 bg-background"
                                    onError={e => (e.currentTarget.style.display = 'none')}
                                />
                            ) : (
                                <div className="h-12 w-12 rounded-lg border bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <ImageIcon className="h-5 w-5" />
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium">{editNombre || 'Nombre de empresa'}</p>
                                <p className="text-xs text-muted-foreground">Vista previa en sidebar</p>
                            </div>
                        </div>

                        <Button type="submit" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar datos'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

        </div>
    );
}
