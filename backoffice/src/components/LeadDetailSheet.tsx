import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { updateConsumoLead, deleteConsumoLead } from '../lib/api';
import type { Consumo, LeadData } from '../lib/api';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from './ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from './ui/alert-dialog';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

interface Props {
    consumo: Consumo | null;
    onClose: () => void;
    onLeadUpdated?: (consumoId: string, newLead: LeadData) => void;
    onLeadDeleted?: (consumoId: string) => void;
}

const PROV_ICONS: Record<string, string> = {
    apollo: 'apolloicon.png', prospeo: 'prospeoicon.png',
    findymail: 'findymail-logo.png', leadmagic: 'leadmagic-logo.jpeg',
};
const PROV_NAMES: Record<string, string> = {
    apollo: 'Apollo', prospeo: 'Prospeo', findymail: 'Findymail',
    leadmagic: 'LeadMagic', millionverifier: 'MillionVerifier',
};

export function LeadDetailSheet({ consumo, onClose, onLeadUpdated, onLeadDeleted }: Props) {
    const { user: authUser } = useAuth();
    const isSuperAdmin = authUser?.role === 'SUPERADMIN';

    const [editOpen, setEditOpen] = useState(false);
    const [editFields, setEditFields] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const ld = consumo?.lead_data;
    if (!consumo || !ld) return null;

    const bd = consumo.credit_breakdown;

    const statusMap: Record<string, string> = { valid: 'Válido', invalid: 'Inválido', catch_all: 'Catch-All' };
    const statusLabel = ld.email_status ? (statusMap[ld.email_status] || ld.email_status) : 'Sin verificar';
    const statusVariant = ld.email_status === 'valid' ? 'default' : ld.email_status === 'invalid' ? 'destructive' : 'secondary';

    const chip = (id: string) => (
        <div className="flex items-center gap-1.5">
            <img src={`${import.meta.env.BASE_URL}${PROV_ICONS[id] ?? 'apolloicon.png'}`} alt={id} className="h-4 w-4 object-contain rounded" />
            <span className="text-sm">{PROV_NAMES[id] ?? id}</span>
        </div>
    );
    const dash = <span className="text-xs text-muted-foreground">—</span>;

    return (
        <>
            <Sheet open={!!consumo} onOpenChange={open => { if (!open) onClose(); }}>
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
                    <SheetHeader>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <SheetTitle>{ld.full_name || `${ld.first_name || ''} ${ld.last_name || ''}`.trim() || 'Prospecto'}</SheetTitle>
                                <SheetDescription className="flex flex-wrap gap-1.5 items-center mt-1">
                                    {ld.title && <span>{ld.title}</span>}
                                    {ld.company_name && <span>· {ld.company_name}</span>}
                                </SheetDescription>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar datos"
                                    onClick={() => {
                                        setEditFields({
                                            full_name: ld.full_name || '',
                                            first_name: ld.first_name || '',
                                            last_name: ld.last_name || '',
                                            title: ld.title || '',
                                            primary_email: ld.primary_email || '',
                                            personal_email: ld.personal_email || '',
                                            phone_number: ld.phone_number || '',
                                            company_name: ld.company_name || '',
                                            company_domain: ld.company_domain || '',
                                            industry: ld.industry || '',
                                            location: ld.location || '',
                                        });
                                        setEditOpen(true);
                                    }}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {isSuperAdmin && (
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        title="Eliminar datos del lead"
                                        onClick={() => setDeleteOpen(true)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </SheetHeader>

                    <div className="px-6 pb-6 space-y-4">
                        <Separator />

                        {/* Contacto */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto</p>
                            <dl className="space-y-1.5 text-sm">
                                {ld.primary_email && (
                                    <div className="flex gap-2 items-start">
                                        <dt className="text-muted-foreground w-28 shrink-0">Email principal</dt>
                                        <dd className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium break-all">{ld.primary_email}</span>
                                            <Badge variant={statusVariant as any} className="text-[10px] shrink-0">{statusLabel}</Badge>
                                        </dd>
                                    </div>
                                )}
                                {ld.personal_email && ld.personal_email !== ld.primary_email && (
                                    <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Email personal</dt><dd className="break-all">{ld.personal_email}</dd></div>
                                )}
                                {ld.phone_number && (
                                    <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Teléfono</dt><dd>{ld.phone_number}</dd></div>
                                )}
                            </dl>
                        </div>

                        <Separator />

                        {/* Empresa */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
                            <dl className="space-y-1.5 text-sm">
                                {ld.company_name && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Nombre</dt><dd className="font-medium">{ld.company_name}</dd></div>}
                                {ld.company_domain && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Dominio</dt><dd>{ld.company_domain}</dd></div>}
                                {ld.industry && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Industria</dt><dd>{ld.industry}</dd></div>}
                                {ld.location && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Ubicación</dt><dd>{ld.location}</dd></div>}
                            </dl>
                        </div>

                        {ld.linkedin_url && (
                            <>
                                <Separator />
                                <a href={ld.linkedin_url} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                                    <ExternalLink className="h-3.5 w-3.5" />Ver perfil LinkedIn
                                </a>
                            </>
                        )}

                        <Separator />

                        {/* SDR */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SDR</p>
                            <dl className="space-y-1.5 text-sm">
                                {ld.sdr_name && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Nombre</dt><dd className="font-medium">{ld.sdr_name}</dd></div>}
                                {ld.sdr_mail && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Email</dt><dd className="break-all">{ld.sdr_mail}</dd></div>}
                                {ld.created_at && <div className="flex gap-2"><dt className="text-muted-foreground w-28 shrink-0">Capturado</dt><dd>{new Date(ld.created_at).toLocaleString('es-CL')}</dd></div>}
                            </dl>
                        </div>

                        {consumo.sheet_name && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sheet</p>
                                    <p className="text-sm">{consumo.sheet_name}</p>
                                </div>
                            </>
                        )}

                        {/* Vía de captura */}
                        {ld.enrichment_provider && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vía de captura</p>
                                    <div className="grid grid-cols-[80px_1fr] gap-y-2 items-center">
                                        <span className="text-muted-foreground text-xs">Principal</span>
                                        {chip(ld.enrichment_provider)}
                                        <span className="text-muted-foreground text-xs">Email</span>
                                        {ld.email_provider ? chip(ld.email_provider) : dash}
                                        <span className="text-muted-foreground text-xs">Teléfono</span>
                                        {ld.phone_provider ? chip(ld.phone_provider) : dash}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Créditos consumidos */}
                        {bd && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Créditos consumidos</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                            <p className="text-[10px] text-muted-foreground">Mail</p>
                                            <p className="text-base font-bold">{bd.email_credits}</p>
                                        </div>
                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                            <p className="text-[10px] text-muted-foreground">Tel.</p>
                                            <p className="text-base font-bold">{bd.phone_credits}</p>
                                        </div>
                                        <div className="rounded-lg border bg-muted/30 p-2 text-center">
                                            <p className="text-[10px] text-muted-foreground">Verif.</p>
                                            <p className="text-base font-bold">
                                                {bd.verification_credits > 0 ? bd.verification_credits : (consumo.sesion_verifier ?? 0)}
                                            </p>
                                        </div>
                                    </div>
                                    {Object.keys(bd.providers).length > 0 && (
                                        <div className="space-y-1 pt-1">
                                            {Object.entries(bd.providers).map(([prov, credits]) => (
                                                <div key={prov} className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">{PROV_NAMES[prov] ?? prov}</span>
                                                    <Badge variant="secondary" className="text-[10px]">{credits} créditos</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={v => { if (!v) setEditOpen(false); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Editar datos del lead</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'full_name', label: 'Nombre completo' },
                                { key: 'first_name', label: 'Nombre' },
                                { key: 'last_name', label: 'Apellido' },
                                { key: 'title', label: 'Cargo' },
                                { key: 'primary_email', label: 'Email principal' },
                                { key: 'personal_email', label: 'Email personal' },
                                { key: 'phone_number', label: 'Teléfono' },
                            ].map(({ key, label }) => (
                                <div key={key} className={['full_name', 'primary_email', 'personal_email'].includes(key) ? 'col-span-2' : ''}>
                                    <Label className="text-xs">{label}</Label>
                                    <Input className="h-8 text-sm mt-1" placeholder="—"
                                        value={editFields[key] ?? ''}
                                        onChange={e => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Empresa</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'company_name', label: 'Empresa' },
                                { key: 'company_domain', label: 'Dominio' },
                                { key: 'industry', label: 'Industria' },
                                { key: 'location', label: 'Ubicación' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <Label className="text-xs">{label}</Label>
                                    <Input className="h-8 text-sm mt-1" placeholder="—"
                                        value={editFields[key] ?? ''}
                                        onChange={e => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                        <Button disabled={saving} onClick={async () => {
                            setSaving(true);
                            try {
                                await updateConsumoLead(consumo.id, editFields as any);
                                const updated = { ...ld, ...editFields } as LeadData;
                                onLeadUpdated?.(consumo.id, updated);
                                toast.success('Lead actualizado');
                                setEditOpen(false);
                            } catch (err: any) {
                                toast.error(err.message || 'Error al actualizar');
                            } finally {
                                setSaving(false);
                            }
                        }}>
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={v => { if (!v) setDeleteOpen(false); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar datos del lead?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se borrarán los datos de contacto y empresa de este registro.
                            El registro de créditos se conservará. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={async () => {
                                setDeleting(true);
                                try {
                                    await deleteConsumoLead(consumo.id);
                                    onLeadDeleted?.(consumo.id);
                                    toast.success('Datos del lead eliminados');
                                    setDeleteOpen(false);
                                    onClose();
                                } catch (err: any) {
                                    toast.error(err.message || 'Error al eliminar');
                                } finally {
                                    setDeleting(false);
                                }
                            }}
                        >
                            {deleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
