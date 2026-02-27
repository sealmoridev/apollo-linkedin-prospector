import axios, { AxiosInstance, AxiosError } from 'axios';
import { EnrichedLead } from '../types/index';

/**
 * Cliente para la API de Prospeo.io
 * La entrega de teléfono es SINCRÓNICA — sin webhook necesario.
 */
export class ProspeoClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Prospeo API key is required');
    }
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.prospeo.io',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': this.apiKey
      },
      timeout: 30000
    });
  }

  /**
   * Enriquece un perfil de LinkedIn usando Prospeo API (sincrónico).
   * El teléfono se devuelve en la misma respuesta HTTP.
   */
  async enrichProfile(linkedinUrl: string): Promise<EnrichedLead> {
    try {
      console.log(`[Prospeo] Enriching profile: ${linkedinUrl}`);

      const response = await this.client.post('/enrich-person', {
        enrich_mobile: true,
        only_verified_mobile: false,
        data: { linkedin_url: linkedinUrl }
      });

      return this.parseProspeoResponse(response.data, linkedinUrl);
    } catch (error) {
      throw this.handleProspeoError(error, linkedinUrl);
    }
  }

  private parseProspeoResponse(response: any, linkedinUrl: string): EnrichedLead {
    const person = response?.person;

    if (!person) {
      throw new Error('No person data found in Prospeo response');
    }

    const company = response?.company;

    // Construir ubicación
    const locationParts = [person.city, person.state, person.country].filter(Boolean);
    const location = locationParts.join(', ') || null;

    // Construir notas con campos adicionales de Prospeo
    const extras: string[] = [];
    if (person.headline) extras.push(`Headline: ${person.headline}`);
    if (person.summary) extras.push(`Summary: ${person.summary}`);
    if (Array.isArray(person.skills) && person.skills.length > 0) {
      extras.push(`Skills: ${person.skills.slice(0, 10).join(', ')}`);
    }
    const notes = extras.length > 0 ? extras.join(' | ') : null;

    // Email: puede venir como objeto { email } o string
    const email = typeof person.email === 'object'
      ? person.email?.email || null
      : person.email || null;

    // Teléfono: puede venir como objeto { mobile } o string
    const phoneNumber = typeof person.mobile === 'object'
      ? person.mobile?.mobile || null
      : person.mobile || null;

    // Company domain
    const companyDomain = company?.domain || company?.website || null;
    const companyName = company?.name || person.company || null;
    const industry = company?.industry || person.industry || null;

    return {
      linkedinUrl,
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || null,
      email,
      personalEmail: null, // Prospeo no diferencia email personal/trabajo
      phoneNumber,
      title: person.current_job_title || person.title || null,
      company: companyName,
      companyDomain,
      industry,
      location,
      enrichedAt: new Date(),
      creditsConsumed: 1,
      apolloId: null,
      notes: notes || undefined
    };
  }

  private handleProspeoError(error: unknown, linkedinUrl: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        return new Error('Invalid Prospeo API key');
      }
      if (axiosError.response?.status === 404) {
        return new Error(`Profile not found in Prospeo database: ${linkedinUrl}`);
      }
      if (axiosError.response?.status === 429) {
        return new Error('Prospeo API rate limit exceeded. Please try again later.');
      }
      if (axiosError.response?.status && axiosError.response.status >= 500) {
        return new Error('Prospeo API is currently unavailable');
      }

      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data || axiosError.message;
      return new Error(`Prospeo API error: ${JSON.stringify(errorMessage)}`);
    }

    if (error instanceof Error) {
      return new Error(`Network error: ${error.message}`);
    }

    return new Error('Unknown error occurred while calling Prospeo API');
  }
}
