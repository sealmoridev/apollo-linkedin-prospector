import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApolloApiResponse, EnrichedLead } from '../types';
import { WebhookServer } from './webhook-server';

/**
 * Cliente para interactuar con la API de Apollo.io
 */
export class ApolloClient {
  private client: AxiosInstance;
  private apiKey: string;
  private webhookServer?: WebhookServer;

  constructor(apiKey: string, webhookServer?: WebhookServer) {
    if (!apiKey) {
      throw new Error('Apollo API key is required');
    }

    this.apiKey = apiKey;
    this.webhookServer = webhookServer;
    this.client = axios.create({
      baseURL: 'https://api.apollo.io/api/v1',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000 // 30 segundos
    });
  }

  /**
   * Enriquece un perfil de LinkedIn usando la API de Apollo
   * @param linkedinUrl URL del perfil de LinkedIn
   * @param options Opciones adicionales para el enriquecimiento
   * @returns Datos enriquecidos del lead
   */
  async enrichProfile(
    linkedinUrl: string,
    options?: {
      revealPersonalEmails?: boolean;
      revealPhoneNumber?: boolean;
      webhookUrl?: string;
    }
  ): Promise<EnrichedLead> {
    try {
      const requestBody: any = {
        linkedin_url: linkedinUrl
      };

      // Determinar si usar webhook
      const useWebhook = options?.revealPhoneNumber && (options?.webhookUrl || this.webhookServer);
      let webhookUrl: string | undefined;

      if (useWebhook) {
        webhookUrl = options?.webhookUrl || this.webhookServer?.getWebhookUrl();
        if (!webhookUrl) {
          throw new Error('Webhook URL is required for phone number enrichment');
        }
      }

      // Solo agregar reveal_personal_emails si se solicita
      if (options?.revealPersonalEmails) {
        requestBody.reveal_personal_emails = true;
      }

      // Solo agregar reveal_phone_number si se proporciona webhook_url
      if (options?.revealPhoneNumber && webhookUrl) {
        requestBody.reveal_phone_number = true;
        requestBody.webhook_url = webhookUrl;
      }

      console.log(`[Apollo] Requesting enrichment with webhook: ${!!webhookUrl}`);

      const response = await this.client.post<ApolloApiResponse>(
        '/people/match',
        requestBody,
        {
          headers: {
            'X-Api-Key': this.apiKey
          }
        }
      );

      // Parsear respuesta inicial
      const enrichedLead = this.parseApolloResponse(response.data, linkedinUrl);

      // Si solicitamos teléfono con webhook, esperar los datos
      if (options?.revealPhoneNumber && webhookUrl && this.webhookServer) {
        console.log('[Apollo] Waiting for webhook data...');
        
        try {
          // Esperar hasta 30 segundos por los datos del webhook
          const webhookData = await this.webhookServer.waitForData(
            enrichedLead.apolloId || linkedinUrl,
            30000
          );

          // Actualizar con datos del webhook
          if (webhookData.phoneNumbers && webhookData.phoneNumbers.length > 0) {
            enrichedLead.phoneNumber = webhookData.phoneNumbers[0].raw_number || 
                                       webhookData.phoneNumbers[0].sanitized_number ||
                                       webhookData.phoneNumbers[0];
            console.log(`[Apollo] ✓ Phone number received via webhook`);
          }

          if (webhookData.personalEmails && webhookData.personalEmails.length > 0) {
            enrichedLead.personalEmail = webhookData.personalEmails[0];
            console.log(`[Apollo] ✓ Personal email received via webhook`);
          }
        } catch (webhookError) {
          console.warn('[Apollo] Webhook timeout - continuing without phone data');
          // No lanzar error, solo continuar sin los datos del webhook
        }
      }

      return enrichedLead;
    } catch (error) {
      throw this.handleApolloError(error, linkedinUrl);
    }
  }

  /**
   * Parsea la respuesta de Apollo API a nuestro formato EnrichedLead
   */
  private parseApolloResponse(
    response: ApolloApiResponse,
    linkedinUrl: string
  ): EnrichedLead {
    const person = response.person;

    if (!person) {
      throw new Error('No person data found in Apollo response');
    }

    // Construir ubicación completa
    const locationParts = [person.city, person.state, person.country].filter(Boolean);
    const location = locationParts.join(', ') || null;

    return {
      linkedinUrl,
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.name || null,
      email: person.email || null,
      personalEmail: person.personal_emails?.[0] || null,
      phoneNumber: person.phone_numbers?.[0]?.raw_number || null,
      title: person.title || null,
      company: person.organization?.name || null,
      companyDomain: person.organization?.primary_domain || null,
      industry: person.organization?.industry || null,
      location,
      enrichedAt: new Date(),
      creditsConsumed: response.credits_consumed || 1,
      apolloId: person.id || null
    };
  }

  /**
   * Maneja errores de la API de Apollo
   */
  private handleApolloError(error: unknown, linkedinUrl: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Rate limiting
      if (axiosError.response?.status === 429) {
        return new Error('Apollo API rate limit exceeded. Please try again later.');
      }

      // Not found
      if (axiosError.response?.status === 404) {
        return new Error(`Profile not found in Apollo database: ${linkedinUrl}`);
      }

      // Unauthorized
      if (axiosError.response?.status === 401) {
        return new Error('Invalid Apollo API key');
      }

      // Server errors
      if (axiosError.response?.status && axiosError.response.status >= 500) {
        return new Error('Apollo API is currently unavailable');
      }

      // Other API errors
      const errorMessage = axiosError.response?.data || axiosError.message;
      return new Error(`Apollo API error: ${JSON.stringify(errorMessage)}`);
    }

    // Network or other errors
    if (error instanceof Error) {
      return new Error(`Network error: ${error.message}`);
    }

    return new Error('Unknown error occurred while calling Apollo API');
  }

  /**
   * Verifica los créditos disponibles en la cuenta de Apollo
   * Nota: Apollo no tiene un endpoint específico para esto,
   * así que esta es una implementación placeholder
   */
  async checkCredits(): Promise<{ remaining: number; total: number }> {
    // TODO: Implementar cuando Apollo proporcione un endpoint para esto
    // Por ahora retornamos valores placeholder
    return {
      remaining: 1000,
      total: 10000
    };
  }
}
