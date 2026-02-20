import fs from 'fs';
import path from 'path';

// En un entorno de producción, esto debería ir a una base de datos real (PostgreSQL, MongoDB, etc.)
// Para este MVP en Railway, usaremos un Volumen Persistente si existe en /app/data
const dataDir = fs.existsSync('/app/data') ? '/app/data' : process.cwd();
const TOKENS_FILE = path.join(dataDir, 'google-tokens.json');

export interface UserToken {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    spreadsheetId?: string; // Guardaremos aquí el ID de la hoja dinámica que creemos
}

export class TokenStorage {
    private tokens: Map<string, UserToken> = new Map();

    constructor() {
        this.loadTokens();
    }

    private loadTokens() {
        try {
            if (fs.existsSync(TOKENS_FILE)) {
                const data = fs.readFileSync(TOKENS_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                for (const [key, value] of Object.entries(parsed)) {
                    this.tokens.set(key, value as UserToken);
                }
                console.log(`[TokenStorage] Cargados ${this.tokens.size} tokens de archivo`);
            }
        } catch (e) {
            console.error('[TokenStorage] Error cargando tokens', e);
        }
    }

    private saveTokens() {
        try {
            const obj = Object.fromEntries(this.tokens);
            fs.writeFileSync(TOKENS_FILE, JSON.stringify(obj, null, 2));
        } catch (e) {
            console.error('[TokenStorage] Error guardando tokens', e);
        }
    }

    getToken(userId: string): UserToken | undefined {
        return this.tokens.get(userId);
    }

    setToken(userId: string, token: UserToken): void {
        // Si ya existía, conservar el spreadsheetId
        const existing = this.tokens.get(userId);
        if (existing && existing.spreadsheetId && !token.spreadsheetId) {
            token.spreadsheetId = existing.spreadsheetId;
        }

        this.tokens.set(userId, token);
        this.saveTokens();
    }

    setSpreadsheetId(userId: string, spreadsheetId: string): void {
        const token = this.tokens.get(userId);
        if (token) {
            token.spreadsheetId = spreadsheetId;
            this.saveTokens();
        }
    }

    deleteToken(userId: string): void {
        this.tokens.delete(userId);
        this.saveTokens();
    }
}

export const tokenStorage = new TokenStorage();
