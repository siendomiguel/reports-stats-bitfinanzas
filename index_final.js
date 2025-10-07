import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// === CONFIGURACIÓN ===
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const TIMEZONE = process.env.GA4_TIMEZONE || 'America/Mexico_City';

// Leer credenciales (mantener sintaxis original que funciona)
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

  const formatDate = date => {
    return date.toISOString().split('T')[0];
  };

  return {
    startDate: formatDate(yesterday),
    endDate: formatDate(yesterday),
  };
}

// === FUNCIÓN DE VALIDACIÓN MEJORADA ===
async function validateDataConsistency(url, data) {
  console.log(`🔍 Validando consistencia de datos para ${url}:`);

  const warnings = [];
  const insights = [];

  // Validaciones mejoradas
  if (data.sessions > data.views && data.views > 0) {
    insights.push('ℹ️ Normal: Usuarios pueden tener múltiples sesiones en la misma página');
  }

  if (data.views > 0 && data.sessions === 0) {
    warnings.push('⚠️ Hay vistas pero no sesiones - posible inconsistencia temporal');
  }

  if (data.bounce > 100) {
    warnings.push('⚠️ Tasa de rebote > 100% - error de cálculo');
  }

  if (data.bounce < 0) {
    warnings.push('⚠️ Tasa de rebote negativa - error de datos');
  }

  if (data.activeUsers > data.sessions && data.sessions > 0) {
    insights.push('ℹ️ Más usuarios que sesiones puede indicar sesiones muy cortas');
  }

  // Mostrar información
  if (insights.length > 0) {
    console.log(`💡 Insights para ${url}:`);
    insights.forEach(i => console.log(`   ${i}`));
  }

  if (warnings.length > 0) {
    console.log(`📊 Advertencias para ${url}:`);
    warnings.forEach(w => console.log(`   ${w}`));
  } else {
    console.log(`✅ Datos consistentes para ${url}`);
  }

  return { warnings, insights };
}

// === CREAR DIRECTORIO SI NO EXISTE ===
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

