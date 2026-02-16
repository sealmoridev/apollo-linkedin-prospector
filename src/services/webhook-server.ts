import express, { Request, Response } from 'express';
import { EventEmitter } from 'events';

/**
 * Servidor webhook para recibir datos asíncronos de Apollo.io
 * (números de teléfono y emails personales)
 */
export class WebhookServer extends EventEmitter {
  private app: express.Application;
  private server: any;
  private port: number;
  private webhookUrl: string;

  // Almacenamiento temporal de datos recibidos por webhook
  private pendingData: Map<string, any> = new Map();

  constructor(port: number = 3000, publicUrl?: string) {
    super();
    this.port = port;
    this.app = express();
    
    // Si no se proporciona URL pública, usar localhost (solo para desarrollo)
    this.webhookUrl = publicUrl || `http://localhost:${port}/webhook/apollo`;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Log requests
    this.app.use((req, res, next) => {
      console.log(`[Webhook] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Apollo webhook endpoint
    this.app.post('/webhook/apollo', (req: Request, res: Response) => {
      try {
        const data = req.body;
        
        console.log('[Webhook] Received data from Apollo:');
        console.log(JSON.stringify(data, null, 2));

        // Extraer información relevante
        const enrichmentData = this.parseWebhookData(data);
        
        if (enrichmentData.requestId) {
          // Almacenar datos temporalmente
          this.pendingData.set(enrichmentData.requestId, enrichmentData);
          
          // Emitir evento para que el cliente pueda recoger los datos
          this.emit('data', enrichmentData);
          
          console.log(`[Webhook] Data stored for request: ${enrichmentData.requestId}`);
        }

        // Responder a Apollo que recibimos los datos
        res.status(200).json({ received: true });
      } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Endpoint para verificar datos pendientes
    this.app.get('/webhook/pending/:requestId', (req: Request, res: Response) => {
      const requestId = req.params.requestId;
      const data = this.pendingData.get(requestId);
      
      if (data) {
        res.json(data);
      } else {
        res.status(404).json({ error: 'No data found for this request' });
      }
    });
  }

  private parseWebhookData(data: any) {
    // Apollo envía los datos en diferentes formatos dependiendo del tipo
    // Aquí parseamos la estructura común
    return {
      requestId: data.request_id || data.id,
      personId: data.person?.id,
      phoneNumbers: data.person?.phone_numbers || [],
      personalEmails: data.person?.personal_emails || [],
      organizationId: data.organization?.id,
      timestamp: new Date(),
      rawData: data
    };
  }

  /**
   * Inicia el servidor webhook
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`\n🌐 Webhook server running on port ${this.port}`);
          console.log(`📡 Webhook URL: ${this.webhookUrl}`);
          console.log(`💚 Health check: http://localhost:${this.port}/health\n`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${this.port} is already in use`);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Detiene el servidor webhook
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Obtiene la URL del webhook
   */
  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  /**
   * Obtiene datos pendientes por request ID
   */
  getPendingData(requestId: string): any {
    return this.pendingData.get(requestId);
  }

  /**
   * Limpia datos pendientes antiguos (más de 1 hora)
   */
  cleanupOldData() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [requestId, data] of this.pendingData.entries()) {
      if (data.timestamp.getTime() < oneHourAgo) {
        this.pendingData.delete(requestId);
        console.log(`[Webhook] Cleaned up old data for request: ${requestId}`);
      }
    }
  }

  /**
   * Espera a que lleguen datos para un request específico
   */
  async waitForData(requestId: string, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      // Verificar si ya tenemos los datos
      const existingData = this.pendingData.get(requestId);
      if (existingData) {
        resolve(existingData);
        return;
      }

      // Configurar timeout
      const timeout = setTimeout(() => {
        this.removeListener('data', dataHandler);
        reject(new Error(`Timeout waiting for webhook data (${timeoutMs}ms)`));
      }, timeoutMs);

      // Escuchar por nuevos datos
      const dataHandler = (data: any) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          this.removeListener('data', dataHandler);
          resolve(data);
        }
      };

      this.on('data', dataHandler);
    });
  }
}
