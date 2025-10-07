import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// === CONFIGURACIÓN ===
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const TIMEZONE = process.env.GA4_TIMEZONE || 'America/Mexico_City'; // Configura tu zona horaria

// Leer credenciales correctamente (evita el warning de keyFilename)
const credentials = JSON.parse(
  fs.readFileSync('../../bitfinanzas/credentials/bitfinanzas-tv-f43f3f68a926.json', 'utf8'),
);
const client = new BetaAnalyticsDataClient({ credentials });

// === LISTA DE URLS A CONSULTAR ===
const urls = ['/radar-economico-divisas-y-commodities-hoy-105/'];

// === FUNCIÓN PARA GENERAR NOMBRE DE ARCHIVO CON FECHA Y HORA ===
function getTimestampedFilename() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `./data/report_${date}_${time}.csv`;
}

// === CREA DIRECTORIO SI NO EXISTE ===
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

// === FUNCIÓN PRINCIPAL ===
async function getGA4DataForUrl(url) {
  /*console.log('🔍 Probando sin filtro, muestra 5 rutas recientes:');
  const [debugResponse] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: 'today', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    limit: 5,
  });

  console.log(JSON.stringify(debugResponse.rows, null, 2));*/

  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: 'today', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: url },
      },
    },
  });

  if (!response.rows || response.rows.length === 0) {
    return { url, views: 0, duration: 0, bounce: 0 };
  }

  const totalViews = response.rows.reduce((sum, r) => sum + parseInt(r.metricValues[0].value), 0);
  const avgDuration =
    response.rows.reduce((sum, r) => sum + parseFloat(r.metricValues[1].value), 0) / response.rows.length;
  const avgBounce =
    response.rows.reduce((sum, r) => sum + parseFloat(r.metricValues[2].value), 0) / response.rows.length;

  return {
    url,
    views: totalViews,
    duration: avgDuration.toFixed(2),
    bounce: avgBounce.toFixed(2),
  };
}

async function main() {
  try {
    console.log(`🔍 Consultando ${urls.length} URLs en GA4...\n`);

    const OUTPUT_PATH = getTimestampedFilename();

    const csvWriter = createObjectCsvWriter({
      path: OUTPUT_PATH,
      header: [
        { id: 'url', title: 'URL' },
        { id: 'views', title: 'Vistas (hoy)' },
        { id: 'duration', title: 'Duración Promedio (s)' },
        { id: 'bounce', title: 'Tasa de Rebote (%)' },
      ],
    });

    const allData = [];
    for (const url of urls) {
      const data = await getGA4DataForUrl(url);
      console.log(`✅ ${url} → ${data.views} vistas`);
      allData.push(data);
    }

    await csvWriter.writeRecords(allData);
    console.log(`\n📁 Reporte generado: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
