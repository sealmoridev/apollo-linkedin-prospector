import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { google } from 'googleapis';
import { WebhookServer } from './services/webhook-server';
import { EnrichmentService } from './services/enrichment-service';
import { SheetsService } from './services/sheets-service';
import { tokenStorage } from './services/token-storage';
import { validateLinkedInUrl } from './utils/linkedin-validator';
import { millionVerifyService } from './services/million-verify-service';
import { ApolloClient } from './services/apollo-client';
import { ProspeoClient } from './services/prospeo-client';
import { FindymailClient } from './services/findymail-client';
import { LeadMagicClient } from './services/leadmagic-client';
import { getConfiguredProviders } from './services/provider-registry';
import adminRoutes from './routes/admin';
import cors from 'cors';

dotenv.config();

/**
 * Servidor web principal para Railway
 * Expone API REST y webhook para Apollo.io
 */

const PORT = parseInt(process.env.PORT || '3000');

import { tenantAuthMiddleware } from './middlewares/tenant-auth';
import { prisma } from './lib/prisma';

// Crear app Express
const app = express();

app.use((req, res, next) => {
  console.log(`[Global] ${req.method} ${req.url}`);
  next();
});

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
const enrichmentService = new EnrichmentService(webhookServer);

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
// RUTAS DE LA API Y BACKOFFICE
// ============================================================================

// Rutas del Backoffice (Admin)
app.use('/api/admin', adminRoutes);

// Servir SPA del backoffice
const backofficeDir = path.join(__dirname, '..', 'backoffice', 'dist');
app.use('/admin', express.static(backofficeDir));
app.get('/admin/*', (_req: Request, res: Response) => {
  res.sendFile(path.join(backofficeDir, 'index.html'));
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhookUrl: webhookUrl
  });
});

// Página de inicio → redirigir al backoffice
app.get('/', (req: Request, res: Response) => {
  res.redirect('/admin');
});

