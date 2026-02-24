import { ApolloClient } from './apollo-client';
import { WebhookServer } from './webhook-server';
import { validateLinkedInUrl } from '../utils/linkedin-validator';
import { EnrichedLead, FailedEnrichment, EnrichmentBatchResult } from '../types';

/**
 * Servicio de enriquecimiento de leads desde LinkedIn usando Apollo.io
 */
export class EnrichmentService {
  private webhookServer?: WebhookServer;

  constructor(webhookServer?: WebhookServer) {
    this.webhookServer = webhookServer;
  }

  /**
   * Enriquece un solo perfil de LinkedIn
   * @param linkedinUrl URL del perfil de LinkedIn
   * @param userId ID del usuario que hace la solicitud (para logging)
   * @param includePhone Si se debe intentar obtener el número de teléfono
   * @returns Lead enriquecido
   */
  async enrichProfile(
    apolloApiKey: string,
    linkedinUrl: string,
    userId?: string,
    includePhone: boolean = false
  ): Promise<EnrichedLead> {
    const apolloClient = new ApolloClient(apolloApiKey, this.webhookServer);
    // Validar URL
    const validation = validateLinkedInUrl(linkedinUrl);

    if (!validation.isValid) {
      throw new Error(`Invalid LinkedIn URL: ${validation.error}`);
    }

    // Usar URL normalizada
    const normalizedUrl = validation.normalizedUrl!;

    try {
      // Llamar a Apollo API
      const enrichedLead = await apolloClient.enrichProfile(normalizedUrl, {
        revealPersonalEmails: true,
        revealPhoneNumber: includePhone
      });

      // TODO: Guardar en base de datos cuando esté implementada
      // TODO: Registrar en activity log cuando esté implementado

      console.log(`✓ Profile enriched successfully: ${enrichedLead.fullName || 'Unknown'}`);
      console.log(`  Credits consumed: ${enrichedLead.creditsConsumed}`);

      return enrichedLead;
    } catch (error) {
      console.error(`✗ Failed to enrich profile: ${normalizedUrl}`);
      console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Enriquece múltiples perfiles de LinkedIn en batch
   * @param linkedinUrls Array de URLs de LinkedIn
   * @param userId ID del usuario que hace la solicitud
   * @param includePhone Si se debe intentar obtener números de teléfono
   * @returns Resultado del batch con éxitos y fallos
   */
  async enrichProfiles(
    apolloApiKey: string,
    linkedinUrls: string[],
    userId?: string,
    includePhone: boolean = false
  ): Promise<EnrichmentBatchResult> {
    const successful: EnrichedLead[] = [];
    const failed: FailedEnrichment[] = [];
    let totalCreditsConsumed = 0;

    // Deduplicar URLs
    const uniqueUrls = [...new Set(linkedinUrls)];

    console.log(`\nProcessing ${uniqueUrls.length} LinkedIn profiles...`);
    if (includePhone) {
      console.log('📞 Phone number enrichment enabled (via webhook)');
    }

    // Procesar en paralelo con Promise.allSettled
    const results = await Promise.allSettled(
      uniqueUrls.map(url => this.enrichProfile(apolloApiKey, url, userId, includePhone))
    );

    // Procesar resultados
    results.forEach((result, index) => {
      const url = uniqueUrls[index];

      if (result.status === 'fulfilled') {
        successful.push(result.value);
        totalCreditsConsumed += result.value.creditsConsumed;
      } else {
        const error = result.reason;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Determinar código de error
        let errorCode: FailedEnrichment['errorCode'] = 'API_ERROR';
        if (errorMessage.includes('Invalid LinkedIn URL')) {
          errorCode = 'INVALID_URL';
        } else if (errorMessage.includes('not found')) {
          errorCode = 'NOT_FOUND';
        } else if (errorMessage.includes('rate limit')) {
          errorCode = 'RATE_LIMIT';
        }

        failed.push({
          linkedinUrl: url,
          error: errorMessage,
          errorCode
        });
      }
    });

    console.log(`\n✓ Successfully enriched: ${successful.length}`);
    console.log(`✗ Failed: ${failed.length}`);
    console.log(`Total credits consumed: ${totalCreditsConsumed}`);

    return {
      successful,
      failed,
      totalCreditsConsumed
    };
  }

  /**
   * Verifica los créditos disponibles en Apollo
   */
  async checkCredits(apolloApiKey: string) {
    const apolloClient = new ApolloClient(apolloApiKey, this.webhookServer);
    return apolloClient.checkCredits();
  }

  /**
   * Obtiene el servidor webhook (si está configurado)
   */
  getWebhookServer(): WebhookServer | undefined {
    return this.webhookServer;
  }
}
