import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// === CONFIGURACIÓN ===
const app = express();
const PORT = process.env.PORT || 3000;
const JSON_FILE = './data/consolidated-reports.json';
const URLS_CONFIG_FILE = './config/urls.json';

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());
app.use(express.static('./server/public'));

// Middleware para verificar que existe el archivo JSON
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

// Función para cargar datos
function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    return data;
  } catch (error) {
    throw new Error(`Error cargando datos: ${error.message}`);
  }
}

// === ENDPOINTS ===

// Página principal con documentación
app.get('/', (req, res) => {
  res.json({
    title: '📊 API de Reportes GA4',
    version: '1.0.0',
    description: 'API para acceder a los datos consolidados de Google Analytics 4',
    endpoints: {
      '/api/stats': 'Estadísticas generales',
      '/api/executions': 'Historial de ejecuciones',
      '/api/urls': 'Resumen por URLs',
      '/api/execution/:id': 'Detalle de una ejecución específica',
      '/api/url/:urlPath': 'Datos de una URL específica',
      '/api/raw': 'Datos completos en JSON',
      '/api/health': 'Estado de la API',
      '/api/config/urls [GET]': 'Obtener lista de URLs configuradas',
      '/api/config/urls [POST]': 'Agregar nueva URL (body: { url: string })',
      '/api/config/urls [DELETE]': 'Eliminar URL (body: { url: string })',
    },
    examples: {
      stats: `${req.protocol}://${req.get('host')}/api/stats`,
      execution: `${req.protocol}://${req.get('host')}/api/execution/2025-10-07_20-10`,
      url: `${req.protocol}://${req.get('host')}/api/url/radar-economico-divisas`,
      raw: `${req.protocol}://${req.get('host')}/api/raw`,
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

// Estadísticas generales
app.get('/api/stats', checkJSONFile, (req, res) => {
  try {
    const data = loadData();

    // Calcular período
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

    // Calcular promedios y ordenar
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

    // Buscar URL (puede ser parcial)
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

    // Si hay múltiples coincidencias, usar la primera o la exacta
    const targetUrl = matchingUrls.find(url => url === `/${urlPath}/`) || matchingUrls[0];

    // Recopilar datos de todas las ejecuciones para esta URL
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

// === ENDPOINTS DE CONFIGURACIÓN ===

// Obtener lista de URLs configuradas
app.get('/api/config/urls', (req, res) => {
  try {
    if (!fs.existsSync(URLS_CONFIG_FILE)) {
      return res.status(404).json({
        error: 'Archivo de configuración no encontrado',
        file: URLS_CONFIG_FILE,
      });
    }
    const config = JSON.parse(fs.readFileSync(URLS_CONFIG_FILE, 'utf8'));
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar nueva URL a la configuración
app.post('/api/config/urls', (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL inválida',
        message: 'Se requiere el campo "url" como string',
      });
    }

    // Normalizar URL (asegurar que empiece y termine con /)
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('/')) {
      normalizedUrl = '/' + normalizedUrl;
    }
    if (!normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl + '/';
    }

    // Leer configuración actual
    let config = { urls: [], lastUpdated: new Date().toISOString(), description: 'Lista de URLs para consultar en Google Analytics 4' };
    if (fs.existsSync(URLS_CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(URLS_CONFIG_FILE, 'utf8'));
    }

    // Verificar si la URL ya existe
    if (config.urls.includes(normalizedUrl)) {
      return res.status(409).json({
        error: 'URL duplicada',
        message: 'Esta URL ya existe en la configuración',
        url: normalizedUrl,
      });
    }

    // Agregar nueva URL
    config.urls.push(normalizedUrl);
    config.lastUpdated = new Date().toISOString();

    // Guardar configuración
    fs.writeFileSync(URLS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

    res.status(201).json({
      success: true,
      message: 'URL agregada exitosamente',
      url: normalizedUrl,
      total: config.urls.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar URL de la configuración
app.delete('/api/config/urls', (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL inválida',
        message: 'Se requiere el campo "url" como string',
      });
    }

    if (!fs.existsSync(URLS_CONFIG_FILE)) {
      return res.status(404).json({
        error: 'Archivo de configuración no encontrado',
        file: URLS_CONFIG_FILE,
      });
    }

    // Leer configuración actual
    const config = JSON.parse(fs.readFileSync(URLS_CONFIG_FILE, 'utf8'));

    // Buscar y eliminar URL
    const index = config.urls.indexOf(url);
    if (index === -1) {
      return res.status(404).json({
        error: 'URL no encontrada',
        url: url,
        available: config.urls,
      });
    }

    config.urls.splice(index, 1);
    config.lastUpdated = new Date().toISOString();

    // Guardar configuración
    fs.writeFileSync(URLS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

    res.json({
      success: true,
      message: 'URL eliminada exitosamente',
      url: url,
      total: config.urls.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      '/api/config/urls [GET, POST, DELETE]',
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

// === INICIAR SERVIDOR ===
app.listen(PORT, () => {
  console.log(`🚀 Servidor API iniciado en http://localhost:${PORT}`);
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   http://localhost:${PORT}/api/stats`);
  console.log(`   http://localhost:${PORT}/api/urls`);
  console.log(`   http://localhost:${PORT}/api/executions`);
  console.log(`   http://localhost:${PORT}/api/raw`);
  console.log(`\n💡 Documentación completa: http://localhost:${PORT}`);
});

export default app;
