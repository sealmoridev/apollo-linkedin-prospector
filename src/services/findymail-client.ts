import axios, { AxiosInstance, AxiosError } from 'axios';
import { EnrichedLead } from '../types/index';

export interface FindymailFieldResult {
  found: boolean;
  value: string | null;
  creditsConsumed: number;
}

/**
 * Cliente para Findymail API
 * Docs: https://app.findymail.com/docs
 * Auth: Authorization: Bearer <key>
 * Email cost: 1 credit if found, 0 if not
 * Phone cost: 10 credits if found, 0 if not
 */
export class FindymailClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://app.findymail.com',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
  }

  /**
   * Full profile enrichment using Findymail as primary provider.
   * Returns email + basic profile data. Phone is never fetched here
   * (10 credits/hit — left for cascade if needed).
   */
  async enrichProfile(linkedinUrl: string): Promise<EnrichedLead> {
    try {
      const res = await this.client.post('/api/search/linkedin', {
        linkedin_url: linkedinUrl
      });
      const d = res.data ?? {};
      const email = d.email || null;
      const firstName = d.first_name || null;
      const lastName = d.last_name || null;
      const company = d.company || null;
      const domain = d.domain || null;

      return {
        linkedinUrl,
        firstName,
        lastName,
        fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
        email,
        personalEmail: null,
        phoneNumber: null,
        title: null,
        company,
        companyDomain: domain,
        industry: null,
        location: null,
        enrichedAt: new Date(),
        creditsConsumed: email ? 1 : 0,
        apolloId: null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = (error as AxiosError).response?.status;
        if (status === 404 || status === 422) {
          // Profile not found — return empty lead, don't throw
          return {
            linkedinUrl, firstName: null, lastName: null, fullName: null,
            email: null, personalEmail: null, phoneNumber: null, title: null,
            company: null, companyDomain: null, industry: null, location: null,
            enrichedAt: new Date(), creditsConsumed: 0, apolloId: null,
          };
        }
        if (status === 401 || status === 403) throw new Error('Invalid Findymail API key');
        if (status === 429) throw new Error('Findymail rate limit exceeded');
      }
      throw error instanceof Error ? error : new Error('Findymail enrichProfile failed');
    }
  }

  /** Find work email from LinkedIn URL */
  async findEmail(linkedinUrl: string): Promise<FindymailFieldResult> {
    try {
      const res = await this.client.post('/api/search/linkedin', {
        linkedin_url: linkedinUrl
      });
      const email = res.data?.email || null;
      return { found: !!email, value: email, creditsConsumed: email ? 1 : 0 };
    } catch (error) {
      return this.handleNotFound(error, 'email');
    }
  }

  /** Find phone from LinkedIn URL */
  async findPhone(linkedinUrl: string): Promise<FindymailFieldResult> {
    try {
      const res = await this.client.post('/api/search/phone', {
        linkedin_url: linkedinUrl
      });
      const phone = res.data?.phone || null;
      return { found: !!phone, value: phone, creditsConsumed: phone ? 10 : 0 };
    } catch (error) {
      return this.handleNotFound(error, 'phone');
    }
  }

  private handleNotFound(error: unknown, field: string): FindymailFieldResult {
    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;
      if (status === 404 || status === 422 || status === 200) {
        return { found: false, value: null, creditsConsumed: 0 };
      }
      if (status === 401 || status === 403) throw new Error('Invalid Findymail API key');
      if (status === 429) throw new Error('Findymail rate limit exceeded');
    }
    throw error instanceof Error ? error : new Error(`Findymail ${field} search failed`);
  }
}