// === FUNCIÓN PRINCIPAL OPTIMIZADA ===
async function getGA4DataForUrl(url) {
  const dateRange = getDateRange();

  console.log(`📅 Consultando datos del ${dateRange.startDate} para: ${url}`);

  try {
    // Consulta optimizada con métricas adicionales para mejor contexto
    const [response] = await client.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [
        { name: 'pagePath' },
        { name: 'sessionSource' }, // Agregar fuente para más contexto
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'engagedSessions' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: url,
            caseSensitive: false,
          },
        },
      },
      returnPropertyQuota: true,
      keepEmptyRows: true,
      orderBys: [
        {
          metric: { metricName: 'screenPageViews' },
          desc: true,
        },
      ],
    });

    console.log(`🔍 Respuesta raw para ${url}:`, {
      rowCount: response.rows?.length || 0,
      samplingLevel: response.metadata?.samplingMetadatas?.length > 0 ? 'SAMPLED' : 'UNSAMPLED',
    });

    if (!response.rows || response.rows.length === 0) {
      console.log(`⚠️ No se encontraron datos para ${url} en ${dateRange.startDate}`);

      // Consulta de respaldo más específica
      const [backupResponse] = await client.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'CONTAINS',
              value: url.replace(/^\/|\/$/g, ''), // Remover barras del inicio y final
              caseSensitive: false,
            },
          },
        },
        limit: 5,
      });

      if (backupResponse.rows && backupResponse.rows.length > 0) {
        console.log(
          `🔍 URLs similares encontradas:`,
          backupResponse.rows.map(r => `${r.dimensionValues[0].value} (${r.metricValues[0].value} vistas)`),
        );
      }

      return {
        url,
        views: 0,
        sessions: 0,
        duration: 0,
        bounce: 0,
        activeUsers: 0,
        newUsers: 0,
        engagedSessions: 0,
        dataFound: false,
        queryDate: dateRange.startDate,
        warnings: [],
        insights: [],
      };
    }

    // Procesar y agrupar datos por fuente
    let totalViews = 0;
    let totalSessions = 0;
    let totalActiveUsers = 0;
    let totalNewUsers = 0;
    let totalEngagedSessions = 0;
    let weightedDuration = 0;
    let weightedBounce = 0;

    const sourceBreakdown = {};

    response.rows.forEach(row => {
      const source = row.dimensionValues[1].value;
      const views = parseInt(row.metricValues[0].value) || 0;
      const sessions = parseInt(row.metricValues[1].value) || 0;
      const duration = parseFloat(row.metricValues[2].value) || 0;
      const bounce = parseFloat(row.metricValues[3].value) || 0;
      const users = parseInt(row.metricValues[4].value) || 0;
      const newUsers = parseInt(row.metricValues[5].value) || 0;
      const engagedSessions = parseInt(row.metricValues[6].value) || 0;

      console.log(`   ${source}: vistas=${views}, sesiones=${sessions}, usuarios=${users}`);

      // Acumular totales
      totalViews += views;
      totalSessions += sessions;
      totalActiveUsers += users;
      totalNewUsers += newUsers;
      totalEngagedSessions += engagedSessions;

      // Ponderar métricas por sesiones
      if (sessions > 0) {
        weightedDuration += duration * sessions;
        weightedBounce += bounce * sessions;
      }

      // Guardar breakdown por fuente
      sourceBreakdown[source] = {
        views,
        sessions,
        users,
        duration: duration.toFixed(2),
        bounce: (bounce * 100).toFixed(2),
      };
    });

    // Calcular promedios ponderados
    const avgDuration = totalSessions > 0 ? weightedDuration / totalSessions : 0;
    const avgBounce = totalSessions > 0 ? weightedBounce / totalSessions : 0;
    const engagementRate = totalSessions > 0 ? (totalEngagedSessions / totalSessions) * 100 : 0;

    const result = {
      url,
      views: totalViews,
      sessions: totalSessions,
      duration: avgDuration.toFixed(2),
      bounce: (avgBounce * 100).toFixed(2),
      activeUsers: totalActiveUsers,
      newUsers: totalNewUsers,
      engagedSessions: totalEngagedSessions,
      engagementRate: engagementRate.toFixed(2),
      dataFound: true,
      queryDate: dateRange.startDate,
      sourceBreakdown: JSON.stringify(sourceBreakdown), // Para CSV
      warnings: [],
      insights: [],
    };

    // Validar consistencia con datos mejorados
    const validation = await validateDataConsistency(url, result);
    result.warnings = validation.warnings;
    result.insights = validation.insights;

    console.log(`✅ Datos procesados para ${url}:`, {
      views: result.views,
      sessions: result.sessions,
      users: result.activeUsers,
      engagement: `${result.engagementRate}%`,
      bounce: `${result.bounce}%`,
    });

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
      newUsers: 0,
      engagedSessions: 0,
      engagementRate: 0,
      dataFound: false,
      error: error.message,
      queryDate: dateRange.startDate,
      sourceBreakdown: '{}',
      warnings: [`Error: ${error.message}`],
      insights: [],
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
        { id: 'queryDate', title: 'Fecha consulta' },
        { id: 'views', title: 'Vistas página' },
        { id: 'sessions', title: 'Sesiones' },
        { id: 'activeUsers', title: 'Usuarios activos' },
        { id: 'newUsers', title: 'Usuarios nuevos' },
        { id: 'engagedSessions', title: 'Sesiones comprometidas' },
        { id: 'engagementRate', title: 'Tasa compromiso (%)' },
        { id: 'duration', title: 'Duración prom. (s)' },
        { id: 'bounce', title: 'Tasa rebote (%)' },
        { id: 'dataFound', title: 'Datos encontrados' },
        { id: 'sourceBreakdown', title: 'Desglose por fuente' },
        { id: 'warnings', title: 'Advertencias' },
        { id: 'insights', title: 'Insights' },
      ],
    });

    const allData = [];
    const summary = {
      totalUrls: urls.length,
      successful: 0,
      withWarnings: 0,
      withInsights: 0,
      errors: 0,
    };

    for (const url of urls) {
      const data = await getGA4DataForUrl(url);

      if (data.dataFound) {
        summary.successful++;
        console.log(`✅ ${url} → ${data.views} vistas, ${data.sessions} sesiones, ${data.activeUsers} usuarios`);
      } else {
        summary.errors++;
        console.log(`❌ ${url} → Sin datos`);
      }

      if (data.warnings && data.warnings.length > 0) {
        summary.withWarnings++;
      }

      if (data.insights && data.insights.length > 0) {
        summary.withInsights++;
      }

      // Preparar datos para CSV
      const dataForCsv = {
        ...data,
        warnings: data.warnings ? data.warnings.join('; ') : '',
        insights: data.insights ? data.insights.join('; ') : '',
      };

      allData.push(dataForCsv);

      // Pausa entre consultas
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await csvWriter.writeRecords(allData);

    console.log(`\n📁 Reporte generado: ${OUTPUT_PATH}`);
    console.log(`📊 Resumen detallado:`);
    console.log(`   URLs consultadas: ${summary.totalUrls}`);
    console.log(`   Exitosas: ${summary.successful}`);
    console.log(`   Con advertencias: ${summary.withWarnings}`);
    console.log(`   Con insights: ${summary.withInsights}`);
    console.log(`   Errores: ${summary.errors}`);

    // Mostrar recomendaciones
    if (summary.withInsights > 0) {
      console.log(`\n💡 Se generaron ${summary.withInsights} insights. Revisa el CSV para optimizar tu contenido.`);
    }

    if (summary.withWarnings > 0) {
      console.log(`\n⚠️ Se detectaron ${summary.withWarnings} URLs con advertencias.`);
      console.log(`   Revisa el archivo CSV para más detalles.`);
    }

    if (summary.successful === summary.totalUrls && summary.withWarnings === 0) {
      console.log(`\n🎉 ¡Todos los datos se extrajeron correctamente sin inconsistencias!`);
      console.log(`   Los datos deberían coincidir con tu panel de GA4.`);
    }
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

main();
