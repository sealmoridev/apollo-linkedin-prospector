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

/** Returns providers that have an API key configured in the tenant */
export function getConfiguredProviders(tenant: Record<string, any>): ProviderCapability[] {
  return PROVIDER_REGISTRY.filter(p => !!tenant[p.apiKeyField]);
}
