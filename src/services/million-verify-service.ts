import fetch from 'node-fetch';

export interface VerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'error';
    rawCode: number;
    message?: string;
}

export class MillionVerifyService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.MILLION_VERIFY_API_KEY || '';
    }

    /**
     * Valida un correo usando la API de MillionVerify
     */
    async verifyEmail(email: string): Promise<VerificationResult> {
        if (!this.apiKey || this.apiKey === 'tu_api_key_aqui') {
            console.warn('⚠️ [MillionVerify] API Key no configurada. Agrega MILLION_VERIFY_API_KEY a tu .env');
            return { email, status: 'error', rawCode: 0, message: 'API Key de validación faltante en el servidor.' };
        }

        if (!email || !email.includes('@')) {
            return { email, status: 'invalid', rawCode: 6, message: 'Formato de correo inválido' };
        }

        try {
            console.log(`[MillionVerify] Verificando correo: ${email}...`);
            const url = `https://api.millionverify.com/api/v3/?api=${this.apiKey}&email=${encodeURIComponent(email)}&timeout=20`;

            const response = await fetch(url);

            if (!response.ok) {
                return { email, status: 'error', rawCode: response.status, message: 'Error en la respuesta de la API v3' };
            }

            const data = await response.json() as any;

            // Handle API level errors (e.g. invalid key)
            if (data.error) {
                console.error(`[MillionVerify] API Error: ${data.error}`);
                return { email, status: 'error', rawCode: 4, message: data.error };
            }

            const code = parseInt(data.resultcode);
            let status: VerificationResult['status'] = 'unknown';

            // Result codes según la documentación:
            // 1 = ok, 2 = catch_all, 3 = unknown, 4 = error, 5 = disposable, 6 = invalid
            if (code === 1) status = 'valid';
            else if (code === 2) status = 'catch_all';
            else if (code === 5 || code === 6) status = 'invalid';
            else if (code === 4) status = 'error';

            console.log(`[MillionVerify] Resultado para ${email}: ${status} (Code ${code})`);

            return {
                email,
                status,
                rawCode: code
            };

        } catch (error) {
            console.error('[MillionVerify] Error de red o parseo:', error);
            return { email, status: 'error', rawCode: 0, message: 'Fallo interno al verificar el correo.' };
        }
    }
}

export const millionVerifyService = new MillionVerifyService();
