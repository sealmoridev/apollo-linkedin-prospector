import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { requireAdmin, requireSuperAdmin, requireAdminOwner } from '../middlewares/admin-auth';
import { prisma } from '../lib/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-it';

// ============================================================================
// RUTAS PÚBLICAS
// ============================================================================

/**
 * Setup inicial: crea el primer SuperAdmin y la primera Empresa.
 * Solo funciona si no hay ningún AdminUser en la DB.
 */
router.post('/setup', async (req: Request, res: Response) => {
    try {
        const adminCount = await prisma.adminUser.count();
        if (adminCount > 0) {
            return res.status(400).json({ error: 'Setup ya ha sido completado. Contacta a un administrador existente.' });
        }

        const { email, password, empresaNombre } = req.body;
        if (!email || !password || !empresaNombre) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos: email, password, empresaNombre' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const empresa = await prisma.empresa.create({
            data: { nombre: empresaNombre }
        });

        const superadmin = await prisma.adminUser.create({
            data: { email, password_hash, role: 'SUPERADMIN', empresa_id: empresa.id }
        });

        res.json({
            message: 'Setup inicial completado correctamente.',
            superadmin: { id: superadmin.id, email: superadmin.email },
            empresa: { id: empresa.id, nombre: empresa.nombre, tenant_api_key: empresa.tenant_api_key }
        });
    } catch (error) {
        console.error('[Admin API] Setup Error:', error);
        res.status(500).json({ error: 'Error del servidor durante el setup' });
    }
});

/**
 * Login para el Backoffice.
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Faltan parámetros: email y/o password' });
        }

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, empresa_id: user.empresa_id },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: { id: user.id, email: user.email, role: user.role, empresa_id: user.empresa_id }
        });
    } catch (error) {
        console.error('[Admin API] Login Error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================================
// RUTAS PROTEGIDAS — cualquier admin autenticado
// ============================================================================

/** Perfil del admin actual */
router.get('/me', requireAdmin, (req: Request, res: Response) => {
    res.json({ user: req.adminUser });
});

/**
 * Consumos agrupados por empresa (resumen para cards del Dashboard).
 * IMPORTANTE: declarado ANTES de /consumos para evitar colisión de rutas.
 */
router.get('/consumos/resumen', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const resumen = await prisma.consumo.groupBy({
            by: ['empresa_id'],
            _sum: { creditos_apollo: true, creditos_verifier: true },
            _count: { id: true }
        });

        const empresaIds = resumen.map(r => r.empresa_id);
        const empresas = await prisma.empresa.findMany({
            where: { id: { in: empresaIds } },
            select: { id: true, nombre: true, logo_url: true }
        });

        const empresaMap = new Map(empresas.map(e => [e.id, e]));

        const result = resumen.map(r => ({
            empresa_id: r.empresa_id,
            empresa: empresaMap.get(r.empresa_id) || null,
            total_apollo: r._sum.creditos_apollo || 0,
            total_verifier: r._sum.creditos_verifier || 0,
            total_busquedas: r._count.id
        }));

        res.json(result);
    } catch (error) {
        console.error('[Admin API] Resumen consumos error:', error);
        res.status(500).json({ error: 'Error al obtener resumen de consumos' });
    }
});

/**
 * Historial de consumos (para dashboard con filtro de fechas).
 * ADMIN: solo de su empresa. SUPERADMIN: puede filtrar por empresa_id o ver todos.
 * Params: empresa_id?, desde?, hasta?
 */
router.get('/consumos', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { role, empresa_id } = req.adminUser!;
        const { empresa_id: qEmpresaId, desde, hasta } = req.query;

        const filter: any = {};
        if (role !== 'SUPERADMIN') {
            filter.empresa_id = empresa_id;
        } else if (qEmpresaId) {
            filter.empresa_id = qEmpresaId as string;
        }

        if (desde || hasta) {
            filter.fecha = {};
            if (desde) filter.fecha.gte = new Date(desde as string);
            if (hasta) {
                const hastaDate = new Date(hasta as string);
                hastaDate.setHours(23, 59, 59, 999);
                filter.fecha.lte = hastaDate;
            }
        }

        const consumos = await prisma.consumo.findMany({
            where: filter,
            include: {
                usuario: { select: { email: true, id: true } },
                empresa: { select: { nombre: true } }
            },
            orderBy: { fecha: 'desc' },
            take: 500
        });

        res.json(consumos);
    } catch (error) {
        console.error('[Admin API] Consumo fetch error:', error);
        res.status(500).json({ error: 'No se pudieron obtener los consumos' });
    }
});

/**
 * Historial paginado de consumos (para la página de log).
 * ADMIN: solo su empresa. SUPERADMIN: puede filtrar por empresa_id.
 * Params: empresa_id?, desde?, hasta?, usuario_id?, page?, limit?, sheet_name?, only_leads?
 */
