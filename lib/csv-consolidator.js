import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

// === CONFIGURACIÓN ===
const DATA_DIR = './data';
const OUTPUT_JSON = './data/consolidated-reports.json';

/**
 * Cargar JSON consolidado existente o crear estructura base
 * @returns {Object} - Datos consolidados existentes
 */
function loadExistingJSON() {
  try {
    if (fs.existsSync(OUTPUT_JSON)) {
      const data = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
      console.log(`📂 JSON existente cargado: ${Object.keys(data.data).length} ejecuciones`);
      return data;
    }
  } catch (error) {
    console.warn(`⚠️ Error cargando JSON existente: ${error.message}`);
  }

  // Crear estructura base si no existe
  console.log('🆕 Creando nueva estructura JSON');
  return {
    data: {},
    metadata: {
      totalEjecuciones: 0,
      totalUrls: [],
      ultimaActualizacion: new Date().toISOString(),
      archivosOriginales: [],
    },
  };
}

/**
 * Agregar nueva ejecución al JSON existente (incremental)
 * @param {Object} existingData - Datos consolidados existentes
 * @param {string} csvFilePath - Ruta del nuevo archivo CSV
 * @returns {Promise<Object>} - Datos actualizados
 */
async function addNewExecutionToJSON(existingData, csvFilePath) {
  try {
    const filename = path.basename(csvFilePath);
    const dateTimeInfo = extractDateTimeFromFilename(filename);
    const ejecucionId = dateTimeInfo.ejecucionId;

    // Verificar si ya existe esta ejecución
    if (existingData.data[ejecucionId]) {
      console.log(`⚠️ Ejecución ${ejecucionId} ya existe, actualizando...`);
    } else {
      console.log(`✨ Agregando nueva ejecución: ${ejecucionId}`);
    }

    // Leer y procesar solo el nuevo CSV
    const csvData = await readCSVFile(csvFilePath);

    // Crear entrada para esta ejecución
    existingData.data[ejecucionId] = {
      metadata: {
        fechaEjecucion: dateTimeInfo.fecha,
        horaEjecucion: dateTimeInfo.hora,
        timestamp: dateTimeInfo.timestamp,
        archivoOriginal: filename,
        totalUrls: csvData.length,
        urlsExitosas: csvData.filter(item => item.datosEncontrados).length,
        urlsConDatos: csvData.filter(item => item.metrics.vistas > 0).length,
      },
      urls: {},
    };

    // Agregar datos de cada URL
    const urlsSet = new Set(existingData.metadata.totalUrls);
    csvData.forEach(item => {
      existingData.data[ejecucionId].urls[item.url] = {
        ...item,
        url: undefined,
        fechaConsulta: undefined,
      };

      // Limpiar objeto
      delete existingData.data[ejecucionId].urls[item.url].url;
      delete existingData.data[ejecucionId].urls[item.url].fechaConsulta;

      // Trackear URLs únicas
      urlsSet.add(item.url);
    });

    // Actualizar metadata
    existingData.metadata.totalEjecuciones = Object.keys(existingData.data).length;
    existingData.metadata.totalUrls = Array.from(urlsSet);
    existingData.metadata.ultimaActualizacion = new Date().toISOString();

    // Actualizar o agregar archivo en la lista
    const existingFileIndex = existingData.metadata.archivosOriginales.findIndex(
      file => file.ejecucionId === ejecucionId,
    );

    const fileInfo = {
      archivo: filename,
      ejecucionId: ejecucionId,
      fecha: dateTimeInfo.fecha,
      hora: dateTimeInfo.hora,
      registros: csvData.length,
    };

    if (existingFileIndex >= 0) {
      existingData.metadata.archivosOriginales[existingFileIndex] = fileInfo;
    } else {
      existingData.metadata.archivosOriginales.push(fileInfo);
    }

    console.log(`✅ Ejecución ${ejecucionId} agregada/actualizada`);
    console.log(`   📊 ${csvData.length} URLs procesadas`);
    console.log(`   🔗 ${existingData.metadata.totalUrls.length} URLs únicas total`);

    return existingData;
  } catch (error) {
    console.error(`❌ Error agregando ejecución: ${error.message}`);
    throw error;
  }
}

/**
 * Parsear una línea CSV y convertir a objeto estructurado
 * @param {Object} row - Fila del CSV
 * @returns {Object} - Objeto estructurado con los datos
 */
