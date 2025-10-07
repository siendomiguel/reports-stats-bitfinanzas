import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// === CONFIGURACIÓN ===
const CRON_SCHEDULE = '0 */6 * * *'; // Cada 6 horas (00:00, 06:00, 12:00, 18:00)
const SCRIPT_PATH = './index_final.js';
const LOG_DIR = './logs';
const MAX_LOG_FILES = 7; // Mantener últimos 7 archivos de log

// === CREAR DIRECTORIO DE LOGS ===
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// === FUNCIÓN PARA LIMPIAR LOGS ANTIGUOS ===
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

    // Eliminar archivos que excedan el límite
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

// === FUNCIÓN PARA GENERAR NOMBRE DE LOG ===
function getLogFilename() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return path.join(LOG_DIR, `ga4_report_${date}_${time}.log`);
}

// === FUNCIÓN PARA EJECUTAR EL REPORTE ===
async function runReport() {
  const startTime = new Date();
  const logFile = getLogFilename();

  console.log(`🚀 Iniciando reporte GA4 - ${startTime.toISOString()}`);
  console.log(`📝 Log guardado en: ${logFile}`);

  try {
    // Limpiar logs antiguos antes de ejecutar
    cleanOldLogs();

    // Ejecutar el script de reporte
    const { stdout, stderr } = await execPromise(`node ${SCRIPT_PATH}`);

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Preparar contenido del log
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

    // Guardar log
    fs.writeFileSync(logFile, logContent);

    console.log(`✅ Reporte completado exitosamente en ${duration}s`);
    console.log(`📊 Revisa los datos en la carpeta ./data/`);

    // Mostrar resumen en consola
    if (stdout.includes('Resumen:')) {
      const summaryStart = stdout.indexOf('📊 Resumen:');
      const summary = stdout.substring(summaryStart);
      console.log('\n' + summary);
    }
  } catch (error) {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`❌ Error ejecutando reporte (${duration}s):`, error.message);

    // Guardar log de error
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
  }
}

// === CONFIGURAR CRON JOB ===
console.log('🤖 Configurando programador automático de reportes GA4...');
console.log(`⏰ Programación: ${CRON_SCHEDULE} (cada 6 horas)`);
console.log(`📁 Script: ${SCRIPT_PATH}`);
console.log(`📝 Logs en: ${LOG_DIR}/`);

const task = cron.schedule(
  CRON_SCHEDULE,
  async () => {
    console.log('\n🔔 Ejecutando reporte programado...');
    await runReport();
  },
  {
    scheduled: true,
    timezone: process.env.GA4_TIMEZONE || 'America/Mexico_City',
  },
);

// === MANEJAR SEÑALES DEL SISTEMA ===
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo programador...');
  task.stop();
  console.log('✅ Programador detenido');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Deteniendo programador...');
  task.stop();
  process.exit(0);
});

// === MOSTRAR INFORMACIÓN INICIAL ===
console.log('\n✅ Programador configurado y activo');
console.log('\n📋 Próximas ejecuciones programadas:');

// Mostrar las próximas 5 ejecuciones
const nextExecutions = [];
const now = new Date();
for (let i = 0; i < 5; i++) {
  const next = new Date(now);
  next.setHours(Math.floor(now.getHours() / 6) * 6 + (i + 1) * 6, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  nextExecutions.push(next.toLocaleString());
}

nextExecutions.forEach((time, index) => {
  console.log(`   ${index + 1}. ${time}`);
});

console.log('\n💡 Para ejecutar un reporte manualmente ahora, usa:');
console.log('   npm run report:now');
console.log('\n🛑 Para detener el programador: Ctrl+C');
console.log('\n⏳ Esperando próxima ejecución programada...');

// === OPCIÓN PARA EJECUTAR INMEDIATAMENTE ===
if (process.argv.includes('--now')) {
  console.log('\n🚀 Ejecutando reporte inmediatamente...');
  await runReport();
}