router.get('/consumos/historial', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { role, empresa_id } = req.adminUser!;
        const { empresa_id: qEmpresaId, desde, hasta, usuario_id, page = '1', limit = '50', sheet_name, only_leads } = req.query;

        const filter: any = {};
        if (role !== 'SUPERADMIN') {
            filter.empresa_id = empresa_id;
        } else if (qEmpresaId) {
            filter.empresa_id = qEmpresaId as string;
        }

        if (desde || hasta) {
            filter.fecha = {};
            if (desde) filter.fecha.gte = new Date(desde as string);
            if (hasta) {
                const hastaDate = new Date(hasta as string);
                hastaDate.setHours(23, 59, 59, 999);
                filter.fecha.lte = hastaDate;
            }
        }

        if (usuario_id) filter.usuario_id = usuario_id as string;
        if (sheet_name) filter.sheet_name = sheet_name as string;
        if (only_leads === 'true') filter.lead_data = { not: null };

        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const skip = (pageNum - 1) * limitNum;

        const [total, data] = await Promise.all([
            prisma.consumo.count({ where: filter }),
            prisma.consumo.findMany({
                where: filter,
                include: {
                    usuario: { select: { email: true, id: true } },
                    empresa: { select: { nombre: true } }
                },
                orderBy: { fecha: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        // Enrich lead captures with credit totals from their sesion
        const sesionIds = data
            .map((c: any) => c.sesion_id)
            .filter((id: any) => !!id) as string[];

        const sesionCreditsMap = new Map<string, { apollo: number; verifier: number }>();
        if (sesionIds.length > 0) {
            const creditGroups = await (prisma.consumo as any).groupBy({
                by: ['sesion_id'],
                where: { sesion_id: { in: sesionIds }, lead_data: null },
                _sum: { creditos_apollo: true, creditos_verifier: true }
            });
            for (const g of creditGroups) {
                sesionCreditsMap.set(g.sesion_id, {
                    apollo: g._sum.creditos_apollo ?? 0,
                    verifier: g._sum.creditos_verifier ?? 0
                });
            }
        }

        const enrichedData = data.map((c: any) => ({
            ...c,
            sesion_apollo: c.sesion_id ? (sesionCreditsMap.get(c.sesion_id)?.apollo ?? 0) : null,
            sesion_verifier: c.sesion_id ? (sesionCreditsMap.get(c.sesion_id)?.verifier ?? 0) : null
        }));

        res.json({
            data: enrichedData,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            limit: limitNum
        });
    } catch (error) {
        console.error('[Admin API] Historial fetch error:', error);
        res.status(500).json({ error: 'No se pudo obtener el historial' });
    }
});

/**
 * Sheet names únicos del tenant (para filtro dropdown).
 * ADMIN: solo su empresa. SUPERADMIN: puede filtrar por empresa_id.
 */
router.get('/consumos/sheet-names', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { role, empresa_id } = req.adminUser!;
        const { empresa_id: qEmpresaId } = req.query;

        const filter: any = { sheet_name: { not: null }, lead_data: { not: null } };
        if (role !== 'SUPERADMIN') {
            filter.empresa_id = empresa_id;
        } else if (qEmpresaId) {
            filter.empresa_id = qEmpresaId as string;
        }

        const rows = await prisma.consumo.findMany({
            where: filter,
            select: { sheet_name: true },
            distinct: ['sheet_name'],
            orderBy: { sheet_name: 'asc' }
        });

        const names = rows.map(r => r.sheet_name).filter(Boolean) as string[];
        res.json(names);
    } catch (error) {
        console.error('[Admin API] Sheet names fetch error:', error);
        res.status(500).json({ error: 'No se pudo obtener los nombres de sheets' });
    }
});

/** Empresa propia del Admin (no SuperAdmin) */
router.get('/mi-empresa', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { role, empresa_id } = req.adminUser!;

        if (role === 'SUPERADMIN') {
            return res.status(400).json({ error: 'Usa /empresas/:id para consultar una empresa específica' });
        }

        if (!empresa_id) {
            return res.status(404).json({ error: 'No tienes una empresa asignada' });
        }

        const empresa = await prisma.empresa.findUnique({
            where: { id: empresa_id },
            include: { _count: { select: { extensionUsers: true, consumos: true } } }
        });

        if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

        res.json(empresa);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tu empresa' });
    }
});

// ============================================================================
// RUTAS DE SÚPER ADMINISTRADOR — gestión global
// ============================================================================

/** Listar todas las empresas */
router.get('/empresas', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const empresas = await prisma.empresa.findMany({
            include: { _count: { select: { extensionUsers: true, consumos: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(empresas);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron listar las empresas' });
    }
});

/** Crear nueva empresa (Tenant) */
router.post('/empresas', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { nombre, apollo_api_key, millionverifier_api_key, logo_url } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const empresa = await prisma.empresa.create({
            data: { nombre, apollo_api_key, millionverifier_api_key, logo_url: logo_url || null }
        });

        res.json(empresa);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la empresa' });
    }
});

// ============================================================================
// RUTAS DE EMPRESA INDIVIDUAL (SuperAdmin o Admin dueño)
// ============================================================================

/** Detalle de una empresa */
router.get('/empresas/:id', requireAdmin, requireAdminOwner('id'), async (req: Request, res: Response) => {
    try {
        const empresa = await prisma.empresa.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { extensionUsers: true, consumos: true } } }
        });

        if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

        res.json(empresa);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la empresa' });
    }
});