function parseCSVRow(row) {
  // Parsear el desglose por fuente (es un JSON dentro del CSV)
  let desgloseJson = {};
  try {
    if (row['Desglose por fuente']) {
      desgloseJson = JSON.parse(row['Desglose por fuente']);
    }
  } catch (error) {
    console.warn(`⚠️ Error parseando desglose para ${row.URL}:`, error.message);
  }

  return {
    url: row.URL,
    fechaConsulta: row['Fecha consulta'],
    metrics: {
      vistas: parseInt(row['Vistas página']) || 0,
      sesiones: parseInt(row['Sesiones']) || 0,
      usuariosActivos: parseInt(row['Usuarios activos']) || 0,
      usuariosNuevos: parseInt(row['Usuarios nuevos']) || 0,
      sesionesComprometidas: parseInt(row['Sesiones comprometidas']) || 0,
      tasaCompromiso: parseFloat(row['Tasa compromiso (%)']) || 0,
      duracionPromedio: parseFloat(row['Duración prom. (s)']) || 0,
      tasaRebote: parseFloat(row['Tasa rebote (%)']) || 0,
    },
    datosEncontrados: row['Datos encontrados'] === 'true',
    desgloseTrafico: desgloseJson,
    advertencias: row['Advertencias'] || null,
    insights: row['Insights'] || null,
    timestamp: new Date().toISOString(), // Cuando se procesó este registro
  };
}

/**
 * Leer un archivo CSV y convertirlo a array de objetos
 * @param {string} filePath - Ruta del archivo CSV
 * @returns {Promise<Array>} - Array de objetos parseados
 */
function readCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    createReadStream(filePath)
      .pipe(
        parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
          quote: '"',
          escape: '"',
        }),
      )
      .on('data', row => {
        try {
          const parsedRow = parseCSVRow(row);
          results.push(parsedRow);
        } catch (error) {
          console.warn(`⚠️ Error procesando fila en ${filePath}:`, error.message);
        }
      })
      .on('end', () => {
        console.log(`📄 Procesado: ${path.basename(filePath)} (${results.length} registros)`);
        resolve(results);
      })
      .on('error', error => {
        console.error(`❌ Error leyendo ${filePath}:`, error.message);
        reject(error);
      });
  });
}

/**
 * Extraer información de fecha y hora del nombre del archivo
 * @param {string} filename - Nombre del archivo (ej: report_2025-10-07_19-35.csv)
 * @returns {Object} - Objeto con fecha, hora y timestamp
 */
function extractDateTimeFromFilename(filename) {
  const match = filename.match(/report_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})\.csv/);

  if (!match) {
    console.warn(`⚠️ No se pudo extraer fecha/hora de: ${filename}`);
    return {
      fecha: 'unknown',
      hora: 'unknown',
      timestamp: new Date().toISOString(),
      ejecucionId: filename.replace('.csv', ''),
    };
  }

  const [, fecha, horas, minutos] = match;
  const timestamp = new Date(`${fecha}T${horas}:${minutos}:00`).toISOString();

  return {
    fecha,
    hora: `${horas}:${minutos}`,
    timestamp,
    ejecucionId: `${fecha}_${horas}-${minutos}`,
  };
}

/**
 * Consolidar todos los archivos CSV en un JSON unificado
 * @returns {Promise<Object>} - Objeto consolidado
 */
export async function consolidateCSVToJSON() {
  try {
    console.log('🔄 Iniciando consolidación de archivos CSV...');

    // Obtener todos los archivos CSV
    const files = fs
      .readdirSync(DATA_DIR)
      .filter(file => file.endsWith('.csv') && file.startsWith('report_'))
      .sort(); // Ordenar por fecha

    if (files.length === 0) {
      console.log('⚠️ No se encontraron archivos CSV para consolidar');
      return { data: {}, metadata: { totalEjecuciones: 0, ultimaActualizacion: new Date().toISOString() } };
    }

    console.log(`📊 Encontrados ${files.length} archivos CSV`);

    // Estructura del JSON consolidado
    const consolidatedData = {
      data: {},
      metadata: {
        totalEjecuciones: 0,
        totalUrls: new Set(),
        ultimaActualizacion: new Date().toISOString(),
        archivosOriginales: [],
      },
    };

    // Procesar cada archivo CSV
    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const dateTimeInfo = extractDateTimeFromFilename(file);

      try {
        const csvData = await readCSVFile(filePath);

        // Crear entrada para esta ejecución
        const ejecucionId = dateTimeInfo.ejecucionId;
        consolidatedData.data[ejecucionId] = {
          metadata: {
            fechaEjecucion: dateTimeInfo.fecha,
            horaEjecucion: dateTimeInfo.hora,
            timestamp: dateTimeInfo.timestamp,
            archivoOriginal: file,
            totalUrls: csvData.length,
            urlsExitosas: csvData.filter(item => item.datosEncontrados).length,
            urlsConDatos: csvData.filter(item => item.metrics.vistas > 0).length,
          },
          urls: {},
        };

        // Agregar datos de cada URL
        csvData.forEach(item => {
          consolidatedData.data[ejecucionId].urls[item.url] = {
            ...item,
            // Remover campos duplicados
            url: undefined,
            fechaConsulta: undefined,
          };

          // Limpiar objeto
          delete consolidatedData.data[ejecucionId].urls[item.url].url;
          delete consolidatedData.data[ejecucionId].urls[item.url].fechaConsulta;

          // Trackear URLs únicas
          consolidatedData.metadata.totalUrls.add(item.url);
        });

        consolidatedData.metadata.archivosOriginales.push({
          archivo: file,
          ejecucionId: ejecucionId,
          fecha: dateTimeInfo.fecha,
          hora: dateTimeInfo.hora,
          registros: csvData.length,
        });
      } catch (error) {
        console.error(`❌ Error procesando ${file}:`, error.message);
      }
    }

    // Finalizar metadata
    consolidatedData.metadata.totalEjecuciones = Object.keys(consolidatedData.data).length;
    const uniqueUrls = Array.from(consolidatedData.metadata.totalUrls);
    consolidatedData.metadata.totalUrls = uniqueUrls;

    console.log(`✅ Consolidación completada:`);
    console.log(`   📊 ${consolidatedData.metadata.totalEjecuciones} ejecuciones procesadas`);
    console.log(`   🔗 ${consolidatedData.metadata.totalUrls.length} URLs únicas`);
    console.log(`   📁 Archivo generado: ${OUTPUT_JSON}`);

    return consolidatedData;
  } catch (error) {
    console.error('❌ Error en consolidación:', error.message);
    throw error;
  }
}

