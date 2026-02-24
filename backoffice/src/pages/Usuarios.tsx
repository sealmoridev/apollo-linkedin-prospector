import React, { useEffect, useState } from 'react';
import {
    getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
    changeAdminUserPassword, getEmpresas
} from '../lib/api';
import type { AdminUser, EmpresaDetail } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '../components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../components/ui/alert-dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Eye, EyeOff, Pencil, KeyRound, Trash2, UserPlus } from 'lucide-react';

// ─── Create dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    empresas: EmpresaDetail[];
    onCreated: (u: AdminUser) => void;
}

function CreateDialog({ open, onOpenChange, empresas, onCreated }: CreateDialogProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'SUPERADMIN'>('ADMIN');
    const [empresaId, setEmpresaId] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => { setEmail(''); setPassword(''); setRole('ADMIN'); setEmpresaId(''); setShowPwd(false); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (role === 'ADMIN' && !empresaId) {
            toast.error('Selecciona una empresa para el ADMIN');
            return;
        }
        setSubmitting(true);
        try {
            const created = await createAdminUser({
                email, password, role,
                empresa_id: role === 'ADMIN' ? empresaId : undefined
            });
            toast.success('Usuario creado');
            onCreated(created);
            reset();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Error al crear usuario');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nuevo usuario administrador</DialogTitle>
                    <DialogDescription>Crea un ADMIN (empresa) o SUPERADMIN (global).</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@empresa.com" />
                    </div>
                    <div className="space-y-2">
                        <Label>Contraseña</Label>
                        <div className="relative">
                            <Input
                                type={showPwd ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required minLength={8}
                                placeholder="Mínimo 8 caracteres"
                                className="pr-10"
                            />
                            <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Rol</Label>
                        <Select value={role} onValueChange={v => setRole(v as 'ADMIN' | 'SUPERADMIN')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">ADMIN (empresa)</SelectItem>
                                <SelectItem value="SUPERADMIN">SUPERADMIN (global)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {role === 'ADMIN' && (
                        <div className="space-y-2">
                            <Label>Empresa</Label>
                            <Select value={empresaId} onValueChange={setEmpresaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona empresa..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {empresas.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => { reset(); onOpenChange(false); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Creando...' : 'Crear usuario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    user: AdminUser | null;
    empresas: EmpresaDetail[];
    onSaved: (u: AdminUser) => void;
}

function EditDialog({ open, onOpenChange, user, empresas, onSaved }: EditDialogProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'SUPERADMIN'>('ADMIN');
    const [empresaId, setEmpresaId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            setEmail(user.email);
            setRole(user.role);
            setEmpresaId(user.empresa_id || '');
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (role === 'ADMIN' && !empresaId) {
            toast.error('Selecciona una empresa para el ADMIN');
            return;
        }
        setSubmitting(true);
        try {
            const updated = await updateAdminUser(user.id, {
                email,
                role,
                empresa_id: role === 'ADMIN' ? empresaId : null
            });
            toast.success('Usuario actualizado');
            onSaved(updated);
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Error al actualizar');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar usuario</DialogTitle>
                    <DialogDescription>Modifica email, rol y empresa asignada.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Rol</Label>
                        <Select value={role} onValueChange={v => setRole(v as 'ADMIN' | 'SUPERADMIN')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">ADMIN (empresa)</SelectItem>
                                <SelectItem value="SUPERADMIN">SUPERADMIN (global)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {role === 'ADMIN' && (
                        <div className="space-y-2">
                            <Label>Empresa</Label>
                            <Select value={empresaId} onValueChange={setEmpresaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona empresa..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {empresas.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Change password dialog ───────────────────────────────────────────────────

interface PasswordDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    user: AdminUser | null;
    onChanged: () => void;
}

function PasswordDialog({ open, onOpenChange, user, onChanged }: PasswordDialogProps) {
    const [newPassword, setNewPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => { setNewPassword(''); setShowPwd(false); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);
        try {
            await changeAdminUserPassword(user.id, newPassword);
            toast.success('Contraseña actualizada');
            reset();
            onChanged();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Error al cambiar contraseña');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Cambiar contraseña</DialogTitle>
                    <DialogDescription>
                        Nueva contraseña para <strong>{user?.email}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Nueva contraseña</Label>
                        <div className="relative">
                            <Input
                                type={showPwd ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required minLength={8}
                                placeholder="Mínimo 8 caracteres"
                                className="pr-10"
                            />
                            <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => { reset(); onOpenChange(false); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Cambiar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Usuarios() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaDetail[]>([]);
    const [loading, setLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        Promise.all([getAdminUsers(), getEmpresas()])
            .then(([us, es]) => { setUsers(us); setEmpresas(es); })
            .catch(() => toast.error('Error al cargar datos'))
            .finally(() => setLoading(false));
    }, []);

    const handleCreated = (u: AdminUser) => setUsers(prev => [u, ...prev]);

    const handleSaved = (updated: AdminUser) =>
        setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteAdminUser(deleteTarget.id);
            setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
            toast.success('Usuario eliminado');
            setDeleteTarget(null);
        } catch (err: any) {
            toast.error(err.message || 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Usuarios administradores</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Gestiona quién tiene acceso al backoffice.</p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Nuevo usuario
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios ({users.length})</CardTitle>
                    <CardDescription>Todos los administradores registrados en el sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            No hay usuarios administradores.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Creado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={u.role === 'SUPERADMIN' ? 'default' : 'secondary'}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {u.empresa?.nombre ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(u.createdAt).toLocaleDateString('es-CL')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Editar"
                                                    onClick={() => setEditTarget(u)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Cambiar contraseña"
                                                    onClick={() => setPasswordTarget(u)}
                                                >
                                                    <KeyRound className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    title="Eliminar"
                                                    onClick={() => setDeleteTarget(u)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <CreateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                empresas={empresas}
                onCreated={handleCreated}
            />

            <EditDialog
                open={editTarget !== null}
                onOpenChange={v => { if (!v) setEditTarget(null); }}
                user={editTarget}
                empresas={empresas}
                onSaved={handleSaved}
            />

            <PasswordDialog
                open={passwordTarget !== null}
                onOpenChange={v => { if (!v) setPasswordTarget(null); }}
                user={passwordTarget}
                onChanged={() => setPasswordTarget(null)}
            />

            <AlertDialog open={deleteTarget !== null} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente <strong>{deleteTarget?.email}</strong>.
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
