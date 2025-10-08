#!/usr/bin/env node
import { listUrls, addUrl, removeUrl, clearUrls } from '../lib/url-manager.js';

const CONFIG_PATH = './config/urls.json';

// === COMANDOS ===
const commands = {
  list() {
    const config = listUrls();
    console.log(`\n📋 URLs configuradas (${config.urls.length}):`);
    if (config.urls.length === 0) {
      console.log('   (No hay URLs configuradas)');
    } else {
      config.urls.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
    }
    console.log(`\n🕒 Última actualización: ${config.lastUpdated}\n`);
  },

  add(url) {
    if (!url) {
      console.error('❌ Error: Debes proporcionar una URL');
      console.log('💡 Uso: npm run urls add "nueva-url"');
      return;
    }

    const result = addUrl(url);
    if (result.success) {
      console.log(`✅ ${result.message}: ${result.url}`);
      console.log(`📊 Total URLs: ${result.total}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
    }
  },

  remove(url) {
    if (!url) {
      console.error('❌ Error: Debes proporcionar una URL o índice');
      console.log('💡 Uso: npm run urls remove "/url-a-eliminar/" o npm run urls remove 3');
      return;
    }

    const result = removeUrl(url);
    if (result.success) {
      console.log(`✅ ${result.message}: ${result.url}`);
      console.log(`📊 Total URLs: ${result.total}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
    }
  },

  clear() {
    const result = clearUrls();
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log('📊 Lista de URLs limpiada');
    }
  },

  help() {
    console.log(`
📋 Gestor de URLs para GA4 Reports

💡 Comandos disponibles:
   npm run urls list              - Mostrar todas las URLs
   npm run urls add "/nueva-url/" - Agregar una nueva URL
   npm run urls remove "/url/"    - Eliminar URL por nombre
   npm run urls remove 3          - Eliminar URL por índice
   npm run urls clear             - Eliminar todas las URLs
   npm run urls help              - Mostrar esta ayuda

📝 Ejemplos:
   npm run urls add "/articulo-nuevo/"
   npm run urls remove "/articulo-viejo/"
   npm run urls remove 1

📁 Archivo de configuración: ${CONFIG_PATH}
`);
  },
};

// === PROCESAR ARGUMENTOS ===
const [, , command, ...args] = process.argv;

if (!command || !commands[command]) {
  commands.help();
} else {
  commands[command](...args);
}
