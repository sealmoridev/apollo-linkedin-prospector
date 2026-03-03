export type FieldType = 'email' | 'phone';

export interface ProviderCapability {
  id: string;
  name: string;
  fields: FieldType[];
  /** Field name on the Empresa Prisma model */
  apiKeyField: string;
}

export const PROVIDER_REGISTRY: ProviderCapability[] = [
  { id: 'apollo',     name: 'Apollo.io',  fields: ['email', 'phone'], apiKeyField: 'apollo_api_key'     },
  { id: 'prospeo',    name: 'Prospeo',    fields: ['email', 'phone'], apiKeyField: 'prospeo_api_key'    },
  { id: 'findymail',  name: 'Findymail',  fields: ['email', 'phone'], apiKeyField: 'findymail_api_key'  },
  { id: 'leadmagic',  name: 'LeadMagic',  fields: ['email', 'phone'], apiKeyField: 'leadmagic_api_key'  },
];

/** Returns providers that have an API key configured in the tenant.
 *  For the primary provider all fields are returned unchanged.
 *  For backup providers, fields are filtered by provider_config (default: enabled).
 */
export function getConfiguredProviders(tenant: Record<string, any>): ProviderCapability[] {
  const providerConfig: Record<string, { email?: boolean; phone?: boolean }> =
    (tenant.provider_config as Record<string, { email?: boolean; phone?: boolean }>) ?? {};
  const primaryId = tenant.enrichment_provider || 'apollo';

  return PROVIDER_REGISTRY
    .filter(p => !!tenant[p.apiKeyField])
    .map(p => {
      if (p.id === primaryId) return p; // primary: all fields, no restriction
      const cfg = providerConfig[p.id];
      const fields = (['email', 'phone'] as FieldType[]).filter(f => {
        if (!cfg) return true; // not configured → default enabled
        return cfg[f] !== false;
      });
      return { ...p, fields };
    })
    .filter(p => p.fields.length > 0);
}
