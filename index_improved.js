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

// === FUNCIÓN PARA OBTENER FECHAS CONSISTENTES ===
function getDateRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Formato YYYY-MM-DD
  const formatDate = date => {
    return date.toISOString().split('T')[0];
  };

  return {
    startDate: formatDate(yesterday),
    endDate: formatDate(yesterday), // Solo datos de ayer para consistencia
  };
}

// === FUNCIÓN DE VALIDACIÓN DE DATOS ===
async function validateDataConsistency(url, data) {
  console.log(`🔍 Validando consistencia de datos para ${url}:`);

  // Verificar si las métricas son razonables
  const warnings = [];

  if (data.views > 0 && data.sessions === 0) {
    warnings.push('⚠️ Hay vistas pero no sesiones - posible inconsistencia');
  }

  if (data.sessions > data.views) {
    warnings.push('⚠️ Más sesiones que vistas - revisar configuración');
  }

  if (data.bounce > 100) {
    warnings.push('⚠️ Tasa de rebote > 100% - posible error de cálculo');
  }

  if (warnings.length > 0) {
    console.log(`📊 Advertencias para ${url}:`);
    warnings.forEach(w => console.log(`   ${w}`));
  } else {
    console.log(`✅ Datos consistentes para ${url}`);
  }

  return warnings;
}

// === CREA DIRECTORIO SI NO EXISTE ===
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

// === FUNCIÓN PRINCIPAL MEJORADA ===
async function getGA4DataForUrl(url) {
  const dateRange = getDateRange();

  console.log(`📅 Consultando datos del ${dateRange.startDate} para: ${url}`);

  try {
    // Primera consulta: datos básicos de la página específica
    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'activeUsers' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT', // Cambiado a EXACT para mayor precisión
            value: url,
            caseSensitive: false,
          },
        },
      },
      // Agregar metadatos para validación
      returnPropertyQuota: true,
      keepEmptyRows: true,
    });

    console.log(`🔍 Respuesta raw para ${url}:`, {
      rowCount: response.rows?.length || 0,
      metadata: response.metadata?.currencyCode,
      samplingMetadatas: response.metadata?.samplingMetadatas,
    });

    if (!response.rows || response.rows.length === 0) {
      console.log(`⚠️ No se encontraron datos para ${url} en ${dateRange.startDate}`);

      // Consulta de respaldo con CONTAINS para verificar si existe con variaciones
      const [backupResponse] = await client.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'CONTAINS', value: url.replace(/\/$/, '') },
          },
        },
        limit: 10,
      });

      if (backupResponse.rows && backupResponse.rows.length > 0) {
        console.log(
          `🔍 URLs similares encontradas:`,
          backupResponse.rows.map(r => r.dimensionValues[0].value),
        );
      }

      return {
        url,
        views: 0,
        sessions: 0,
        duration: 0,
        bounce: 0,
        activeUsers: 0,
        dataFound: false,
        queryDate: dateRange.startDate,
        warnings: [],
      };
    }

    // Procesar datos encontrados
    let totalViews = 0;
    let totalSessions = 0;
    let weightedDuration = 0;
    let weightedBounce = 0;
    let totalActiveUsers = 0;

    response.rows.forEach(row => {
      const views = parseInt(row.metricValues[0].value) || 0;
      const sessions = parseInt(row.metricValues[1].value) || 0;
      const duration = parseFloat(row.metricValues[2].value) || 0;
      const bounce = parseFloat(row.metricValues[3].value) || 0;
      const users = parseInt(row.metricValues[4].value) || 0;

      console.log(`   Fila: vistas=${views}, sesiones=${sessions}, duración=${duration}s, rebote=${bounce}`);

      totalViews += views;
      totalSessions += sessions;
      totalActiveUsers += users;

      // Ponderar métricas por número de sesiones
      if (sessions > 0) {
        weightedDuration += duration * sessions;
        weightedBounce += bounce * sessions;
      }
    });

    // Calcular promedios ponderados correctamente
    const avgDuration = totalSessions > 0 ? weightedDuration / totalSessions : 0;
    const avgBounce = totalSessions > 0 ? weightedBounce / totalSessions : 0;

    const result = {
      url,
      views: totalViews,
      sessions: totalSessions,
      duration: avgDuration.toFixed(2),
      bounce: (avgBounce * 100).toFixed(2), // GA4 devuelve bounce rate como decimal (0.5 = 50%)
      activeUsers: totalActiveUsers,
      dataFound: true,
      queryDate: dateRange.startDate,
      warnings: [],
    };

    // Validar consistencia de datos
    result.warnings = await validateDataConsistency(url, result);

    console.log(`✅ Datos procesados para ${url}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error consultando ${url}:`, error.message);
    return {
      url,
      views: 0,
      sessions: 0,
      duration: 0,
      bounce: 0,
      activeUsers: 0,
      dataFound: false,
      error: error.message,
      queryDate: dateRange.startDate,
      warnings: [`Error: ${error.message}`],
    };
  }
}

async function main() {
  try {
    console.log(`🔍 Consultando ${urls.length} URLs en GA4...\n`);
    console.log(`📊 Property ID: ${PROPERTY_ID}`);
    console.log(`🌍 Zona horaria configurada: ${TIMEZONE}`);

    const OUTPUT_PATH = getTimestampedFilename();

    const csvWriter = createObjectCsvWriter({
      path: OUTPUT_PATH,
      header: [
        { id: 'url', title: 'URL' },
        { id: 'queryDate', title: 'Fecha de consulta' },
        { id: 'views', title: 'Vistas de página' },
        { id: 'sessions', title: 'Sesiones' },
        { id: 'activeUsers', title: 'Usuarios activos' },
        { id: 'duration', title: 'Duración promedio (s)' },
        { id: 'bounce', title: 'Tasa de rebote (%)' },
        { id: 'dataFound', title: 'Datos encontrados' },
        { id: 'warnings', title: 'Advertencias' },
      ],
    });

    const allData = [];
    const summary = {
      totalUrls: urls.length,
      successful: 0,
      withWarnings: 0,
      errors: 0,
    };

    for (const url of urls) {
      const data = await getGA4DataForUrl(url);

      if (data.dataFound) {
        summary.successful++;
        console.log(`✅ ${url} → ${data.views} vistas, ${data.sessions} sesiones`);
      } else {
        summary.errors++;
        console.log(`❌ ${url} → Sin datos`);
      }

      if (data.warnings && data.warnings.length > 0) {
        summary.withWarnings++;
      }

      // Convertir warnings array a string para CSV
      const dataForCsv = {
        ...data,
        warnings: data.warnings ? data.warnings.join('; ') : '',
      };

      allData.push(dataForCsv);

      // Pausa entre consultas para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await csvWriter.writeRecords(allData);

    console.log(`\n📁 Reporte generado: ${OUTPUT_PATH}`);
    console.log(`📊 Resumen:`);
    console.log(`   URLs consultadas: ${summary.totalUrls}`);
    console.log(`   Exitosas: ${summary.successful}`);
    console.log(`   Con advertencias: ${summary.withWarnings}`);
    console.log(`   Errores: ${summary.errors}`);

    // Verificar si hay discrepancias importantes
    if (summary.withWarnings > 0) {
      console.log(`\n⚠️ Se detectaron ${summary.withWarnings} URLs con advertencias.`);
      console.log(`   Revisa el archivo CSV para más detalles.`);
    }
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

main();
