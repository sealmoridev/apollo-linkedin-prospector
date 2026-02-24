import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-it';

export interface AdminJwtPayload {
    id: string;
    email: string;
    role: Role;
    empresa_id: string | null;
}

// Extending Express Request
declare global {
    namespace Express {
        interface Request {
            adminUser?: AdminJwtPayload;
        }
    }
}

/**
 * Verifica si el usuario envió un JWT válido en las cabeceras.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided or invalid format' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;

        // Verificar si el usuario aún existe en la base de datos
        const user = await prisma.adminUser.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists' });
        }

        req.adminUser = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Solo permite pasar si el adminUser es SUPERADMIN.
 * Debe usarse DESPUÉS de requireAdmin.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.adminUser.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Super Admin privileges required' });
    }

    next();
};

/**
 * Permite pasar a un SUPERADMIN (irrestricto) O a un ADMIN dueño de la empresa.
 * El ID de empresa se toma del parámetro de ruta especificado en paramName (default: 'id').
 * Debe usarse DESPUÉS de requireAdmin.
 */
export const requireAdminOwner = (paramName: string = 'id') =>
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { role, empresa_id } = req.adminUser;

        if (role === 'SUPERADMIN') {
            return next();
        }

        const empresaIdFromParam = req.params[paramName];
        if (empresa_id && empresa_id === empresaIdFromParam) {
            return next();
        }

        return res.status(403).json({ error: 'Access denied: not the owner of this empresa' });
    };
