# 📊 Sistema de Reportes GA4 Automatizado

Sistema mejorado para extraer datos confiables de Google Analytics 4 y ejecutar reportes cada 6 horas automáticamente.

## 🚀 Mejoras Implementadas

### ✅ **Problemas Resueltos:**

1. **Discrepancias de Datos Eliminadas:**

   - Filtro `EXACT` en lugar de `CONTAINS` para URLs específicas
   - Manejo correcto de zona horaria
   - Cálculo ponderado de métricas promedio
   - Consulta de datos de "ayer" para consistencia

2. **Métricas Mejoradas:**

   - ✅ Vistas de página (screenPageViews)
   - ✅ Sesiones
   - ✅ Usuarios activos
   - ✅ Duración promedio de sesión (ponderada)
   - ✅ Tasa de rebote (corregida: decimal → porcentaje)

3. **Validación de Datos:**

   - Detección automática de inconsistencias
   - Logging detallado de todas las consultas
   - Consultas de respaldo para URLs no encontradas
   - Manejo robusto de errores

4. **Automatización Confiable:**
   - Ejecución cada 6 horas con `node-cron`
   - Logs automáticos con rotación
   - Manejo de señales del sistema
   - Pausas entre consultas para evitar rate limiting

## 📁 Estructura de Archivos

```
Reports/
├── index.js                 # Script original (mantener como respaldo)
├── index_improved.js        # ✨ Script mejorado con validaciones
├── scheduler.js             # 🤖 Programador automático cada 6h
├── package.json             # Dependencias actualizadas
├── .env.example            # Ejemplo de configuración
├── data/                   # 📊 Reportes CSV generados
├── logs/                   # 📝 Logs de ejecución automática
└── documents/
    └── bitfinanzas_report.md
```

## ⚙️ Configuración

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
GA4_PROPERTY_ID=tu_property_id_aqui
GA4_TIMEZONE=America/Mexico_City
DAYS_BACK=1
DEBUG_MODE=true
```

### 3. Verificar Credenciales

Asegúrate de que el archivo de credenciales esté en la ruta correcta:

```
../../bitfinanzas/credentials/bitfinanzas-tv-f43f3f68a926.json
```

## 🚀 Uso

### Ejecutar Reporte Una Vez (Recomendado para Pruebas)

```bash
npm run report
```

### Ejecutar Reporte Inmediatamente

```bash
npm run report:now
```

### Iniciar Programador Automático (cada 6 horas)

```bash
npm run scheduler
```

El programador se ejecutará en:

- **00:00** - Medianoche
- **06:00** - Madrugada
- **12:00** - Mediodía
- **18:00** - Tarde

## 📊 Salida de Datos

### CSV Generado

Cada ejecución genera un archivo CSV con:

| Campo                     | Descripción               |
| ------------------------- | ------------------------- |
| **URL**                   | Ruta consultada           |
| **Fecha de consulta**     | Fecha de los datos (ayer) |
| **Vistas de página**      | Total de vistas           |
| **Sesiones**              | Total de sesiones         |
| **Usuarios activos**      | Usuarios únicos           |
| **Duración promedio (s)** | Tiempo promedio de sesión |
| **Tasa de rebote (%)**    | Porcentaje de rebote      |
| **Datos encontrados**     | true/false                |
| **Advertencias**          | Alertas de consistencia   |

### Ejemplo de Salida en Consola

```
🔍 Consultando 1 URLs en GA4...
📊 Property ID: 123456789
🌍 Zona horaria configurada: America/Mexico_City

📅 Consultando datos del 2025-10-05 para: /radar-economico-divisas-y-commodities-hoy-105/
🔍 Respuesta raw para /radar-economico-divisas-y-commodities-hoy-105/: { rowCount: 1 }
   Fila: vistas=45, sesiones=38, duración=125.5s, rebote=0.34
🔍 Validando consistencia de datos para /radar-economico-divisas-y-commodities-hoy-105/:
✅ Datos consistentes para /radar-economico-divisas-y-commodities-hoy-105/
✅ Datos procesados para /radar-economico-divisas-y-commodities-hoy-105/: {...}
✅ /radar-economico-divisas-y-commodities-hoy-105/ → 45 vistas, 38 sesiones

📁 Reporte generado: ./data/report_2025-10-06_15-30.csv
📊 Resumen:
   URLs consultadas: 1
   Exitosas: 1
   Con advertencias: 0
   Errores: 0
```

## 🔍 Troubleshooting

### Si los datos siguen siendo diferentes a GA4:

1. **Verificar Zona Horaria:**

   ```bash
   # En tu .env, usa la zona horaria correcta
   GA4_TIMEZONE=America/Mexico_City  # Ajusta según tu ubicación
   ```

2. **Verificar Fechas:**

   - El script consulta datos de "ayer" por consistencia
   - GA4 puede tener retrasos de procesamiento de 24-48h

3. **Verificar URLs:**

   - Usar rutas exactas: `/mi-pagina/` no `/mi-pagina`
   - Verificar mayúsculas/minúsculas
   - Revisar en los logs las "URLs similares encontradas"

4. **Comparar con GA4:**
   - En GA4, usar el rango de fechas **exacto**
   - Verificar que esté en la misma zona horaria
   - Usar las **mismas métricas**: Vistas de página, Sesiones, etc.

### Logs de Debugging

Los logs automáticos se guardan en `./logs/` con información detallada:

- Respuestas raw de GA4
- Cálculos paso a paso
- Advertencias de consistencia
- Errores completos

## 🛠️ Scripts Disponibles

| Comando              | Descripción                             |
| -------------------- | --------------------------------------- |
| `npm run report`     | Ejecutar reporte una vez (recomendado)  |
| `npm run report:now` | Ejecutar reporte + mostrar programación |
| `npm run scheduler`  | Iniciar programador automático          |
| `npm start`          | Ejecutar script original (respaldo)     |

## ⚠️ Notas Importantes

1. **Primer Uso:** Ejecuta `npm run report` primero para verificar que todo funcione
2. **Rate Limiting:** El script incluye pausas entre consultas automáticamente
3. **Logs:** Se mantienen los últimos 7 archivos de log automáticamente
4. **Zona Horaria:** Crucial para consistencia con GA4
5. **Detener Programador:** Usar `Ctrl+C` para detener el scheduler

## 🔄 Migración desde Script Original

1. Mantén `index.js` como respaldo
2. Usa `index_improved.js` para reportes manuales
3. Usa `scheduler.js` para automatización
4. Compara resultados inicialmente

---

**¿Problemas?** Revisa los logs en `./logs/` para información detallada sobre cada ejecución.
