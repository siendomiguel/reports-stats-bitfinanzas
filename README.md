# 📊 Sistema de Reportes GA4 Automatizado

Sistema completo para extraer datos de Google Analytics 4, ejecutar reportes programados, consolidar datos en JSON y visualizarlos mediante API REST y dashboard web.

## 🚀 Características Principales

- ✅ **Reportes automáticos** cada 6 horas
- ✅ **Consolidación incremental** CSV → JSON (rendimiento optimizado)
- ✅ **API REST** para acceso a datos
- ✅ **Dashboard web** con visualización en tiempo real
- ✅ **Gestión dinámica de URLs** (JSON local o Google Sheets)
- ✅ **Validación de datos** y detección de inconsistencias
- ✅ **Logs con rotación automática**

## 📁 Estructura del Proyecto

```
reports/
├── index_final.js           # Script principal de reportes
├── scheduler.js             # Programador automático (cada 6h)
├── server/
│   ├── api.js              # API REST
│   └── public/
│       └── index.html      # Dashboard web
├── lib/
│   ├── csv-consolidator.js # Consolidación incremental CSV→JSON
│   └── google-sheets.js    # Integración con Google Sheets
├── scripts/
│   ├── manage-urls.js      # Gestión de URLs (add/remove)
│   └── json-viewer.js      # Visualizador de datos JSON
├── config/
│   ├── urls.json           # Configuración de URLs
│   └── urls-cache.json     # Cache de Google Sheets
├── data/
│   ├── report_*.csv        # Reportes CSV (backup)
│   └── consolidated-reports.json  # JSON consolidado
└── logs/                   # Logs de ejecución (últimos 7)
```

## ⚙️ Instalación y Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y configura:

```env
# Google Analytics 4
GA4_PROPERTY_ID=tu_property_id
GA4_TIMEZONE=America/Mexico_City
GA4_CREDENTIALS_PATH=../../bitfinanzas/credentials/bitfinanzas-tv-f43f3f68a926.json

# Google Sheets (opcional)
GOOGLE_SHEET_ID=tu_sheet_id
GOOGLE_SHEET_RANGE=URLs!A:A

# API Server
PORT=3000
```

### 3. Verificar credenciales

Asegúrate de que las credenciales de Google estén en la ruta configurada.

## 🎯 Uso

### Servidor Principal (TODO EN UNO)

```bash
# Iniciar servidor completo (API + Dashboard + Scheduler automático)
npm start

# Iniciar servidor + ejecutar reporte inmediato
npm start:now
```

Este comando inicia:
- ✅ API REST en `http://localhost:3000`
- ✅ Dashboard web en `http://localhost:3000`
- ✅ Scheduler automático cada 6 horas (00:00, 06:00, 12:00, 18:00)

### Comandos adicionales

```bash
# Generar reporte único manualmente (sin servidor)
npm run report
```

### Gestión de URLs

```bash
# Ver URLs configuradas
npm run urls list

# Agregar nueva URL
npm run urls add "/nueva-url/"

# Eliminar URL
npm run urls remove "/url-antigua/"
```

### Consolidación de Datos

```bash
# Consolidación incremental (automático en cada reporte)
npm run consolidate

# Consolidación completa (reconstruir desde CSV)
npm run consolidate:full
```

### Visualización de Datos

```bash
# Ver estadísticas en consola
npm run json stats
npm run json urls
npm run json executions
npm run json all
```

## 🌐 API REST

El servidor se inicia automáticamente con `npm start`.

Acceso: **http://localhost:3000**

### Endpoints Disponibles

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/stats` | Estadísticas generales |
| `GET /api/urls` | Resumen por URLs (ordenado por vistas) |
| `GET /api/executions` | Historial de ejecuciones |
| `GET /api/execution/:id` | Detalle de ejecución específica |
| `GET /api/url/:urlPath` | Datos de una URL específica |
| `GET /api/raw` | Datos completos en JSON |
| `GET /api/health` | Estado de la API y scheduler |
| `POST /api/trigger-report` | Ejecutar reporte manualmente |

### Ejemplos de uso

```bash
# Estadísticas generales
curl http://localhost:3000/api/stats

# URLs más populares
curl http://localhost:3000/api/urls