/**
 * Consolidación INCREMENTAL - Solo agrega el nuevo CSV al JSON existente
 * @param {string} newCSVPath - Ruta del nuevo archivo CSV a agregar
 * @returns {Promise<Object>} - Datos consolidados actualizados
 */
export async function addToConsolidatedJSON(newCSVPath) {
  try {
    console.log(`🔄 Agregando ${path.basename(newCSVPath)} al JSON consolidado...`);

    // Verificar que el archivo CSV existe
    if (!fs.existsSync(newCSVPath)) {
      throw new Error(`Archivo CSV no encontrado: ${newCSVPath}`);
    }

    // Cargar JSON existente o crear nuevo
    const existingData = loadExistingJSON();

    // Agregar solo la nueva ejecución
    const updatedData = await addNewExecutionToJSON(existingData, newCSVPath);

    // Guardar JSON actualizado
    await saveConsolidatedJSON(updatedData);

    console.log(`✅ JSON consolidado actualizado incrementalmente`);
    console.log(`   📊 Total ejecuciones: ${updatedData.metadata.totalEjecuciones}`);
    console.log(`   🔗 URLs únicas: ${updatedData.metadata.totalUrls.length}`);
    console.log(`   💾 Archivo: ${OUTPUT_JSON}`);

    return updatedData;
  } catch (error) {
    console.error('❌ Error en consolidación incremental:', error.message);
    throw error;
  }
}

/**
 * Guardar datos consolidados en archivo JSON
 * @param {Object} data - Datos consolidados
 * @param {string} outputPath - Ruta del archivo de salida (opcional)
 */
export async function saveConsolidatedJSON(data, outputPath = OUTPUT_JSON) {
  try {
    // Crear directorio de salida si no existe
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Guardar archivo
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    console.log(`💾 Archivo JSON guardado: ${outputPath}`);
    console.log(`📏 Tamaño del archivo: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error guardando JSON:', error.message);
    throw error;
  }
}

/**
 * Función principal para consolidación COMPLETA (todos los CSV)
 */
export async function runConsolidation() {
  try {
    console.log('🚀 Iniciando proceso de consolidación COMPLETA CSV → JSON\n');

    const consolidatedData = await consolidateCSVToJSON();
    await saveConsolidatedJSON(consolidatedData);

    console.log('\n🎉 ¡Consolidación completada exitosamente!');
    console.log(`📁 Archivo disponible en: ${OUTPUT_JSON}`);

    return consolidatedData;
  } catch (error) {
    console.error('\n❌ Error en el proceso de consolidación:', error.message);
    throw error;
  }
}

/**
 * Función principal para consolidación INCREMENTAL (un CSV específico)
 * @param {string} csvPath - Ruta del archivo CSV específico
 */
export async function runIncrementalConsolidation(csvPath) {
  try {
    console.log('⚡ Iniciando consolidación INCREMENTAL\n');

    const updatedData = await addToConsolidatedJSON(csvPath);

    console.log('\n🎉 ¡Consolidación incremental completada!');
    console.log(`📁 Archivo actualizado: ${OUTPUT_JSON}`);

    return updatedData;
  } catch (error) {
    console.error('\n❌ Error en consolidación incremental:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runConsolidation();
}
