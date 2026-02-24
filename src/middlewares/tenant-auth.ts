import { Request, Response, NextFunction } from 'express';
import { Empresa, ExtensionUser } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Extending Express Request to include tenant data
declare global {
    namespace Express {
        interface Request {
            tenant?: Empresa;
            extensionUser?: ExtensionUser;
        }
    }
}

/**
 * Middleware para validar que las peticiones vengan con x-api-key y x-google-id válidos.
 * Si son válidos, inyecta los datos del tenant y del usuario en `req`.
 */
export const tenantAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    const googleId = req.headers['x-google-id'] as string;
    const email = req.headers['x-google-email'] as string; // Opcional, para auto-crear al usuario la primera vez

    if (!apiKey || !googleId) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing x-api-key or x-google-id headers'
        });
    }

    try {
        // 1. Buscar la Empresa por el tenant_api_key proporcionado
        const empresa = await prisma.empresa.findUnique({
            where: { tenant_api_key: apiKey },
        });

        if (!empresa) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid x-api-key'
            });
        }

        if (!empresa.key_active) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Tenant key is disabled. Contact your administrator.'
            });
        }

        // 2. Buscar o crear al Usuario de la Extensión
        // Si la BD no tiene al usuario, pero tenemos la API KEY válida y un googleId, consideramos crearlo.
        // Opcionalmente podemos requerir que el Admin de la empresa lo dé de alta antes.
        // Para UX sin fricción: auto-creamos al usuario si la key de empresa es válida.

        let extensionUser = await prisma.extensionUser.findUnique({
            where: { id: googleId }
        });

        if (!extensionUser) {
            if (!email) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'User not registered. Please provide x-google-email in headers for first-time auto-registration.'
                });
            }

            extensionUser = await prisma.extensionUser.create({
                data: {
                    id: googleId,
                    email: email,
                    empresa_id: empresa.id
                }
            });
        } else if (extensionUser.empresa_id !== empresa.id) {
            // Por seguridad, si el usuario existe pero la api key que mandó es de otra empresa, lo bloqueamos.
            return res.status(403).json({
                error: 'Forbidden',
                message: 'User belongs to a different enterprise'
            });
        }

        // 3. Inyectamos la información en el request
        req.tenant = empresa;
        req.extensionUser = extensionUser;

        next();

    } catch (error) {
        console.error('[TenantAuthMiddleware] Error validating tenant:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
