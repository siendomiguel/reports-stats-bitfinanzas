import express from 'express';
import cors from 'cors';
import fs from 'fs';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { listUrls, addUrl, removeUrl, clearUrls, updateUrls } from './lib/url-manager.js';

const execPromise = promisify(exec);

// === CONFIGURACIÓN ===
const PORT = process.env.PORT || 3000;
const JSON_FILE = './data/consolidated-reports.json';
const CRON_SCHEDULE = '0 */6 * * *'; // Cada 6 horas
const SCRIPT_PATH = './index_final.js';
const LOG_DIR = './logs';
const MAX_LOG_FILES = 7;

// === CREAR DIRECTORIOS ===
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// === EXPRESS APP ===
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('./server/public'));

// === FUNCIONES DEL SCHEDULER ===
function cleanOldLogs() {
  try {
    const files = fs
      .readdirSync(LOG_DIR)
      .filter(file => file.startsWith('ga4_report_') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(LOG_DIR, file),
        time: fs.statSync(path.join(LOG_DIR, file)).mtime,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_LOG_FILES) {
      const filesToDelete = files.slice(MAX_LOG_FILES);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Eliminado log antiguo: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('Error limpiando logs:', error);
  }
}

function getLogFilename() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return path.join(LOG_DIR, `ga4_report_${date}_${time}.log`);
}

async function runReport() {
  const startTime = new Date();
  const logFile = getLogFilename();

  console.log(`🚀 Iniciando reporte GA4 - ${startTime.toISOString()}`);
  console.log(`📝 Log guardado en: ${logFile}`);

  try {
    cleanOldLogs();

    const { stdout, stderr } = await execPromise(`node ${SCRIPT_PATH}`);

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const logContent = [
      `=== REPORTE GA4 - ${startTime.toISOString()} ===`,
      `Duración: ${duration} segundos`,
      '',
      '=== SALIDA ESTÁNDAR ===',
      stdout,
      '',
      '=== ERRORES (SI LOS HAY) ===',
      stderr || 'Sin errores',
      '',
      `=== FINALIZADO - ${endTime.toISOString()} ===`,
      '',
    ].join('\n');

    fs.writeFileSync(logFile, logContent);

    console.log(`✅ Reporte completado exitosamente en ${duration}s`);
    console.log(`📊 Revisa los datos en la carpeta ./data/`);

    if (stdout.includes('Resumen:')) {
      const summaryStart = stdout.indexOf('📊 Resumen:');
      const summary = stdout.substring(summaryStart);
      console.log('\n' + summary);
    }

    return { success: true, duration, logFile };
  } catch (error) {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`❌ Error ejecutando reporte (${duration}s):`, error.message);

    const errorLog = [
      `=== ERROR EN REPORTE GA4 - ${startTime.toISOString()} ===`,
      `Duración: ${duration} segundos`,
      '',
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack || 'No disponible',
      '',
      `=== FINALIZADO CON ERROR - ${endTime.toISOString()} ===`,
      '',
    ].join('\n');

    fs.writeFileSync(logFile, errorLog);

    return { success: false, error: error.message, duration, logFile };
  }
}

// === MIDDLEWARE DE LA API ===
function checkJSONFile(req, res, next) {
  if (!fs.existsSync(JSON_FILE)) {
    return res.status(404).json({
      error: 'Archivo de datos no encontrado',
      message: 'Ejecuta primero: npm run report o npm run consolidate',
      file: JSON_FILE,
    });
  }
  next();
}

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    return data;
  } catch (error) {
    throw new Error(`Error cargando datos: ${error.message}`);
  }
}

// === ENDPOINTS DE LA API ===

