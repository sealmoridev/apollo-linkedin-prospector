import { ApolloClient } from './apollo-client';
import { ProspeoClient } from './prospeo-client';
import { WebhookServer } from './webhook-server';
import { validateLinkedInUrl } from '../utils/linkedin-validator';
import { EnrichedLead, FailedEnrichment, EnrichmentBatchResult } from '../types/index';

export type ProviderConfig =
  | { provider: 'apollo'; apiKey: string }
  | { provider: 'prospeo'; apiKey: string };

/**
 * Servicio de enriquecimiento de leads desde LinkedIn.
 * Soporta Apollo (async webhook) y Prospeo (sync).
 */
export class EnrichmentService {
  private webhookServer?: WebhookServer;

  constructor(webhookServer?: WebhookServer) {
    this.webhookServer = webhookServer;
  }

  /**
   * Enriquece un solo perfil de LinkedIn.
   * @param providerConfig  Proveedor y su API key
   * @param linkedinUrl     URL del perfil de LinkedIn
   * @param userId          ID del usuario que hace la solicitud (para logging)
   * @param includePhone    Si se debe intentar obtener el número de teléfono (solo Apollo)
   */
  async enrichProfile(
    providerConfig: ProviderConfig | string, // string = legacy: apollo key
    linkedinUrl: string,
    userId?: string,
    includePhone: boolean = false
  ): Promise<EnrichedLead> {
    // Backwards-compat: si se pasa string, asumir Apollo
    const config: ProviderConfig = typeof providerConfig === 'string'
      ? { provider: 'apollo', apiKey: providerConfig }
      : providerConfig;

    const validation = validateLinkedInUrl(linkedinUrl);
    if (!validation.isValid) {
      throw new Error(`Invalid LinkedIn URL: ${validation.error}`);
    }
    const normalizedUrl = validation.normalizedUrl!;

    try {
      let enrichedLead: EnrichedLead;

      if (config.provider === 'prospeo') {
        const prospeoClient = new ProspeoClient(config.apiKey);
        // Prospeo siempre incluye teléfono de forma sincrónica
        enrichedLead = await prospeoClient.enrichProfile(normalizedUrl);
      } else {
        const apolloClient = new ApolloClient(config.apiKey, this.webhookServer);
        enrichedLead = await apolloClient.enrichProfile(normalizedUrl, {
          revealPersonalEmails: true,
          revealPhoneNumber: includePhone
        });
      }

      console.log(`✓ Profile enriched (${config.provider}): ${enrichedLead.fullName || 'Unknown'}`);
      console.log(`  Credits consumed: ${enrichedLead.creditsConsumed}`);

      return enrichedLead;
    } catch (error) {
      console.error(`✗ Failed to enrich profile: ${normalizedUrl}`);
      console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Enriquece múltiples perfiles en batch (solo Apollo).
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

    const uniqueUrls = [...new Set(linkedinUrls)];
    console.log(`\nProcessing ${uniqueUrls.length} LinkedIn profiles...`);

    const results = await Promise.allSettled(
      uniqueUrls.map(url => this.enrichProfile({ provider: 'apollo', apiKey: apolloApiKey }, url, userId, includePhone))
    );

    results.forEach((result, index) => {
      const url = uniqueUrls[index];
      if (result.status === 'fulfilled') {
        successful.push(result.value);
        totalCreditsConsumed += result.value.creditsConsumed;
      } else {
        const error = result.reason;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let errorCode: FailedEnrichment['errorCode'] = 'API_ERROR';
        if (errorMessage.includes('Invalid LinkedIn URL')) errorCode = 'INVALID_URL';
        else if (errorMessage.includes('not found')) errorCode = 'NOT_FOUND';
        else if (errorMessage.includes('rate limit')) errorCode = 'RATE_LIMIT';
        failed.push({ linkedinUrl: url, error: errorMessage, errorCode });
      }
    });

    console.log(`\n✓ Successfully enriched: ${successful.length}`);
    console.log(`✗ Failed: ${failed.length}`);
    console.log(`Total credits consumed: ${totalCreditsConsumed}`);

    return { successful, failed, totalCreditsConsumed };
  }

  async checkCredits(apolloApiKey: string) {
    const apolloClient = new ApolloClient(apolloApiKey, this.webhookServer);
    return apolloClient.checkCredits();
  }

  getWebhookServer(): WebhookServer | undefined {
    return this.webhookServer;
  }
}
