import axios, { AxiosInstance, AxiosError } from 'axios';

export interface LeadMagicFieldResult {
  found: boolean;
  value: string | null;
  creditsConsumed: number;
}

/**
 * Cliente para LeadMagic API
 * Docs: https://leadmagic.io/docs
 * Auth: X-API-Key header
 * Email cost: 1 credit if found, 0 if not
 * Phone cost: 5 credits if found, 0 if not
 *
 * NOTE: Email finder requires first_name + last_name + (domain OR company_name).
 * These must come from the already-extracted lead data (initial enrichment).
 */
export class LeadMagicClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.leadmagic.io',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 30000
    });
  }

  /**
   * Find work email.
   * Requires name + company domain or company name from prior extraction.
   */
  async findEmail(
    firstName: string,
    lastName: string,
    companyDomain?: string | null,
    companyName?: string | null
  ): Promise<LeadMagicFieldResult> {
    if (!firstName && !lastName) {
      return { found: false, value: null, creditsConsumed: 0 };
    }
    if (!companyDomain && !companyName) {
      return { found: false, value: null, creditsConsumed: 0 };
    }

    try {
      const body: Record<string, string> = {};
      if (firstName) body.first_name = firstName;
      if (lastName) body.last_name = lastName;
      if (companyDomain) body.domain = companyDomain;
      else if (companyName) body.company_name = companyName;

      const res = await this.client.post('/v1/people/email-finder', body);
      const email = res.data?.email || null;
      const credits = res.data?.credits_consumed ?? (email ? 1 : 0);
      return { found: !!email, value: email, creditsConsumed: credits };
    } catch (error) {
      return this.handleNotFound(error, 'email');
    }
  }

  /** Find mobile phone from LinkedIn profile URL (5 credits if found) */
  async findPhone(linkedinUrl: string): Promise<LeadMagicFieldResult> {
    try {
      const res = await this.client.post('/v1/people/mobile-finder', {
        profile_url: linkedinUrl
      });
      const phone = res.data?.mobile_number || null;
      const credits = res.data?.credits_consumed ?? (phone ? 5 : 0);
      return { found: !!phone, value: phone, creditsConsumed: credits };
    } catch (error) {
      return this.handleNotFound(error, 'phone');
    }
  }

  private handleNotFound(error: unknown, field: string): LeadMagicFieldResult {
    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;
      if (status === 404 || status === 422) {
        return { found: false, value: null, creditsConsumed: 0 };
      }
      if (status === 401 || status === 403) throw new Error('Invalid LeadMagic API key');
      if (status === 429) throw new Error('LeadMagic rate limit exceeded (300 req/min)');
    }
    throw error instanceof Error ? error : new Error(`LeadMagic ${field} search failed`);
  }
}