# Datos de URL específica
curl http://localhost:3000/api/url/bitcoin
```

## 📊 Dashboard Web

Accede a **http://localhost:3000** para ver:

- 🔗 **URLs** - Rendimiento por URL
- 📋 **Ejecuciones** - Historial cronológico
- 🔌 **API** - Documentación de endpoints
- 🔄 **Actualización automática** cada 30 segundos

## 📈 Salida de Datos

### CSV Generado

Cada ejecución genera un CSV con:

- URL consultada
- Fecha de consulta
- Vistas de página
- Sesiones
- Usuarios activos/nuevos
- Sesiones comprometidas
- Tasa de compromiso (%)
- Duración promedio (s)
- Tasa de rebote (%)
- Desglose por fuente de tráfico
- Advertencias e insights

### JSON Consolidado

Estructura optimizada:

```json
{
  "data": {
    "2025-10-07_20-10": {
      "metadata": {
        "fechaEjecucion": "2025-10-07",
        "horaEjecucion": "20:10",
        "totalUrls": 4,
        "urlsExitosas": 3
      },
      "urls": {
        "/mi-url/": {
          "metrics": {
            "vistas": 189,
            "sesiones": 228,
            "usuariosActivos": 122,
            "tasaCompromiso": 8.33,
            "tasaRebote": 91.67
          },
          "desgloseTrafico": {...}
        }
      }
    }
  },
  "metadata": {
    "totalEjecuciones": 7,
    "totalUrls": [...],
    "ultimaActualizacion": "2025-10-07T20:10:00.000Z"
  }
}
```

## 🔧 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | **Servidor completo** (API + Dashboard + Scheduler) |
| `npm start:now` | Servidor + ejecutar reporte inmediato |
| `npm run report` | Generar reporte único manualmente |
| `npm run urls list` | Ver URLs configuradas |
| `npm run urls add <url>` | Agregar URL |
| `npm run urls remove <url>` | Eliminar URL |
| `npm run consolidate` | Consolidación incremental |
| `npm run consolidate:full` | Consolidación completa |
| `npm run json stats` | Ver estadísticas en consola |
| `npm run json urls` | Resumen por URL en consola |
| `npm run json executions` | Historial de ejecuciones en consola |

## 🔍 Gestión de URLs

### Múltiples fuentes (orden de prioridad):

1. **Google Sheets** (si está configurado)
2. **Cache local** (backup de Sheets)
3. **Archivo JSON local** (`config/urls.json`)
4. **URLs por defecto** (emergencia)

### Configurar Google Sheets:

1. Crea un Google Sheet
2. Agrega URLs en columna A (una por fila)
3. Obtén el Sheet ID de la URL
4. Configura en `.env`:
   ```env
   GOOGLE_SHEET_ID=tu_sheet_id
   GOOGLE_SHEET_RANGE=URLs!A:A
   ```
5. Comparte el sheet con la cuenta de servicio

## 🚀 Optimizaciones

### Consolidación Incremental

- ✅ Solo procesa el nuevo CSV en cada reporte
- ✅ No reconstruye todo el JSON
- ✅ Rendimiento constante sin importar cantidad de reportes
- ✅ CSV se mantienen como backup

### Validación de Datos

- Detección de inconsistencias
- Comparación de sesiones vs vistas
- Verificación de tasas de rebote
- Logging detallado

## 🔄 Flujo de Trabajo Completo

```bash
# 1. Agregar URLs a monitorear
npm run urls add "/nueva-url/"

# 2. Iniciar servidor completo (TODO EN UNO)
npm start
# Esto inicia: API + Dashboard + Scheduler automático

# 3. Acceder al dashboard
# Abrir http://localhost:3000 en tu navegador

# 4. Ejecutar reporte manualmente (opcional)
curl -X POST http://localhost:3000/api/trigger-report

# 5. Consultar estadísticas
curl http://localhost:3000/api/stats
```

El servidor se queda ejecutando y genera reportes automáticamente cada 6 horas.

## ⚠️ Troubleshooting

### Si los datos difieren de GA4:

1. **Verificar zona horaria** en `.env`
2. **Verificar fechas** - el script consulta datos de ayer
3. **Verificar URLs** - usar rutas exactas con barras
4. **Revisar logs** en `./logs/` para detalles

### Si el JSON se corrompe:

```bash
# Reconstruir desde CSV backup
rm ./data/consolidated-reports.json
npm run consolidate:full
```

### Rate limiting de GA4:

- El script incluye pausas automáticas entre consultas
- Logs muestran advertencias si hay límites

## 📝 Notas Importantes

- **Primer uso**: Ejecuta `npm run report` primero
- **Logs**: Se mantienen automáticamente los últimos 7
- **CSV backup**: Nunca se eliminan, sirven de respaldo
- **JSON**: Fuente principal optimizada
- **Zona horaria**: Crucial para consistencia con GA4
- **Detener scheduler**: `Ctrl+C`

## 🎉 Sistema Completo

Este sistema incluye:

1. ✅ Extracción de datos GA4
2. ✅ Reportes automáticos cada 6h
3. ✅ Consolidación incremental optimizada
4. ✅ API REST para integraciones
5. ✅ Dashboard web visual
6. ✅ Gestión dinámica de URLs
7. ✅ Validación y logging completo

---

**¿Problemas?** Revisa los logs en `./logs/` para información detallada sobre cada ejecución.
