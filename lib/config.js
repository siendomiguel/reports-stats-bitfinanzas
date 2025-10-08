import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cargar credenciales de Google desde archivo o variable de entorno
 * @returns {Object} - Credenciales parseadas
 */
export function loadGoogleCredentials() {
  try {
    // Opción 1: Credenciales como variable de entorno (Railway, Heroku, etc.)
    if (process.env.GOOGLE_CREDENTIALS) {
      console.log('📡 Cargando credenciales desde variable de entorno...');
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      console.log('✅ Credenciales de Google cargadas desde variable de entorno');
      return credentials;
    }

    // Opción 2: Credenciales desde archivo
    const credentialsPath =
      process.env.GA4_CREDENTIALS_PATH || '../../bitfinanzas/credentials/bitfinanzas-tv-f43f3f68a926.json';

    const absolutePath = path.resolve(credentialsPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Archivo de credenciales no encontrado: ${absolutePath}\n` +
          `Tip: Configura GOOGLE_CREDENTIALS como variable de entorno o GA4_CREDENTIALS_PATH`,
      );
    }

    const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    console.log('✅ Credenciales de Google cargadas desde archivo');
    return credentials;
  } catch (error) {
    console.error('❌ Error cargando credenciales:', error.message);
    throw error;
  }
}

/**
 * Obtener configuración de Google Analytics
 * @returns {Object} - Configuración de GA4
 */
export function getGA4Config() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const timezone = process.env.GA4_TIMEZONE || 'America/Mexico_City';

  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID no está configurado en las variables de entorno');
  }

  return {
    propertyId,
    timezone,
    credentials: loadGoogleCredentials(),
  };
}

/**
 * Obtener configuración de Google Sheets
 * @returns {Object} - Configuración de Sheets
 */
export function getGoogleSheetsConfig() {
  return {
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    range: process.env.GOOGLE_SHEET_RANGE || 'URLs!A:A',
    credentials: loadGoogleCredentials(),
  };
}
