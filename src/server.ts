import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { WebhookServer } from './services/webhook-server';
import { EnrichmentService } from './services/enrichment-service';
import { SheetsService } from './services/sheets-service';
import { tokenStorage } from './services/token-storage';
import { validateLinkedInUrl } from './utils/linkedin-validator';
import { millionVerifyService } from './services/million-verify-service';
import cors from 'cors';

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
app.use(cors()); // Importante para que la extensión de Chrome pueda llamar al API
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

// Crear servicio de Google Sheets
const sheetsService = new SheetsService();

// Escuchar eventos del webhook para actualizar teléfonos en Sheets
webhookServer.on('data', async (data) => {
  // Nota: en un escenario real, Apollo no sabe el userId. Tendrías que mapear el requestId con el userId que lo inició.
  // Para este prototipo, vamos a intentar ver si existe un 'userId' en la metadata, de lo contrario usaremos 'default'
  const userId = data.rawData?.metadata?.userId || 'default';

  if (data.phoneNumbers && data.phoneNumbers.length > 0 && data.linkedinUrl) {
    console.log(`[Google Sheets] Intentando actualizar teléfono para URL: ${data.linkedinUrl} (user: ${userId})`);
    await sheetsService.updatePhone(userId, data.linkedinUrl, data.phoneNumbers.map((p: any) => p.sanitized_number));
  }
});

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

// ============================================================================
// RUTAS DE LA API - ENRIQUECIMIENTO (PASO 1)
// ============================================================================

// Enriquecer un perfil individual
app.post('/api/enrich', async (req: Request, res: Response) => {
  try {
    const { linkedinUrl, includePhone = false, userId = 'default' } = req.body;

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

    // Ya no guardamos aquí. Solo devolvemos los datos para "Pre-visualización"
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

// Validar correo manualmente (MillionVerify)
app.post('/api/verify-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const verificationResult = await millionVerifyService.verifyEmail(email);
    res.json(verificationResult);

  } catch (error) {
    console.error('[API] Error validating email:', error);
    res.status(500).json({
      error: 'Exception while validating email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// RUTAS DE GOOGLE SHEETS (PASO 2)
// ============================================================================

// Listar hojas de cálculo del usuario
app.get('/api/sheets/list', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default';
    const files = await sheetsService.listSpreadsheets(userId);

    res.json({
      success: true,
      files: files
    });
  } catch (error) {
    console.error('[API] Error listing sheets:', error);
    res.status(500).json({
      error: 'Failed to list spreadsheets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Crear una nueva hoja de cálculo explícitamente
app.post('/api/sheets/create', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', sheetName } = req.body;
    console.log(`[API] Creating new spreadsheet expressly for user ${userId} with name: ${sheetName}`);

    const spreadsheetId = await sheetsService.createSpreadsheet(userId, sheetName);

    res.json({
      success: true,
      spreadsheetId: spreadsheetId,
      message: 'Spreadsheet created successfully'
    });
  } catch (error) {
    console.error('[API] Error creating sheet explicitly:', error);
    res.status(500).json({
      error: 'Failed to create spreadsheet',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Guardar datos en una hoja específica
app.post('/api/sheets/save', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', spreadsheetId, lead, sheetName } = req.body;

    if (!spreadsheetId || !lead) {
      return res.status(400).json({
        error: 'spreadsheetId and lead data are required'
      });
    }

    console.log(`[API] Saving lead to sheet ${spreadsheetId} for user ${userId}`);

    const sheetResult = await sheetsService.appendLead(userId, spreadsheetId, lead, sheetName);

    if (sheetResult.success) {
      res.json({ success: true, message: 'Lead saved successfully', spreadsheetId: sheetResult.spreadsheetId });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save logic in Sheets' });
    }

  } catch (error) {
    console.error('[API] Error saving to sheets:', error);
    res.status(500).json({
      error: 'Exception while saving to sheets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// RUTAS DE GOOGLE OAUTH
// ============================================================================

// 1. Obtener URL de autenticación
app.get('/api/auth/google', (req: Request, res: Response) => {
  // Opcional: pasar el userId al State para saber a quién pertenece el token
  const userId = (req.query.userId as string) || 'default';
  const url = sheetsService.getAuthUrl() + `&state=${userId}`;

  res.json({ url });
});

// 2. Callback de Google
app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const userId = (req.query.state as string) || 'default';

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const tokens = await sheetsService.getTokensFromCode(code);

    // Guardar tokens en nuestro "almacenamiento"
    tokenStorage.setToken(userId, {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      expiryDate: tokens.expiry_date || 0
    });

    console.log(`✅ [OAuth] Tokens guardados para el usuario: ${userId}`);

    // Ya no creamos el spreadsheet automáticamente. El usuario lo elegirá en la UI.

    // Devolver un HTML que cierre la ventana emergente de Chrome
    res.send(`
      <html>
        <head><title>Autenticación Exitosa</title></head>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h2>¡Autenticación con Google exitosa!</h2>
          <p>Ya puedes volver a la extensión y cerrar esta pestaña.</p>
          <script>
            setTimeout(() => { window.close() }, 3000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// 3. Verificar estado (Para la extensión de Chrome)
app.get('/api/auth/status', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default';
  const tokens = tokenStorage.getToken(userId);

  if (tokens) {
    res.json({
      authenticated: true,
      spreadsheetId: tokens.spreadsheetId || null
    });
  } else {
    res.json({ authenticated: false });
  }
});

// 4. Desconectar cuenta de Google
app.post('/api/auth/disconnect', (req: Request, res: Response) => {
  try {
    const { userId = 'default' } = req.body;

    // Eliminar los tokens de la memoria/disco
    tokenStorage.deleteToken(userId);
    console.log(`✅ [OAuth] Tokens eliminados para el usuario: ${userId}`);

    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error('[API] Error disconnecting user:', error);
    res.status(500).json({
      error: 'Failed to disconnect',
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
