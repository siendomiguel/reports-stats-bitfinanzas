import { google } from 'googleapis';
import fs from 'fs';
import { getGoogleSheetsConfig } from './config.js';

/**
 * Cargar URLs desde Google Sheets
 * @returns {Promise<string[]>} Array de URLs
 */
export async function loadUrlsFromGoogleSheets() {
  try {
    const config = getGoogleSheetsConfig();

    if (!config.sheetId) {
      console.log('⚠️ GOOGLE_SHEET_ID no configurado, usando archivo local');
      return null;
    }

    const credentials = config.credentials;
    const SHEET_ID = config.sheetId;
    const RANGE = config.range;

    // Configurar cliente de Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Leer datos del sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('⚠️ No se encontraron URLs en Google Sheets');
      return null;
    }

    // Filtrar URLs válidas (no vacías, que empiecen con /)
    const urls = rows
      .flat()
      .filter(url => url && typeof url === 'string' && url.trim().startsWith('/'))
      .map(url => url.trim());

    console.log(`📊 Cargadas ${urls.length} URLs desde Google Sheets`);
    console.log(`🔗 Sheet ID: ${SHEET_ID}`);

    return urls;
  } catch (error) {
    console.error('❌ Error cargando URLs desde Google Sheets:', error.message);
    return null;
  }
}

/**
 * Guardar URLs en cache local
 * @param {string[]} urls - Array de URLs
 */
export function saveUrlsCache(urls) {
  try {
    const cacheConfig = {
      urls,
      lastUpdated: new Date().toISOString(),
      source: 'google-sheets',
      description: 'Cache de URLs desde Google Sheets',
    };

    if (!fs.existsSync('./config')) {
      fs.mkdirSync('./config', { recursive: true });
    }

    fs.writeFileSync('./config/urls-cache.json', JSON.stringify(cacheConfig, null, 2));
    console.log('💾 URLs guardadas en cache local');
  } catch (error) {
    console.error('❌ Error guardando cache:', error.message);
  }
}

/**
 * Cargar URLs desde cache local
 * @returns {string[]|null} Array de URLs o null si no hay cache
 */
export function loadUrlsCache() {
  try {
    const cachePath = './config/urls-cache.json';
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log(`📂 Cargadas ${cache.urls.length} URLs desde cache`);
    console.log(`🕒 Cache actualizado: ${cache.lastUpdated}`);

    return cache.urls;
  } catch (error) {
    console.error('❌ Error cargando cache:', error.message);
    return null;
  }
}
