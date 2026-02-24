import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { login } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { token, user } = await login(email, password);
            loginUser(token, user);
            toast.success('Bienvenido');
            navigate('/');
        } catch (error: any) {
            toast.error(error.message || 'Credenciales incorrectas');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full">
            {/* Panel izquierdo — branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-12">
                <img
                    src="/mrprospect-logo.png"
                    alt="MR. PROSPECT"
                    className="w-72 brightness-0 invert"
                />
                <p className="mt-6 text-center text-primary-foreground/80 text-sm max-w-xs">
                    Panel de administración para gestionar empresas, SDRs y consumos de prospección.
                </p>
            </div>

            {/* Panel derecho — formulario */}
            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-8 py-12 bg-background">
                <div className="w-full max-w-sm space-y-8">
                    {/* Logo mobile */}
                    <div className="flex justify-center lg:hidden">
                        <img src="/isotipo.png" alt="MR. PROSPECT" className="h-14" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Iniciar sesión
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Accede al panel de administración
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                                Correo electrónico
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@empresa.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">
                                Contraseña
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
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
                        <Button
                            className="w-full h-11 text-base font-semibold"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Verificando...' : 'Entrar'}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground">
                        MR. PROSPECT © {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}