/** Actualizar empresa (nombre, API keys, logo_url) */
router.put('/empresas/:id', requireAdmin, requireAdminOwner('id'), async (req: Request, res: Response) => {
    try {
        const { nombre, apollo_api_key, millionverifier_api_key, logo_url } = req.body;

        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (apollo_api_key !== undefined) data.apollo_api_key = apollo_api_key || null;
        if (millionverifier_api_key !== undefined) data.millionverifier_api_key = millionverifier_api_key || null;
        if (logo_url !== undefined) data.logo_url = logo_url || null;

        const empresa = await prisma.empresa.update({
            where: { id: req.params.id },
            data
        });

        res.json(empresa);
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Empresa no encontrada' });
        res.status(500).json({ error: 'Error al actualizar la empresa' });
    }
});

/** Usuarios de extensión de una empresa */
router.get('/empresas/:id/usuarios', requireAdmin, requireAdminOwner('id'), async (req: Request, res: Response) => {
    try {
        const empresa = await prisma.empresa.findUnique({ where: { id: req.params.id } });
        if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

        const usuarios = await prisma.extensionUser.findMany({
            where: { empresa_id: req.params.id },
            include: { _count: { select: { consumos: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

// ============================================================================
// GESTIÓN DE TENANT KEY
// ============================================================================

/** Regenerar tenant_api_key (rompe las extensiones ya configuradas con la key anterior) */
router.post('/empresas/:id/regenerate-key', requireAdmin, requireAdminOwner('id'), async (req: Request, res: Response) => {
    try {
        const empresa = await prisma.empresa.update({
            where: { id: req.params.id },
            data: { tenant_api_key: crypto.randomUUID() }
        });
        res.json({ tenant_api_key: empresa.tenant_api_key });
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Empresa no encontrada' });
        res.status(500).json({ error: 'Error al regenerar la key' });
    }
});

/** Activar / Desactivar la tenant key */
router.patch('/empresas/:id/toggle-key', requireAdmin, requireAdminOwner('id'), async (req: Request, res: Response) => {
    try {
        const empresa = await prisma.empresa.findUnique({ where: { id: req.params.id } });
        if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

        const updated = await prisma.empresa.update({
            where: { id: req.params.id },
            data: { key_active: !empresa.key_active }
        });
        res.json({ key_active: updated.key_active });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado de la key' });
    }
});

// ============================================================================
// GESTIÓN DE USUARIOS ADMIN
// ============================================================================

/** Listar todos los AdminUser (SuperAdmin only) */
router.get('/users', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const users = await prisma.adminUser.findMany({
            include: { empresa: { select: { id: true, nombre: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            empresa_id: u.empresa_id,
            empresa: u.empresa,
            createdAt: u.createdAt
        })));
    } catch (error) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

/** Crear Administrador de empresa o SuperAdmin */
router.post('/users', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { email, password, role, empresa_id } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Faltan parámetros: email, password, role' });
        }

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(400).json({ error: 'Role inválido' });
        }

        if (role === 'ADMIN' && !empresa_id) {
            return res.status(400).json({ error: 'Se requiere empresa_id para crear un ADMIN' });
        }

        const checkExists = await prisma.adminUser.findUnique({ where: { email } });
        if (checkExists) {
            return res.status(400).json({ error: 'Email ya registrado' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const user = await prisma.adminUser.create({
            data: { email, password_hash, role, empresa_id: empresa_id || null }
        });

        res.json({ id: user.id, email: user.email, role: user.role, empresa_id: user.empresa_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear usuario administrador' });
    }
});

/** Actualizar email, role, empresa_id de un AdminUser */
router.put('/users/:id', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { email, role, empresa_id } = req.body;

        if (role && role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(400).json({ error: 'Role inválido' });
        }

        if (role === 'ADMIN' && empresa_id === undefined) {
            return res.status(400).json({ error: 'Se requiere empresa_id para el role ADMIN' });
        }

        const data: any = {};
        if (email !== undefined) data.email = email;
        if (role !== undefined) data.role = role;
        if (empresa_id !== undefined) data.empresa_id = empresa_id || null;

        const user = await prisma.adminUser.update({
            where: { id: req.params.id },
            data,
            include: { empresa: { select: { id: true, nombre: true } } }
        });

        res.json({ id: user.id, email: user.email, role: user.role, empresa_id: user.empresa_id, empresa: user.empresa });
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email ya registrado' });
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

/** Eliminar AdminUser (no puede eliminarse a sí mismo) */
router.delete('/users/:id', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        if (req.params.id === req.adminUser!.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        await prisma.adminUser.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

/** Cambiar contraseña de un AdminUser */
router.post('/users/:id/change-password', requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        await prisma.adminUser.update({
            where: { id: req.params.id },
            data: { password_hash }
        });

        res.json({ ok: true });
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

export default router;