app.get('/', (req, res) => {
  res.json({
    title: '📊 API de Reportes GA4 - Sistema Completo',
    version: '2.0.0',
    description: 'API REST + Scheduler automático cada 6 horas',
    status: {
      api: 'running',
      scheduler: cronTask ? 'active' : 'inactive',
      nextExecution: getNextExecutionTime(),
    },
    endpoints: {
      '/api/stats': 'Estadísticas generales',
      '/api/executions': 'Historial de ejecuciones',
      '/api/urls': 'Resumen por URLs',
      '/api/execution/:id': 'Detalle de una ejecución específica',
      '/api/url/:urlPath': 'Datos de una URL específica',
      '/api/raw': 'Datos completos en JSON',
      '/api/health': 'Estado de la API',
      '/api/trigger-report': 'Ejecutar reporte manualmente (POST)',
      '/api/config/urls': 'Gestión de URLs (GET, POST, PUT, DELETE)',
    },
    scheduler: {
      schedule: CRON_SCHEDULE,
      description: 'Ejecuta reportes cada 6 horas (00:00, 06:00, 12:00, 18:00)',
      timezone: process.env.GA4_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
});

// Estado de la API
app.get('/api/health', checkJSONFile, (req, res) => {
  try {
    const data = loadData();
    const stats = fs.statSync(JSON_FILE);

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      scheduler: {
        active: cronTask ? true : false,
        nextExecution: getNextExecutionTime(),
        schedule: CRON_SCHEDULE,
      },
      dataFile: {
        path: JSON_FILE,
        size: `${(stats.size / 1024).toFixed(2)} KB`,
        lastModified: stats.mtime,
        executions: data.metadata.totalEjecuciones,
        urls: data.metadata.totalUrls.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual de reporte
app.post('/api/trigger-report', async (req, res) => {
  console.log('🔔 Reporte manual solicitado vía API');

  try {
    const result = await runReport();
    res.json({
      message: 'Reporte ejecutado',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error ejecutando reporte',
      message: error.message,
    });
  }
});

// Estadísticas generales
app.get('/api/stats', checkJSONFile, (req, res) => {
  try {
    const data = loadData();

    const ejecuciones = Object.keys(data.data).sort();
    let periodo = null;
    if (ejecuciones.length > 1) {
      const primera = data.data[ejecuciones[0]].metadata.fechaEjecucion;
      const ultima = data.data[ejecuciones[ejecuciones.length - 1]].metadata.fechaEjecucion;
      periodo = { desde: primera, hasta: ultima };
    }

    res.json({
      totalEjecuciones: data.metadata.totalEjecuciones,
      urlsUnicas: data.metadata.totalUrls.length,
      ultimaActualizacion: data.metadata.ultimaActualizacion,
      periodo,
      urls: data.metadata.totalUrls,
      archivosOriginales: data.metadata.archivosOriginales.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historial de ejecuciones
app.get('/api/executions', checkJSONFile, (req, res) => {
  try {
    const data = loadData();

    const ejecuciones = Object.keys(data.data)
      .map(key => ({
        id: key,
        ...data.data[key].metadata,
        urlsProcessed: Object.keys(data.data[key].urls).length,
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      total: ejecuciones.length,
      executions: ejecuciones,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resumen por URLs
app.get('/api/urls', checkJSONFile, (req, res) => {
  try {
    const data = loadData();
    const urlStats = {};

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
            ejecuciones: [],
          };
        }

        urlStats[url].apariciones++;
        urlStats[url].totalVistas += urlData.metrics.vistas;
        urlStats[url].totalSesiones += urlData.metrics.sesiones;
        urlStats[url].totalUsuarios += urlData.metrics.usuariosActivos;
        urlStats[url].promedioCompromiso += urlData.metrics.tasaCompromiso;
        urlStats[url].promedioRebote += urlData.metrics.tasaRebote;
        urlStats[url].ejecuciones.push({
          id: ejecucionId,
          fecha: ejecucion.metadata.fechaEjecucion,
          vistas: urlData.metrics.vistas,
          sesiones: urlData.metrics.sesiones,
          usuarios: urlData.metrics.usuariosActivos,
        });

        if (urlData.datosEncontrados) {
          urlStats[url].datosExitosos++;
        }
      });
    });

    const urlsOrdenadas = Object.keys(urlStats)
      .map(url => ({
        url,
        ...urlStats[url],
        promedioCompromiso: Number((urlStats[url].promedioCompromiso / urlStats[url].apariciones).toFixed(2)),
        promedioRebote: Number((urlStats[url].promedioRebote / urlStats[url].apariciones).toFixed(2)),
        tasaExito: Number(((urlStats[url].datosExitosos / urlStats[url].apariciones) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.totalVistas - a.totalVistas);

    res.json({
      total: urlsOrdenadas.length,
      urls: urlsOrdenadas,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detalle de una ejecución específica
app.get('/api/execution/:id', checkJSONFile, (req, res) => {
  try {
    const data = loadData();
    const executionId = req.params.id;

    if (!data.data[executionId]) {
      return res.status(404).json({
        error: 'Ejecución no encontrada',
        id: executionId,
        available: Object.keys(data.data),
      });
    }

    const execution = data.data[executionId];
    res.json({
      id: executionId,
      metadata: execution.metadata,
      urls: execution.urls,
      summary: {
        totalUrls: Object.keys(execution.urls).length,
        urlsConDatos: Object.values(execution.urls).filter(url => url.datosEncontrados).length,
        totalVistas: Object.values(execution.urls).reduce((sum, url) => sum + url.metrics.vistas, 0),
        totalSesiones: Object.values(execution.urls).reduce((sum, url) => sum + url.metrics.sesiones, 0),
        totalUsuarios: Object.values(execution.urls).reduce((sum, url) => sum + url.metrics.usuariosActivos, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Datos de una URL específica
app.get('/api/url/:urlPath', checkJSONFile, (req, res) => {
  try {
    const data = loadData();
    const urlPath = decodeURIComponent(req.params.urlPath);

    const matchingUrls = data.metadata.totalUrls.filter(
      url => url.toLowerCase().includes(urlPath.toLowerCase()) || urlPath.toLowerCase().includes(url.toLowerCase()),
    );

    if (matchingUrls.length === 0) {
      return res.status(404).json({
        error: 'URL no encontrada',
        searchTerm: urlPath,
        availableUrls: data.metadata.totalUrls,
      });
    }

    const targetUrl = matchingUrls.find(url => url === `/${urlPath}/`) || matchingUrls[0];

    const urlHistory = [];
    Object.keys(data.data).forEach(ejecucionId => {
      const ejecucion = data.data[ejecucionId];
      if (ejecucion.urls[targetUrl]) {
        urlHistory.push({
          ejecucionId,
          fecha: ejecucion.metadata.fechaEjecucion,
          hora: ejecucion.metadata.horaEjecucion,
          timestamp: ejecucion.metadata.timestamp,
          ...ejecucion.urls[targetUrl],
        });
      }
    });

    res.json({
      url: targetUrl,
      totalEjecuciones: urlHistory.length,
      history: urlHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      summary: {
        totalVistas: urlHistory.reduce((sum, h) => sum + h.metrics.vistas, 0),
        totalSesiones: urlHistory.reduce((sum, h) => sum + h.metrics.sesiones, 0),
        totalUsuarios: urlHistory.reduce((sum, h) => sum + h.metrics.usuariosActivos, 0),
        promedioCompromiso: (
          urlHistory.reduce((sum, h) => sum + h.metrics.tasaCompromiso, 0) / urlHistory.length
        ).toFixed(2),
        promedioRebote: (urlHistory.reduce((sum, h) => sum + h.metrics.tasaRebote, 0) / urlHistory.length).toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Datos completos en JSON
app.get('/api/raw', checkJSONFile, (req, res) => {
  try {
    const data = loadData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ENDPOINTS DE GESTIÓN DE URLs ===

// Listar todas las URLs configuradas
app.get('/api/config/urls', (req, res) => {
  try {
    const config = listUrls();
    res.json({
      success: true,
      urls: config.urls,
      total: config.urls.length,
      lastUpdated: config.lastUpdated,
      description: config.description,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Agregar una nueva URL
app.post('/api/config/urls', (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'El campo "url" es requerido',
      });
    }

    const result = addUrl(url);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Eliminar una URL específica (enviada en el body)
app.delete('/api/config/urls', (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'El campo "url" es requerido para eliminar',
      });
    }

    const result = removeUrl(url);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Reemplazar completamente la lista de URLs
app.put('/api/config/urls', (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: 'El campo "urls" debe ser un array',
      });
    }

    const result = updateUrls(urls);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// === MANEJO DE ERRORES ===
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    available: [
      '/api/stats',
      '/api/executions',
      '/api/urls',
      '/api/execution/:id',
      '/api/url/:urlPath',
      '/api/raw',
      '/api/health',
      '/api/trigger-report (POST)',
      '/api/config/urls (GET, POST, PUT, DELETE)',
    ],
  });
});

app.use((error, req, res, next) => {
  console.error('Error del servidor:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: error.message,
  });
});

// === FUNCIONES DEL SCHEDULER ===
function getNextExecutionTime() {
  const now = new Date();
  const scheduleHours = [0, 6, 12, 18];
  const currentHour = now.getHours();

  for (const hour of scheduleHours) {
    if (hour > currentHour) {
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);
      return next.toISOString();
    }
  }

  // Si no hay más horas hoy, próxima es mañana a las 00:00
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

// === CONFIGURAR CRON JOB ===
const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timezone = process.env.GA4_TIMEZONE || systemTimezone;

console.log('🤖 Configurando scheduler automático integrado...');
console.log(`⏰ Programación: ${CRON_SCHEDULE} (cada 6 horas)`);
console.log(`🌍 Zona horaria: ${timezone}`);

let cronTask = null;

try {
  cronTask = cron.schedule(
    CRON_SCHEDULE,
    async () => {
      console.log('\n🔔 Ejecutando reporte programado...');
      await runReport();
    },
    {
      scheduled: true,
      timezone: timezone,
    },
  );

  console.log('✅ Scheduler configurado correctamente');
  console.log(`📅 Próxima ejecución: ${getNextExecutionTime()}`);
} catch (error) {
  console.error('❌ Error configurando scheduler:', error.message);
  console.log('⚠️ El servidor API funcionará sin scheduler automático');
}

// === OPCIÓN PARA EJECUTAR REPORTE AL INICIAR ===
if (process.argv.includes('--run-now')) {
  console.log('\n🚀 Ejecutando reporte inicial al arrancar el servidor...');
  runReport().then(() => {
    console.log('\n⏳ Servidor listo y esperando próxima ejecución programada...');
  });
}

// === INICIAR SERVIDOR ===
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor GA4 completo iniciado en http://localhost:${PORT}`);
  console.log(`📊 Dashboard disponible en: http://localhost:${PORT}`);
  console.log(`📡 API REST disponible en: http://localhost:${PORT}/api/`);
  console.log(`⏰ Scheduler: ${cronTask ? 'Activo' : 'Inactivo'}`);
  console.log(`\n💡 Comandos disponibles:`);
  console.log(`   npm start              - Iniciar servidor completo`);
  console.log(`   npm start -- --run-now - Iniciar + ejecutar reporte inmediato`);
  console.log(`\n🛑 Para detener: Ctrl+C`);
});

// === MANEJAR SEÑALES DEL SISTEMA ===
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo servidor y scheduler...');
  if (cronTask) cronTask.stop();
  server.close(() => {
    console.log('✅ Servidor detenido correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Deteniendo servidor y scheduler...');
  if (cronTask) cronTask.stop();
  server.close(() => {
    process.exit(0);
  });
});

export default app;
