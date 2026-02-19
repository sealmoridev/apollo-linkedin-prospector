import { google } from 'googleapis';
import { LeadProfile } from '../types';
import { tokenStorage } from './token-storage';

export class SheetsService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID || '';
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

        // Por defecto asume localhost:3000 si no estamos en producción
        const baseUrl = process.env.PUBLIC_WEBHOOK_URL
            ? process.env.PUBLIC_WEBHOOK_URL.replace('/webhook/apollo', '')
            : 'http://localhost:3000';
        this.redirectUri = `${baseUrl}/api/auth/google/callback`;
    }

    getOAuthClient() {
        return new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );
    }

    getAuthUrl(): string {
        const oauth2Client = this.getOAuthClient();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', // Para obtener refresh token
            prompt: 'consent', // Forzar consentimiento para asegurar el refresh token
            scope: ['https://www.googleapis.com/auth/spreadsheets']
        });
    }

    async getTokensFromCode(code: string) {
        const oauth2Client = this.getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Inicializa el cliente Sheets para un usuario específico con sus tokens
     */
    private getUserSheetsClient(userId: string) {
        const userTokens = tokenStorage.getToken(userId);
        if (!userTokens) {
            throw new Error(`No credentials found for user ${userId}`);
        }

        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({
            access_token: userTokens.accessToken,
            refresh_token: userTokens.refreshToken,
            expiry_date: userTokens.expiryDate
        });

        // Evento por si el token se refresca automáticamente
        oauth2Client.on('tokens', (tokens) => {
            console.log(`[OAuth] Refreshing token for user ${userId}`);
            const updatedToken = {
                ...userTokens,
                accessToken: tokens.access_token || userTokens.accessToken,
                expiryDate: tokens.expiry_date || userTokens.expiryDate
            };
            if (tokens.refresh_token) {
                updatedToken.refreshToken = tokens.refresh_token;
            }
            tokenStorage.setToken(userId, updatedToken);
        });

        return google.sheets({ version: 'v4', auth: oauth2Client });
    }

    /**
     * Crea un nuevo Spreadsheet para el usuario si no tiene uno
     */
    async getOrCreateSpreadsheet(userId: string): Promise<string> {
        const userTokens = tokenStorage.getToken(userId);
        if (!userTokens) throw new Error('User not authenticated with Google');

        // Si ya lo tiene cacheado, lo retornamos (asumiendo que no lo borró de drive)
        if (userTokens.spreadsheetId) {
            return userTokens.spreadsheetId;
        }

        const sheets = this.getUserSheetsClient(userId);

        try {
            // 1. Crear el archivo
            const response = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: 'Apollo Prospector Leads'
                    },
                    sheets: [
                        {
                            properties: {
                                title: 'Leads Base'
                            }
                        }
                    ]
                }
            });

            const spreadsheetId = response.data.spreadsheetId;
            const sheetId = response.data.sheets?.[0]?.properties?.sheetId || 0;

            if (!spreadsheetId) {
                throw new Error('No se pudo crear la hoja de cálculo');
            }

            // 2. Darle formato a los Headers (fila 1)
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Leads Base!A1:H1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['Nombre', 'Emails', 'Título', 'Empresa', 'Locación', 'Teléfonos', 'URL LinkedIn', 'Fecha Captura']]
                }
            });

            // Poner los encabezados en negrita (opcional, pero útil)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 8
                                },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: { bold: true },
                                        backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                                    }
                                },
                                fields: 'userEnteredFormat(textFormat,backgroundColor)'
                            }
                        }
                    ]
                }
            });

            console.log(`✅ [Sheets] Nueva hoja creada para el usuario ${userId} (${spreadsheetId})`);

            // Guardarlo en nuestro archivo de sesión
            tokenStorage.setSpreadsheetId(userId, spreadsheetId);

            return spreadsheetId;

        } catch (error) {
            console.error('❌ [Sheets] Error creando spreadsheet:', error);
            throw error;
        }
    }

    /**
     * Guarda un perfil en el Google Sheet
     */
    async appendLead(userId: string, lead: LeadProfile): Promise<boolean> {
        try {
            const spreadsheetId = await this.getOrCreateSpreadsheet(userId);
            const sheets = this.getUserSheetsClient(userId);

            const emails = [lead.email, lead.personalEmail].filter(Boolean).join(', ');
            const phones = lead.phoneNumbers?.join(', ') || 'Pendiente Webhook';

            const values = [
                [
                    lead.name || 'Sin nombre',
                    emails || 'Sin email',
                    lead.title || 'Sin título',
                    lead.company || 'Sin empresa',
                    lead.location || 'Sin locación',
                    phones,
                    lead.linkedinUrl || '',
                    new Date().toISOString()
                ]
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: 'Leads Base!A:H',
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values: values
                }
            });

            console.log(`✅ Lead "${lead.name}" insertado para usuario ${userId}.`);
            return true;

        } catch (error) {
            console.error(`❌ Error insertando Lead en Sheets para usuario ${userId}:`, error);
            return false;
        }
    }

    /**
     * Actualiza el teléfono de un lead (Webhook asíncrono)
     */
    async updatePhone(userId: string, linkedinUrl: string, phones: string[]): Promise<boolean> {
        if (!phones || phones.length === 0) return false;

        try {
            const spreadsheetId = await this.getOrCreateSpreadsheet(userId);
            const sheets = this.getUserSheetsClient(userId);

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Leads Base!A:H',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) return false;

            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                const rowUrl = rows[i][6]; // G column -> LinkedIn URL
                if (rowUrl && linkedinUrl && rowUrl.includes(linkedinUrl.replace(/\/$/, ''))) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) {
                return false;
            }

            const rowNumber = rowIndex + 1;
            const rangeToUpdate = `Leads Base!F${rowNumber}`; // Columna F = 'Teléfonos'

            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: rangeToUpdate,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[phones.join(', ')]]
                }
            });

            console.log(`✅ Teléfono actualizado en Sheets (Fila ${rowNumber}) para ${userId}`);
            return true;

        } catch (error) {
            console.error('❌ Error actualizando teléfono:', error);
            return false;
        }
    }
}
