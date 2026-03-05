import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { changeMyPassword } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

export default function CambiarPassword() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { logoutUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            toast.error('Las contraseñas no coinciden');
            return;
        }
        if (password.length < 8) {
            toast.error('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        setIsSubmitting(true);
        try {
            await changeMyPassword(password);
            toast.success('Contraseña actualizada. Inicia sesión de nuevo.');
            logoutUser();
            navigate('/login');
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar contraseña');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full">
            <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-12">
                <img
                    src={`${import.meta.env.BASE_URL}mrprospect-logo.png`}
                    alt="MR. PROSPECT"
                    className="w-72 brightness-0 invert"
                />
            </div>

            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-8 py-12 bg-background">
                <div className="w-full max-w-sm space-y-8">
                    <div className="flex justify-center lg:hidden">
                        <img src={`${import.meta.env.BASE_URL}isotipo.png`} alt="MR. PROSPECT" className="h-14" />
                    </div>

                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                            <KeyRound className="h-7 w-7 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Establece tu contraseña
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Crea una contraseña segura para tu cuenta antes de continuar.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">
                                Nueva contraseña
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="h-11 pr-10"
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
                        <div className="space-y-2">
                            <Label htmlFor="confirm" className="text-sm font-medium">
                                Confirmar contraseña
                            </Label>
                            <Input
                                id="confirm"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Repite la contraseña"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                                minLength={8}
                                className="h-11"
                            />
                        </div>
                        <Button
                            className="w-full h-11 text-base font-semibold"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Guardando...' : 'Establecer contraseña'}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground">
                        Después de guardar serás redirigido al inicio de sesión.
                    </p>
                </div>
            </div>
        </div>
    );
}
