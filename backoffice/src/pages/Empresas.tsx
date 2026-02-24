import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmpresas, createEmpresa, createAdminUser, toggleTenantKey, regenerateTenantKey } from '../lib/api';
import type { EmpresaDetail } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
    Building2, RefreshCw, PowerOff, Power, Plus,
    Eye, EyeOff, Copy, Check, CheckCircle2
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../components/ui/alert-dialog';

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Empresa', 'Administrador', 'Listo'];

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex items-center mb-6">
            {STEPS.map((label, i) => {
                const idx = i + 1;
                const done = idx < current;
                const active = idx === current;
                return (
                    <React.Fragment key={idx}>
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors
                                ${done
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : active
                                    ? 'border-primary text-primary bg-background'
                                    : 'border-muted text-muted-foreground bg-background'
                                }`}>
                                {done ? <Check className="h-3.5 w-3.5" /> : idx}
                            </div>
                            <span className={`text-[10px] font-medium whitespace-nowrap
                                ${active ? 'text-primary' : done ? 'text-primary/70' : 'text-muted-foreground'}`}>
                                {label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 mx-2 transition-colors ${done ? 'bg-primary' : 'bg-border'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Create Empresa Wizard ────────────────────────────────────────────────────

interface WizardProps {
    open: boolean;
    onClose: (newEmpresa?: EmpresaDetail) => void;
}

function CreateEmpresaWizard({ open, onClose }: WizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1
    const [nombre, setNombre] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [step1Loading, setStep1Loading] = useState(false);

    // Step 1 result
    const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);

    // Step 2
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step2Loading, setStep2Loading] = useState(false);
    const [adminCreated, setAdminCreated] = useState(false);

    // Copy state
    const [copied, setCopied] = useState<string | null>(null);

    const resetWizard = () => {
        setStep(1);
        setNombre('');
        setLogoUrl('');
        setEmpresa(null);
        setAdminEmail('');
        setAdminPassword('');
        setShowPassword(false);
        setAdminCreated(false);
        setCopied(null);
    };

    // Reset state after dialog closes (wait for animation)
    useEffect(() => {
        if (!open) {
            const t = setTimeout(resetWizard, 300);
            return () => clearTimeout(t);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const copyAll = () => {
        if (!empresa) return;
        const lines = [
            `Nueva empresa en MrProspect`,
            ``,
            `Empresa: ${empresa.nombre}`,
            `API Key Extensión Chrome: ${empresa.tenant_api_key}`,
        ];
        if (adminCreated) {
            lines.push(``, `Acceso al backoffice:`);
            lines.push(`Email: ${adminEmail}`);
            lines.push(`Contraseña temporal: ${adminPassword}`);
            lines.push(``, `⚠️ Cambia la contraseña al primer acceso.`);
        }
        navigator.clipboard.writeText(lines.join('\n'));
        setCopied('all');
        setTimeout(() => setCopied(null), 2000);
    };

    // Step 1: create empresa
    const handleStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep1Loading(true);
        try {
            const emp = await createEmpresa({ nombre, logo_url: logoUrl || undefined });
            setEmpresa(emp);
            setStep(2);
        } catch (err: any) {
            toast.error(err.message || 'Error al crear la empresa');
        } finally {
            setStep1Loading(false);
        }
    };

    // Step 2: create admin user
    const handleStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empresa) return;
        setStep2Loading(true);
        try {
            await createAdminUser({
                email: adminEmail,
                password: adminPassword,
                role: 'ADMIN',
                empresa_id: empresa.id,
            });
            setAdminCreated(true);
            setStep(3);
        } catch (err: any) {
            toast.error(err.message || 'Error al crear el administrador');
        } finally {
            setStep2Loading(false);
        }
    };

    return (
        // onOpenChange only handles dismiss (Escape / backdrop click) — not "Finalizar"
        // This avoids double-calling onClose when Finalizar sets open=false via the parent.
        <Dialog open={open} onOpenChange={v => !v && onClose(undefined)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva empresa</DialogTitle>
                </DialogHeader>

                <StepIndicator current={step} />

                {/* ── Step 1: Empresa ── */}
                {step === 1 && (
                    <form onSubmit={handleStep1} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre de la empresa *</Label>
                            <Input
                                required
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                placeholder="Acme Corp"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                URL del logo{' '}
                                <span className="text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                                value={logoUrl}
                                onChange={e => setLogoUrl(e.target.value)}
                                placeholder="https://ejemplo.com/logo.png"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => onClose(undefined)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={step1Loading}>
                                {step1Loading ? 'Creando...' : 'Siguiente →'}
                            </Button>
                        </div>
                    </form>
                )}

                {/* ── Step 2: Admin ── */}
                {step === 2 && empresa && (
                    <form onSubmit={handleStep2} className="space-y-4">
                        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                            Empresa <strong className="text-foreground">{empresa.nombre}</strong> creada.
                            Ahora configura el primer administrador del tenant.
                        </div>
                        <div className="space-y-2">
                            <Label>Email del administrador *</Label>
                            <Input
                                required
                                type="email"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                placeholder="admin@empresa.com"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Contraseña temporal *</Label>
                            <div className="relative">
                                <Input
                                    required
                                    type={showPassword ? 'text' : 'password'}
                                    value={adminPassword}
                                    onChange={e => setAdminPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    minLength={8}
                                    className="pr-10 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword
                                        ? <EyeOff className="h-4 w-4" />
                                        : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-muted-foreground text-sm"
                                onClick={() => setStep(3)}
                            >
                                Saltar este paso →
                            </Button>
                            <Button type="submit" disabled={step2Loading}>
                                {step2Loading ? 'Creando...' : 'Crear administrador →'}
                            </Button>
                        </div>
                    </form>
                )}

                {/* ── Step 3: Resumen ── */}
                {step === 3 && empresa && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            {adminCreated
                                ? 'Empresa y administrador creados correctamente.'
                                : 'Empresa creada correctamente.'}
                        </div>

                        {/* Info block */}
                        <div className="rounded-lg border bg-muted/30 p-3.5 space-y-3 text-sm">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                                Información para compartir
                            </p>

                            <div className="space-y-0.5">
                                <p className="text-xs text-muted-foreground">Empresa</p>
                                <p className="font-medium">{empresa.nombre}</p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">API Key — Extensión Chrome</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs font-mono bg-background rounded px-2 py-1.5 border break-all select-all">
                                        {empresa.tenant_api_key}
                                    </code>
                                    <button
                                        onClick={() => copy(empresa.tenant_api_key, 'key')}
                                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Copiar API Key"
                                    >
                                        {copied === 'key'
                                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                                            : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {adminCreated && (
                                <>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Email de acceso al backoffice</p>
                                        <div className="flex items-center gap-2">
                                            <span className="flex-1 font-mono text-xs bg-background rounded px-2 py-1.5 border truncate">
                                                {adminEmail}
                                            </span>
                                            <button
                                                onClick={() => copy(adminEmail, 'email')}
                                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                                title="Copiar email"
                                            >
                                                {copied === 'email'
                                                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                                                    : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Contraseña temporal</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 font-mono text-xs bg-background rounded px-2 py-1.5 border">
                                                {adminPassword}
                                            </code>
                                            <button
                                                onClick={() => copy(adminPassword, 'pwd')}
                                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                                title="Copiar contraseña"
                                            >
                                                {copied === 'pwd'
                                                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                                                    : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-amber-600 font-medium">
                                        Guarda la contraseña ahora — no se volverá a mostrar.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={copyAll}
                            >
                                {copied === 'all'
                                    ? <><Check className="h-3.5 w-3.5 text-green-500" /> ¡Copiado!</>
                                    : <><Copy className="h-3.5 w-3.5" /> Copiar todo</>
                                }
                            </Button>
                            <Button onClick={() => onClose(empresa!)}>
                                Finalizar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Empresas() {
    const navigate = useNavigate();
    const [empresas, setEmpresas] = useState<EmpresaDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [regenTarget, setRegenTarget] = useState<EmpresaDetail | null>(null);

    useEffect(() => { fetchEmpresas(); }, []);

    const fetchEmpresas = async () => {
        try {
            const data = await getEmpresas();
            setEmpresas(data);
        } catch (error: any) {
            toast.error(error.message || 'Error al cargar empresas');
        } finally {
            setLoading(false);
        }
    };

    const handleWizardClose = (newEmpresa?: EmpresaDetail) => {
        setWizardOpen(false);
        if (newEmpresa) {
            setEmpresas(prev => [newEmpresa, ...prev]);
        }
    };

    const handleToggleKey = async (e: React.MouseEvent, emp: EmpresaDetail) => {
        e.stopPropagation();
        setActionLoadingId(emp.id);
        try {
            const { key_active } = await toggleTenantKey(emp.id);
            setEmpresas(prev => prev.map(c => c.id === emp.id ? { ...c, key_active } : c));
            toast.success(key_active ? 'Key habilitada' : 'Key inhabilitada');
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar estado');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRegenerateKey = async () => {
        if (!regenTarget) return;
        const target = regenTarget;
        setActionLoadingId(target.id + '-regen');
        setRegenTarget(null);
        try {
            const { tenant_api_key } = await regenerateTenantKey(target.id);
            setEmpresas(prev => prev.map(c => c.id === target.id ? { ...c, tenant_api_key } : c));
            toast.success('Key regenerada — avisa a los SDRs para que actualicen la extensión.');
        } catch (error: any) {
            toast.error(error.message || 'Error al regenerar la key');
        } finally {
            setActionLoadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando empresas...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Empresas</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {empresas.length} tenant{empresas.length !== 1 ? 's' : ''} registrados
                    </p>
                </div>
                <Button onClick={() => setWizardOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva empresa
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empresa</TableHead>
                                <TableHead className="text-center">Usuarios</TableHead>
                                <TableHead className="text-center">Consumos</TableHead>
                                <TableHead>Estado Key</TableHead>
                                <TableHead>Tenant Key</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {empresas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                        <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                        No hay empresas registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                empresas.map((emp) => (
                                    <TableRow
                                        key={emp.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/empresas/${emp.id}`)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                {emp.logo_url ? (
                                                    <img
                                                        src={emp.logo_url}
                                                        alt={emp.nombre}
                                                        className="h-7 w-7 rounded object-contain border p-0.5 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="h-7 w-7 rounded border bg-muted flex items-center justify-center shrink-0">
                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-sm">{emp.nombre}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(emp.createdAt).toLocaleDateString('es-CL')}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="text-xs tabular-nums">
                                                {emp._count.extensionUsers}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-xs tabular-nums">
                                                {emp._count.consumos}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            <Badge
                                                variant={emp.key_active ? 'default' : 'destructive'}
                                                className="text-xs"
                                            >
                                                {emp.key_active ? 'Activa' : 'Inactiva'}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-primary font-mono select-all">
                                                {emp.tenant_api_key.slice(0, 18)}…
                                            </code>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div
                                                className="flex items-center justify-end gap-1"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={`h-7 px-2 text-xs gap-1 ${emp.key_active
                                                        ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                                                        : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                    }`}
                                                    disabled={actionLoadingId === emp.id}
                                                    onClick={(e) => handleToggleKey(e, emp)}
                                                >
                                                    {emp.key_active
                                                        ? <><PowerOff className="h-3 w-3" /> Inhabilitar</>
                                                        : <><Power className="h-3 w-3" /> Habilitar</>
                                                    }
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                                    disabled={actionLoadingId === emp.id + '-regen'}
                                                    onClick={(e) => { e.stopPropagation(); setRegenTarget(emp); }}
                                                >
                                                    <RefreshCw className="h-3 w-3" /> Regenerar
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CreateEmpresaWizard open={wizardOpen} onClose={handleWizardClose} />

            <AlertDialog open={!!regenTarget} onOpenChange={open => !open && setRegenTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Regenerar Tenant Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se generará una nueva clave para <strong>{regenTarget?.nombre}</strong>.
                            Todos los SDRs con la key anterior deberán actualizar su configuración
                            en la extensión Chrome.
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
