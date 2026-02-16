/**
 * Validador y normalizador de URLs de LinkedIn
 */

export interface LinkedInUrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  profileIdentifier?: string;
  error?: string;
}

/**
 * Valida y normaliza una URL de perfil de LinkedIn
 * Soporta formatos:
 * - https://www.linkedin.com/in/username
 * - https://linkedin.com/in/username/
 * - https://www.linkedin.com/pub/username/1/2/3
 */
export function validateLinkedInUrl(url: string): LinkedInUrlValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required and must be a string'
    };
  }

  // Trim whitespace
  url = url.trim();

  // Regex para validar URLs de LinkedIn
  // Soporta: /in/username, /pub/username/x/y/z
  const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/([a-zA-Z0-9\-]+)(\/.*)?$/;
  
  const match = url.match(linkedInRegex);
  
  if (!match) {
    return {
      isValid: false,
      error: 'Invalid LinkedIn profile URL format'
    };
  }

  const profileType = match[2]; // 'in' o 'pub'
  const identifier = match[3]; // username o profile ID
  
  // Normalizar a formato estándar
  const normalizedUrl = `https://www.linkedin.com/${profileType}/${identifier}`;
  
  return {
    isValid: true,
    normalizedUrl,
    profileIdentifier: identifier
  };
}

/**
 * Extrae el identificador de perfil de una URL de LinkedIn
 */
export function extractProfileIdentifier(url: string): string | null {
  const result = validateLinkedInUrl(url);
  return result.isValid ? result.profileIdentifier! : null;
}

/**
 * Normaliza una URL de LinkedIn a formato estándar
 */
export function normalizeLinkedInUrl(url: string): string | null {
  const result = validateLinkedInUrl(url);
  return result.isValid ? result.normalizedUrl! : null;
}
