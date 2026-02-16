import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { WebhookServer } from './services/webhook-server';
import { EnrichmentService } from './services/enrichment-service';
import { validateLinkedInUrl } from './utils/linkedin-validator';

dotenv.config();

/**
 * Servidor web principal para Railway
 * Expone API REST y webhook para Apollo.io
 */

const PORT = parseInt(process.env.PORT || '3000');
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

if (!APOLLO_API_KEY) {
  console.error('❌ Error: APOLLO_API_KEY no está configurada');
  process.exit(1);
}

// Crear app Express
const app = express();
app.use(express.json());

// Determinar URL pública del webhook
const getPublicUrl = () => {
  // Railway proporciona RAILWAY_PUBLIC_DOMAIN
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Fallback a variable de entorno manual
  if (process.env.PUBLIC_WEBHOOK_URL) {
    return process.env.PUBLIC_WEBHOOK_URL.replace('/webhook/apollo', '');
  }
  // Desarrollo local
  return `http://localhost:${PORT}`;
};

const publicUrl = getPublicUrl();
const webhookUrl = `${publicUrl}/webhook/apollo`;

console.log('🚀 Iniciando Apollo LinkedIn Prospector Server...\n');
console.log(`📡 Public URL: ${publicUrl}`);
console.log(`🔗 Webhook URL: ${webhookUrl}\n`);

// Crear servidor webhook
const webhookServer = new WebhookServer(PORT, webhookUrl);

// Crear servicio de enriquecimiento
const enrichmentService = new EnrichmentService(APOLLO_API_KEY, webhookServer);

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhookUrl: webhookUrl
  });
});

// Página de inicio
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Apollo LinkedIn Prospector API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      enrich: 'POST /api/enrich',
      enrichBatch: 'POST /api/enrich/batch',
      webhook: 'POST /webhook/apollo'
    },
    webhookUrl: webhookUrl,
    documentation: 'https://github.com/tu-usuario/apollo-linkedin-prospector'
  });
});

// Enriquecer un perfil individual
app.post('/api/enrich', async (req: Request, res: Response) => {
  try {
    const { linkedinUrl, includePhone = false } = req.body;

    if (!linkedinUrl) {
      return res.status(400).json({
        error: 'linkedinUrl is required',
        example: {
          linkedinUrl: 'https://www.linkedin.com/in/username',
          includePhone: false
        }
      });
    }

    // Validar URL
    const validation = validateLinkedInUrl(linkedinUrl);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid LinkedIn URL',
        details: validation.error
      });
    }

    console.log(`[API] Enriching profile: ${linkedinUrl} (phone: ${includePhone})`);

    // Enriquecer perfil
    const lead = await enrichmentService.enrichProfile(
      linkedinUrl,
      undefined,
      includePhone
    );

    res.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error('[API] Error enriching profile:', error);
    res.status(500).json({
      error: 'Failed to enrich profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enriquecer múltiples perfiles (batch)
app.post('/api/enrich/batch', async (req: Request, res: Response) => {
  try {
    const { linkedinUrls, includePhone = false } = req.body;

    if (!linkedinUrls || !Array.isArray(linkedinUrls) || linkedinUrls.length === 0) {
      return res.status(400).json({
        error: 'linkedinUrls array is required',
        example: {
          linkedinUrls: [
            'https://www.linkedin.com/in/user1',
            'https://www.linkedin.com/in/user2'
          ],
          includePhone: false
        }
      });
    }

    console.log(`[API] Batch enriching ${linkedinUrls.length} profiles (phone: ${includePhone})`);

    // Enriquecer batch
    const result = await enrichmentService.enrichProfiles(
      linkedinUrls,
      undefined,
      includePhone
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Error in batch enrichment:', error);
    res.status(500).json({
      error: 'Failed to enrich profiles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// WEBHOOK DE APOLLO (manejado por WebhookServer)
// ============================================================================

// El webhook ya está configurado en WebhookServer
// Solo necesitamos montar sus rutas
app.use(webhookServer['app']);

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Access at: ${publicUrl}`);
  console.log(`📡 Webhook ready at: ${webhookUrl}`);
  console.log(`💚 Health check: ${publicUrl}/health\n`);
  console.log('Ready to receive enrichment requests!\n');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
