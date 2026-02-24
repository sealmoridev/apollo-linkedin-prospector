import React, { useState } from 'react';
import { createAdminUser } from '../lib/api';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle
} from './ui/dialog';
import { Eye, EyeOff } from 'lucide-react';

interface CreateAdminDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empresaId: string;
    empresaNombre: string;
    onCreated: () => void;
}

export function CreateAdminDialog({ open, onOpenChange, empresaId, empresaNombre, onCreated }: CreateAdminDialogProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createAdminUser({ email, password, role: 'ADMIN', empresa_id: empresaId });
            toast.success(`Admin creado para ${empresaNombre}`);
            setEmail('');
            setPassword('');
            onCreated();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || 'Error al crear admin');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Crear Administrador</DialogTitle>
                    <DialogDescription>
                        Crea un admin con acceso solo a <strong>{empresaNombre}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                            id="admin-email"
                            type="email"
                            placeholder="admin@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-password">Contraseña</Label>
                        <div className="relative">
                            <Input
                                id="admin-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 8 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Creando...' : 'Crear Admin'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
