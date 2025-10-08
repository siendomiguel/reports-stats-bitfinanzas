import fs from 'fs';
import path from 'path';

const CONFIG_PATH = './config/urls.json';

/**
 * Asegurar que existe la configuración
 */
export function ensureConfig() {
  if (!fs.existsSync('./config')) {
    fs.mkdirSync('./config', { recursive: true });
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = {
      urls: [],
      lastUpdated: new Date().toISOString(),
      description: 'Lista de URLs para consultar en Google Analytics 4',
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
}

/**
 * Cargar configuración de URLs
 * @returns {Object} Configuración
 */
export function loadConfig() {
  ensureConfig();
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Guardar configuración de URLs
 * @param {Object} config - Configuración
 */
export function saveConfig(config) {
  config.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Normalizar URL (agregar / al inicio y final)
 * @param {string} url - URL a normalizar
 * @returns {string} URL normalizada
 */
export function normalizeUrl(url) {
  // Manejar rutas convertidas por Git Bash
  if (url.includes('C:/Program Files/Git/') || url.includes('/c/Program Files/Git/')) {
    url = url.replace(/^.*\/Git/, '');
  }

  // Asegurar que empiece con /
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  // Asegurar que termine con /
  if (!url.endsWith('/')) {
    url = url + '/';
  }

  return url;
}

/**
 * Listar todas las URLs
 * @returns {Object} Configuración completa
 */
export function listUrls() {
  return loadConfig();
}

/**
 * Agregar una nueva URL
 * @param {string} url - URL a agregar
 * @returns {Object} Resultado de la operación
 */
export function addUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return {
      success: false,
      error: 'URL inválida o vacía',
    };
  }

  const normalizedUrl = normalizeUrl(url.trim());
  const config = loadConfig();

  if (config.urls.includes(normalizedUrl)) {
    return {
      success: false,
      error: `La URL "${normalizedUrl}" ya existe`,
      url: normalizedUrl,
    };
  }

  config.urls.push(normalizedUrl);
  saveConfig(config);

  return {
    success: true,
    message: 'URL agregada correctamente',
    url: normalizedUrl,
    total: config.urls.length,
  };
}

/**
 * Eliminar una URL
 * @param {string} url - URL a eliminar o índice
 * @returns {Object} Resultado de la operación
 */
export function removeUrl(url) {
  if (!url) {
    return {
      success: false,
      error: 'Debe proporcionar una URL o índice',
    };
  }

  const config = loadConfig();
  let index = -1;
  let removedUrl = url;

  // Si es un número, usar como índice
  if (/^\d+$/.test(url)) {
    const urlIndex = parseInt(url) - 1;
    if (urlIndex >= 0 && urlIndex < config.urls.length) {
      index = urlIndex;
      removedUrl = config.urls[index];
    }
  } else {
    // Buscar por URL
    const normalizedUrl = normalizeUrl(url);
    index = config.urls.indexOf(normalizedUrl);
    removedUrl = normalizedUrl;
  }

  if (index === -1) {
    return {
      success: false,
      error: `URL "${removedUrl}" no encontrada`,
    };
  }

  config.urls.splice(index, 1);
  saveConfig(config);

  return {
    success: true,
    message: 'URL eliminada correctamente',
    url: removedUrl,
    total: config.urls.length,
  };
}

/**
 * Limpiar todas las URLs
 * @returns {Object} Resultado de la operación
 */
export function clearUrls() {
  const config = loadConfig();
  const count = config.urls.length;
  config.urls = [];
  saveConfig(config);

  return {
    success: true,
    message: `Se eliminaron ${count} URLs`,
    count: count,
  };
}

/**
 * Actualizar todas las URLs
 * @param {string[]} urls - Nuevas URLs
 * @returns {Object} Resultado de la operación
 */
export function updateUrls(urls) {
  if (!Array.isArray(urls)) {
    return {
      success: false,
      error: 'Se esperaba un array de URLs',
    };
  }

  const config = loadConfig();
  const normalizedUrls = urls.map(url => normalizeUrl(url));

  // Validar que no haya duplicados
  const uniqueUrls = [...new Set(normalizedUrls)];
  if (uniqueUrls.length !== normalizedUrls.length) {
    return {
      success: false,
      error: 'La lista contiene URLs duplicadas',
    };
  }

  config.urls = uniqueUrls;
  saveConfig(config);

  return {
    success: true,
    message: 'URLs actualizadas correctamente',
    total: config.urls.length,
  };
}
