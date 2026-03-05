import { useEffect, useState } from 'react';
import { getCreditRates, updateCreditRates } from '../lib/api';
import type { CreditRate } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Save, Loader2 } from 'lucide-react';

// ─── Default rates (shown when DB is empty) ───────────────────────────────────

const DEFAULT_ROWS = [
    { provider: 'apollo',          field_type: 'email',        credits: 1,  label: 'Apollo',          logo: 'apolloicon.png' },
    { provider: 'apollo',          field_type: 'phone',        credits: 8,  label: 'Apollo',          logo: 'apolloicon.png' },
    { provider: 'prospeo',         field_type: 'email',        credits: 1,  label: 'Prospeo',         logo: 'prospeoicon.png' },
    { provider: 'prospeo',         field_type: 'phone',        credits: 10, label: 'Prospeo',         logo: 'prospeoicon.png' },
    { provider: 'leadmagic',       field_type: 'email',        credits: 1,  label: 'LeadMagic',       logo: 'leadmagic-logo.jpeg' },
    { provider: 'leadmagic',       field_type: 'phone',        credits: 5,  label: 'LeadMagic',       logo: 'leadmagic-logo.jpeg' },
    { provider: 'findymail',       field_type: 'email',        credits: 1,  label: 'Findymail',       logo: 'findymail-logo.png' },
    { provider: 'findymail',       field_type: 'phone',        credits: 1,  label: 'Findymail',       logo: 'findymail-logo.png' },
    { provider: 'millionverifier', field_type: 'verification', credits: 1,  label: 'MillionVerifier', logo: 'MillionVerifier-Logo.png' },
];

const PROVIDER_LOGO: Record<string, string> = {
    apollo:          'apolloicon.png',
    prospeo:         'prospeoicon.png',
    leadmagic:       'leadmagic-logo.jpeg',
    findymail:       'findymail-logo.png',
    millionverifier: 'MillionVerifier-Logo.png',
};

const PROVIDER_LABEL: Record<string, string> = {
    apollo:          'Apollo',
    prospeo:         'Prospeo',
    leadmagic:       'LeadMagic',
    findymail:       'Findymail',
    millionverifier: 'MillionVerifier',
};

const FIELD_LABEL: Record<string, string> = {
    email:        'Email',
    phone:        'Teléfono',
    verification: 'Verificación',
};

interface RowState {
    provider: string;
    field_type: string;
    credits: number;
}

export default function Tarifas() {
    const [rows, setRows] = useState<RowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLoading(true);
        getCreditRates()
            .then(rates => {
                if (rates.length === 0) {
                    setRows(DEFAULT_ROWS.map(r => ({ provider: r.provider, field_type: r.field_type, credits: r.credits })));
                } else {
                    // Merge with defaults to ensure all rows present
                    const byKey = new Map(rates.map((r: CreditRate) => [`${r.provider}.${r.field_type}`, r.credits]));
                    setRows(DEFAULT_ROWS.map(r => ({
                        provider: r.provider,
                        field_type: r.field_type,
                        credits: byKey.get(`${r.provider}.${r.field_type}`) ?? r.credits,
                    })));
                }
            })
            .catch(() => {
                setRows(DEFAULT_ROWS.map(r => ({ provider: r.provider, field_type: r.field_type, credits: r.credits })));
                toast.error('No se pudieron cargar las tarifas');
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (idx: number, value: string) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return;
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, credits: n } : r));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateCreditRates(rows);
            toast.success('Tarifas guardadas correctamente');
        } catch (err: any) {
            toast.error(err.message || 'Error al guardar tarifas');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Tarifas de créditos</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Define cuántos créditos consume cada operación por proveedor. Estos valores se aplican a todos los tenants.
                </p>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Configuración de tarifas</CardTitle>
                    <CardDescription>Los créditos se descuentan al guardar un lead en el historial.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Proveedor</TableHead>
                                    <TableHead>Campo</TableHead>
                                    <TableHead className="text-right pr-6 w-40">Créditos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, idx) => (
                                    <TableRow key={`${row.provider}.${row.field_type}`}>
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-7 w-7 rounded-lg border bg-white flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                                                    <img
                                                        src={`${import.meta.env.BASE_URL}${PROVIDER_LOGO[row.provider]}`}
                                                        alt={PROVIDER_LABEL[row.provider]}
                                                        className="h-full w-full object-contain"
                                                    />
                                                </div>
                                                <span className="text-sm font-medium">{PROVIDER_LABEL[row.provider]}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">{FIELD_LABEL[row.field_type] || row.field_type}</span>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Input
                                                type="number"
                                                min={0}
                                                value={row.credits}
                                                onChange={e => handleChange(idx, e.target.value)}
                                                className="w-24 text-right ml-auto h-8"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar tarifas
                </Button>
            </div>
        </div>
    );
}
