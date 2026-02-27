// Tipos principales del sistema

export interface EnrichedLead {
  // Datos extraídos
  linkedinUrl: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  personalEmail: string | null;
  phoneNumber: string | null;
  
  // Información profesional
  title: string | null;
  company: string | null;
  companyDomain: string | null;
  industry: string | null;
  location: string | null;
  
  // Metadata
  enrichedAt: Date;
  creditsConsumed: number;
  apolloId: string | null;

  // Extra fields from providers that don't map to standard columns
  notes?: string | null;
}

export interface EnrichmentBatchResult {
  successful: EnrichedLead[];
  failed: FailedEnrichment[];
  totalCreditsConsumed: number;
}

export interface FailedEnrichment {
  linkedinUrl: string;
  error: string;
  errorCode: 'NOT_FOUND' | 'INVALID_URL' | 'API_ERROR' | 'RATE_LIMIT';
}

export interface ApolloApiResponse {
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    email: string | null;
    personal_emails: string[];
    phone_numbers: Array<{ raw_number: string }>;
    organization?: {
      name: string;
      primary_domain: string;
      industry: string;
    };
    city: string;
    state: string;
    country: string;
  };
  credits_consumed?: number;
}
