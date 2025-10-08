#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const JSON_FILE = './data/consolidated-reports.json';

/**
 * Mostrar estadísticas generales del archivo JSON
 * @param {Object} data - Datos consolidados
 */
function showGeneralStats(data) {
  console.log('\n📊 ESTADÍSTICAS GENERALES');
  console.log('═'.repeat(50));
  console.log(`📁 Total de ejecuciones: ${data.metadata.totalEjecuciones}`);
  console.log(`🔗 URLs únicas monitoreadas: ${data.metadata.totalUrls.length}`);
  console.log(`🕒 Última actualización: ${new Date(data.metadata.ultimaActualizacion).toLocaleString()}`);

  // Calcular período de monitoreo
  const ejecuciones = Object.keys(data.data).sort();
  if (ejecuciones.length > 1) {
    const primera = data.data[ejecuciones[0]].metadata.fechaEjecucion;
    const ultima = data.data[ejecuciones[ejecuciones.length - 1]].metadata.fechaEjecucion;
    console.log(`📅 Período: ${primera} a ${ultima}`);
  }
}

/**
 * Mostrar listado de ejecuciones
 * @param {Object} data - Datos consolidados
 */
function showExecutions(data) {
  console.log('\n📋 HISTORIAL DE EJECUCIONES');
  console.log('═'.repeat(50));

  const ejecuciones = Object.keys(data.data)
    .map(key => ({
      id: key,
      ...data.data[key].metadata,
    }))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  ejecuciones.forEach((ejecucion, index) => {
    const status = ejecucion.urlsExitosas === ejecucion.totalUrls ? '✅' : '⚠️';
    console.log(`${status} ${index + 1}. ${ejecucion.fechaEjecucion} ${ejecucion.horaEjecucion}`);
    console.log(`     📊 ${ejecucion.urlsConDatos}/${ejecucion.totalUrls} URLs con datos`);
  });
}

/**
 * Mostrar resumen por URL
 * @param {Object} data - Datos consolidados
 */
function showURLSummary(data) {
  console.log('\n🔗 RESUMEN POR URL');
  console.log('═'.repeat(80));

  const urlStats = {};

  // Recopilar estadísticas por URL
  Object.keys(data.data).forEach(ejecucionId => {
    const ejecucion = data.data[ejecucionId];

    Object.keys(ejecucion.urls).forEach(url => {
      const urlData = ejecucion.urls[url];

      if (!urlStats[url]) {
        urlStats[url] = {
          apariciones: 0,
          totalVistas: 0,
          totalSesiones: 0,
          totalUsuarios: 0,
          promedioCompromiso: 0,
          promedioRebote: 0,
          datosExitosos: 0,
        };
      }

      urlStats[url].apariciones++;
      urlStats[url].totalVistas += urlData.metrics.vistas;
      urlStats[url].totalSesiones += urlData.metrics.sesiones;
      urlStats[url].totalUsuarios += urlData.metrics.usuariosActivos;
      urlStats[url].promedioCompromiso += urlData.metrics.tasaCompromiso;
      urlStats[url].promedioRebote += urlData.metrics.tasaRebote;

      if (urlData.datosEncontrados) {
        urlStats[url].datosExitosos++;
      }
    });
  });

  // Mostrar estadísticas ordenadas por total de vistas
  const urlsOrdenadas = Object.keys(urlStats)
    .map(url => ({
      url,
      ...urlStats[url],
      promedioCompromiso: (urlStats[url].promedioCompromiso / urlStats[url].apariciones).toFixed(2),
      promedioRebote: (urlStats[url].promedioRebote / urlStats[url].apariciones).toFixed(2),
    }))
    .sort((a, b) => b.totalVistas - a.totalVistas);

  urlsOrdenadas.forEach((urlData, index) => {
    const success = urlData.datosExitosos === urlData.apariciones ? '✅' : '⚠️';
    console.log(`\n${success} ${index + 1}. ${urlData.url}`);
    console.log(
      `     📊 ${urlData.totalVistas} vistas | ${urlData.totalSesiones} sesiones | ${urlData.totalUsuarios} usuarios`,
    );
    console.log(`     📈 ${urlData.promedioCompromiso}% compromiso | ${urlData.promedioRebote}% rebote`);
    console.log(`     🔄 ${urlData.datosExitosos}/${urlData.apariciones} ejecuciones exitosas`);
  });
}