// Info de la API (para uso interno/debugging)
app.get('/api', (req: Request, res: Response) => {
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
app.post('/api/enrich', tenantAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { linkedinUrl, sesion_id } = req.body;
    const tenant = req.tenant!;
    const user = req.extensionUser!;

    const provider = ((tenant as any).enrichment_provider || 'apollo') as string;

    // LeadMagic and Findymail cannot work as standalone primaries:
    // - LeadMagic email requires firstName+lastName+domain from a prior extraction
    // - Findymail only finds emails; returns no profile data (name, title, company, etc.)
    if (provider === 'leadmagic' || provider === 'findymail') {
      return res.status(400).json({
        error: `${provider === 'leadmagic' ? 'LeadMagic' : 'Findymail'} no puede usarse como proveedor principal. Úsalo como cascada.`,
      });
    }

    const apiKeyMap: Record<string, string | null> = {
      apollo:    (tenant as any).apollo_api_key    || null,
      prospeo:   (tenant as any).prospeo_api_key   || null,
      findymail: (tenant as any).findymail_api_key || null,
    };
    const apiKey = apiKeyMap[provider];
    if (!apiKey) {
      return res.status(403).json({ error: `API Key de ${provider} no configurada para el tenant.` });
    }

    if (!linkedinUrl) {
      return res.status(400).json({
        error: 'linkedinUrl is required',
        example: { linkedinUrl: 'https://www.linkedin.com/in/username' }
      });
    }

    // Validar URL
    const validation = validateLinkedInUrl(linkedinUrl);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL', details: validation.error });
    }

    const providerConfig = { provider: provider as any, apiKey };

    console.log(`[API] Enriching (${provider}): ${linkedinUrl} by user ${user.id}`);

    // Prospeo: include phone only if primaryPhone setting is not explicitly false (default: true)
    // Apollo/Findymail: email only
    const tenantProviderConfig = (tenant as any).provider_config as Record<string, any> | null;
    const prospeoIncludePhone = provider === 'prospeo'
      ? (tenantProviderConfig?.prospeo?.primaryPhone !== false)
      : false;

    const lead = await enrichmentService.enrichProfile(
      providerConfig,
      linkedinUrl,
      user.id,
      prospeoIncludePhone
    );

    // Guardar registro de consumo
    await prisma.consumo.create({
      data: {
        usuario_id: user.id,
        empresa_id: tenant.id,
        creditos_apollo: lead.creditsConsumed || 1,
        creditos_verifier: 0,
        sesion_id: sesion_id || null
      }
    });

    res.json({
      success: true,
      data: lead,
      provider
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
app.post('/api/enrich/batch', tenantAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { linkedinUrls, includePhone = false } = req.body;
    const tenant = req.tenant!;
    const user = req.extensionUser!;

    if (!tenant.apollo_api_key) {
      return res.status(403).json({ error: 'Configuración Apollo API Key faltante para el tenant.' });
    }

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

    console.log(`[API] Batch enriching ${linkedinUrls.length} profiles (phone: ${includePhone}) by user ${user.id}`);

    // Enriquecer batch con el API Key del tenant
    const result = await enrichmentService.enrichProfiles(
      tenant.apollo_api_key,
      linkedinUrls,
      user.id,
      includePhone
    );

    if (result.totalCreditsConsumed > 0) {
      // Guardar registro de consumo
      await prisma.consumo.create({
        data: {
          usuario_id: user.id,
          empresa_id: tenant.id,
          creditos_apollo: result.totalCreditsConsumed,
          creditos_verifier: 0
        }
      });
    }

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
app.post('/api/verify-email', tenantAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, sesion_id } = req.body;
    const tenant = req.tenant!;
    const user = req.extensionUser!;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!tenant.millionverifier_api_key) {
      return res.status(403).json({ error: 'Configuración MillionVerifier API Key faltante para el tenant.' });
    }

    const verificationResult = await millionVerifyService.verifyEmail(tenant.millionverifier_api_key, email);

    // Solo logueamos consumo si se conectó a la API
    if (verificationResult.status !== 'error') {
      await prisma.consumo.create({
        data: {
          usuario_id: user.id,
          empresa_id: tenant.id,
          creditos_apollo: 0,
          creditos_verifier: 1,
          sesion_id: sesion_id || null
        }
      });
    }

    res.json(verificationResult);

  } catch (error) {
    console.error('[API] Error validating email:', error);
    res.status(500).json({
      error: 'Exception while validating email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Solicitar teléfono de forma independiente (solo para tenants Apollo con webhook)
app.post('/api/enrich-phone', tenantAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { linkedinUrl, sesion_id } = req.body;
    const tenant = req.tenant!;
    const user = req.extensionUser!;

    if (!linkedinUrl) {
      return res.status(400).json({ error: 'linkedinUrl is required' });
    }

    const provider = (tenant as any).enrichment_provider || 'apollo';

    // Para Prospeo, el teléfono ya viene en la extracción inicial — este endpoint no aplica
    if (provider === 'prospeo') {
      return res.status(400).json({
        error: 'Este endpoint no aplica para tenants Prospeo. El teléfono se incluye automáticamente en la extracción.'
      });
    }

    if (!tenant.apollo_api_key) {
      return res.status(403).json({ error: 'Apollo API Key no configurada para el tenant.' });
    }

    console.log(`[API] Phone request for: ${linkedinUrl} by user ${user.id}`);

    // Registrar crédito consumido inmediatamente
    await prisma.consumo.create({
      data: {
        usuario_id: user.id,
        empresa_id: tenant.id,
        creditos_apollo: 1,
        creditos_verifier: 0,
        sesion_id: sesion_id || null
      }
    });

    // Disparar enriquecimiento async con teléfono — la respuesta llega al webhook y actualiza el Sheet
    enrichmentService.enrichProfile({ provider: 'apollo', apiKey: tenant.apollo_api_key }, linkedinUrl, user.id, true)
      .catch(err => console.error('[API] enrich-phone async error:', err));

    res.json({ success: true, message: 'Solicitud enviada. El teléfono llegará al Sheet vía webhook.' });

  } catch (error) {
    console.error('[API] Error requesting phone:', error);
    res.status(500).json({
      error: 'Error al solicitar teléfono',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CASCADE ENRICHMENT
// ============================================================================

/** Returns configured providers for the tenant + which fields each supports */
app.get('/api/tenant-providers', tenantAuthMiddleware, (req: Request, res: Response) => {
  const tenant = req.tenant! as any;
  const configured = getConfiguredProviders(tenant);
  const active = tenant.enrichment_provider || 'apollo';

  // Whether the primary provider actually requests phone in its initial call
  const tenantProviderConfig = (tenant.provider_config as Record<string, any> | null) ?? {};
  const primaryPhoneEnabled = active === 'prospeo'
    ? (tenantProviderConfig?.prospeo?.primaryPhone !== false)
    : false; // Apollo/others never fetch phone in the primary call

  res.json({
    active,
    primaryPhoneEnabled,
    providers: configured.map(p => ({
      id: p.id,
      name: p.name,
      fields: p.fields
    }))
  });
});

/**
 * Search a specific field (email | phone) using a specific provider.
 * Used for cascade enrichment — each field independently.
 */
app.post('/api/enrich-field', tenantAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { linkedinUrl, field, provider, metadata, sesion_id } = req.body;
    const tenant = req.tenant! as any;
    const user = req.extensionUser!;

    if (!linkedinUrl || !field || !provider) {
      return res.status(400).json({ error: 'linkedinUrl, field, and provider are required' });
    }
    if (!['email', 'phone'].includes(field)) {
      return res.status(400).json({ error: 'field must be "email" or "phone"' });
    }

    const apiKeyMap: Record<string, string | null> = {
      apollo:    tenant.apollo_api_key    || null,
      prospeo:   tenant.prospeo_api_key   || null,
      findymail: tenant.findymail_api_key || null,
      leadmagic: tenant.leadmagic_api_key || null,
    };
    const apiKey = apiKeyMap[provider];
    if (!apiKey) {
      return res.status(403).json({ error: `${provider} API key not configured for this tenant` });
    }

    console.log(`[CascadeEnrich] field=${field} provider=${provider} url=${linkedinUrl} user=${user.id}`);

    let found = false;
    let value: string | null = null;
    let creditsConsumed = 0;

    if (provider === 'apollo') {
      const client = new ApolloClient(apiKey, webhookServer);
      const lead = await client.enrichProfile(linkedinUrl, {
        revealPersonalEmails: field === 'email',
        revealPhoneNumber: field === 'phone'
      });
      value = field === 'email' ? (lead.email || lead.personalEmail || null) : (lead.phoneNumber || null);
      found = !!value;
      creditsConsumed = lead.creditsConsumed || 1;

    } else if (provider === 'prospeo') {
      const client = new ProspeoClient(apiKey);
      const lead = await client.enrichProfile(linkedinUrl);
      value = field === 'email' ? (lead.email || null) : (lead.phoneNumber || null);
      found = !!value;
      creditsConsumed = lead.creditsConsumed || 1;

    } else if (provider === 'findymail') {
      const client = new FindymailClient(apiKey);
      const result = field === 'email'
        ? await client.findEmail(linkedinUrl)
        : await client.findPhone(linkedinUrl);
      ({ found, value, creditsConsumed } = result);

    } else if (provider === 'leadmagic') {
      const client = new LeadMagicClient(apiKey);
      if (field === 'email') {
        const result = await client.findEmail(
          metadata?.firstName || '',
          metadata?.lastName || '',
          metadata?.companyDomain || null,
          metadata?.companyName || null
        );
        ({ found, value, creditsConsumed } = result);
      } else {
        const result = await client.findPhone(linkedinUrl);
        ({ found, value, creditsConsumed } = result);
      }

    } else {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    // Log credit usage (even if not found — some providers charge on attempt)
    if (creditsConsumed > 0) {
      await prisma.consumo.create({
        data: {
          usuario_id: user.id,
          empresa_id: tenant.id,
          creditos_apollo: creditsConsumed,
          creditos_verifier: 0,
          sesion_id: sesion_id || null
        }
      });
    }

    res.json({ success: true, found, field, value, provider, creditsConsumed });

  } catch (error) {
    console.error('[CascadeEnrich] Error:', error);
    res.status(500).json({
      error: 'Cascade enrichment failed',
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
    const { userId = 'default', spreadsheetId, lead, sheetName, sesion_id, provider = 'apollo' } = req.body;

    if (!spreadsheetId || !lead) {
      return res.status(400).json({
        error: 'spreadsheetId and lead data are required'
      });
    }

    console.log(`[API] Saving lead to sheet ${spreadsheetId} for user ${userId}`);

    // Buscar ExtensionUser para obtener sdrInfo
    let sdrInfo: { id: string; nombre: string | null; email: string } | undefined;
    let extensionUser: { id: string; nombre: string | null; email: string; empresa_id: string } | null = null;
    try {
      extensionUser = await prisma.extensionUser.findUnique({
        where: { id: userId },
        select: { id: true, nombre: true, email: true, empresa_id: true }
      });
      if (extensionUser) {
        sdrInfo = { id: extensionUser.id, nombre: extensionUser.nombre, email: extensionUser.email };
      }
    } catch (_) { /* ignorar si no existe */ }

    const sheetResult = await sheetsService.appendLead(userId, spreadsheetId, lead, sheetName, sdrInfo);

    if (sheetResult.success) {
      // Crear Consumo con lead_data para el historial de capturas
      if (extensionUser) {
        const primaryEmail = (lead as any).primaryEmail || lead.email || lead.personalEmail || null;
        const rawStatus = (lead as any).emailStatus;
        try {
          await prisma.consumo.create({
            data: {
              usuario_id: extensionUser.id,
              empresa_id: extensionUser.empresa_id,
              creditos_apollo: 0,
              creditos_verifier: 0,
              sesion_id: sesion_id || null,
              sheet_id: sheetResult.spreadsheetId || spreadsheetId,
              sheet_name: sheetName || null,
              lead_data: {
                created_at: new Date().toISOString(),
                full_name: lead.fullName || null,
                first_name: lead.firstName || null,
                last_name: lead.lastName || null,
                title: lead.title || null,
                primary_email: primaryEmail,
                personal_email: lead.personalEmail || null,
                phone_number: lead.phoneNumber || null,
                company_name: lead.company || null,
                company_domain: lead.companyDomain || null,
                industry: lead.industry || null,
                location: lead.location || null,
                linkedin_url: lead.linkedinUrl || null,
                email_status: rawStatus || null,
                enrichment_provider: provider || 'apollo',
                sdr_id: extensionUser.id,
                sdr_name: extensionUser.nombre || null,
                sdr_mail: extensionUser.email
              }
            }
          });
        } catch (consumoErr) {
          console.error('[API] Error creating sheet consumo record:', consumoErr);
          // No bloqueamos la respuesta si falla el log
        }
      }

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

    // Obtener perfil de Google (email, nombre, avatar)
    let googleProfile: { email: string; nombre: string; avatar_url: string } | undefined;
    try {
      const oauth2Client = sheetsService.getOAuthClient();
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      if (data.email) {
        googleProfile = {
          email: data.email,
          nombre: data.name || data.email,
          avatar_url: data.picture || ''
        };
      }
    } catch (profileErr) {
      console.warn('[OAuth] No se pudo obtener perfil de Google:', profileErr);
    }

    // Guardar tokens + perfil en storage
    tokenStorage.setToken(userId, {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      expiryDate: tokens.expiry_date || 0,
      ...(googleProfile && { googleProfile })
    });

    // Actualizar ExtensionUser si ya existe
    if (googleProfile) {
      await prisma.extensionUser.updateMany({
        where: { id: userId },
        data: {
          email: googleProfile.email,
          nombre: googleProfile.nombre,
          avatar_url: googleProfile.avatar_url || null
        }
      });
    }

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
app.get('/api/auth/status', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default';
  const apiKey = req.query.apiKey as string | undefined;
  const tokens = tokenStorage.getToken(userId);

  if (tokens) {
    let empresa = null;
    if (apiKey) {
      try {
        empresa = await prisma.empresa.findUnique({
          where: { tenant_api_key: apiKey },
          select: { nombre: true, logo_url: true }
        });
      } catch (_) { /* ignorar errores de lookup */ }
    }
    res.json({
      authenticated: true,
      spreadsheetId: tokens.spreadsheetId || null,
      googleProfile: tokens.googleProfile || null,
      empresa
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
  console.log(`💚 Health check: ${publicUrl}/health`);
  console.log(`🔑 Google OAuth redirect URI: ${publicUrl}/api/auth/google/callback\n`);
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
