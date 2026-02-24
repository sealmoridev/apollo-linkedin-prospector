import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getConsumos, getConsumoResumen } from '../lib/api';
import type { Consumo, ConsumoResumen } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Building2, Zap, CheckCircle, Search } from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [resumen, setResumen] = useState<ConsumoResumen[]>([]);
    const [consumos, setConsumos] = useState<Consumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEmpresa, setFilterEmpresa] = useState<string>('all');

    useEffect(() => {
        // Admin normal → redirigir a su empresa
        if (user?.role === 'ADMIN') {
            navigate('/mi-empresa', { replace: true });
            return;
        }

        // SuperAdmin → cargar resumen + historial completo
        Promise.all([getConsumoResumen(), getConsumos()])
            .then(([res, cons]) => {
                setResumen(res);
                setConsumos(cons);
            })
            .catch((err: any) => toast.error(err.message || 'Error al cargar datos'))
            .finally(() => setLoading(false));
    }, [user]);

    const filteredConsumos = filterEmpresa === 'all'
        ? consumos
        : consumos.filter(c => c.empresa_id === filterEmpresa);

    const totalApollo = resumen.reduce((s, r) => s + r.total_apollo, 0);
    const totalVerifier = resumen.reduce((s, r) => s + r.total_verifier, 0);
    const totalBusquedas = resumen.reduce((s, r) => s + r.total_busquedas, 0);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Cargando estadísticas...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">Resumen de consumo por empresa</p>
            </div>

            {/* Totales globales */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Apollo</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalApollo}</div>
                        <p className="text-xs text-muted-foreground mt-1">Créditos consumidos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Verifier</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalVerifier}</div>
                        <p className="text-xs text-muted-foreground mt-1">Emails verificados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Búsquedas</CardTitle>
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalBusquedas}</div>
                        <p className="text-xs text-muted-foreground mt-1">En todas las empresas</p>
                    </CardContent>
                </Card>
            </div>

            {/* Cards por empresa */}
            {resumen.length > 0 && (
                <div>
                    <h2 className="text-base font-semibold mb-3 text-foreground">Por empresa</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {resumen.map(r => (
                            <Card
                                key={r.empresa_id}
                                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
                                onClick={() => navigate(`/empresas/${r.empresa_id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        {r.empresa?.logo_url ? (
                                            <img
                                                src={r.empresa.logo_url}
                                                alt={r.empresa.nombre}
                                                className="h-6 w-6 object-contain rounded"
                                            />
                                        ) : (
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <CardTitle className="text-sm font-semibold">{r.empresa?.nombre}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-2xl font-bold">{r.total_busquedas}</div>
                                    <div className="flex gap-3 mt-1.5">
                                        <span className="text-xs text-muted-foreground">
                                            Apollo: <strong className="text-foreground">{r.total_apollo}</strong>
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Verifier: <strong className="text-foreground">{r.total_verifier}</strong>
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabla con filtro */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                    <div>
                        <CardTitle>Historial de consumo</CardTitle>
                        <CardDescription>
                            {filterEmpresa === 'all'
                                ? `${consumos.length} registros en total`
                                : `${filteredConsumos.length} registros filtrados`}
                        </CardDescription>
                    </div>
                    <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                        <SelectTrigger className="w-52">
                            <SelectValue placeholder="Todas las empresas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las empresas</SelectItem>
                            {resumen.map(r => (
                                <SelectItem key={r.empresa_id} value={r.empresa_id}>
                                    {r.empresa?.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead className="text-right">Apollo</TableHead>
                                <TableHead className="text-right">Verifier</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredConsumos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        Sin registros de consumo.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredConsumos.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(c.fecha).toLocaleString('es-CL')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-normal">
                                                {c.empresa.nombre}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {c.usuario.email}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{c.creditos_apollo}</TableCell>
                                        <TableCell className="text-right font-medium">{c.creditos_verifier}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