/**
 * Mostrar detalles de una ejecución específica
 * @param {Object} data - Datos consolidados
 * @param {string} ejecucionId - ID de la ejecución
 */
function showExecutionDetail(data, ejecucionId) {
  if (!data.data[ejecucionId]) {
    console.error(`❌ No se encontró la ejecución: ${ejecucionId}`);
    console.log(`💡 Ejecuciones disponibles: ${Object.keys(data.data).join(', ')}`);
    return;
  }

  const ejecucion = data.data[ejecucionId];

  console.log(`\n📋 DETALLE DE EJECUCIÓN: ${ejecucionId}`);
  console.log('═'.repeat(60));
  console.log(`📅 Fecha: ${ejecucion.metadata.fechaEjecucion} ${ejecucion.metadata.horaEjecucion}`);
  console.log(`📁 Archivo: ${ejecucion.metadata.archivoOriginal}`);
  console.log(`📊 URLs procesadas: ${ejecucion.metadata.totalUrls}`);
  console.log(`✅ URLs exitosas: ${ejecucion.metadata.urlsExitosas}`);
  console.log(`📈 URLs con datos: ${ejecucion.metadata.urlsConDatos}`);

  console.log('\n🔗 URLs en esta ejecución:');
  Object.keys(ejecucion.urls).forEach((url, index) => {
    const urlData = ejecucion.urls[url];
    const status = urlData.datosEncontrados ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${url}`);

    if (urlData.datosEncontrados) {
      console.log(
        `     📊 ${urlData.metrics.vistas} vistas | ${urlData.metrics.sesiones} sesiones | ${urlData.metrics.usuariosActivos} usuarios`,
      );
      console.log(`     📈 ${urlData.metrics.tasaCompromiso}% compromiso | ${urlData.metrics.tasaRebote}% rebote`);
    } else {
      console.log(`     ⚠️ Sin datos`);
    }
  });
}

/**
 * Función principal
 */
function main() {
  const [, , command, param] = process.argv;

  // Verificar que existe el archivo JSON
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ No se encontró el archivo: ${JSON_FILE}`);
    console.log(`💡 Ejecuta primero: npm run consolidate`);
    return;
  }

  // Cargar datos
  let data;
  try {
    data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  } catch (error) {
    console.error(`❌ Error leyendo archivo JSON: ${error.message}`);
    return;
  }

  // Procesar comando
  switch (command) {
    case 'stats':
      showGeneralStats(data);
      break;

    case 'executions':
      showExecutions(data);
      break;

    case 'urls':
      showURLSummary(data);
      break;

    case 'detail':
      if (!param) {
        console.error('❌ Debes especificar el ID de la ejecución');
        console.log('💡 Uso: npm run json detail 2025-10-07_19-35');
        return;
      }
      showExecutionDetail(data, param);
      break;

    case 'all':
      showGeneralStats(data);
      showExecutions(data);
      showURLSummary(data);
      break;

    default:
      console.log(`
📊 Visualizador de datos consolidados GA4

💡 Comandos disponibles:
   npm run json stats       - Estadísticas generales
   npm run json executions  - Historial de ejecuciones  
   npm run json urls        - Resumen por URL
   npm run json detail ID   - Detalle de una ejecución
   npm run json all         - Mostrar todo

📝 Ejemplos:
   npm run json stats
   npm run json detail 2025-10-07_19-35
   npm run json all

📁 Archivo: ${JSON_FILE}
      `);
  }
}

main();
