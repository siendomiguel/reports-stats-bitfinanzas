# 🚀 Despliegue en Railway

## 📋 Pre-requisitos

1. Cuenta en [Railway](https://railway.app)
2. Credenciales de Google Cloud (archivo JSON)
3. Property ID de Google Analytics 4

## 🔧 Configuración en Railway

### 1. Variables de Entorno

Configura estas variables en Railway:

```bash
# Google Analytics
GA4_PROPERTY_ID=tu_property_id
GA4_TIMEZONE=America/Mexico_City

# Google Sheets (opcional)
GOOGLE_SHEET_ID=tu_sheet_id
GOOGLE_SHEET_RANGE=URLs!A:A

# Credenciales de Google (IMPORTANTE)
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
```

### 2. Credenciales de Google

**Opción A: Variable de entorno (Recomendado)**

1. Copia el contenido completo de tu archivo `credentials.json`
2. En Railway, crea la variable `GOOGLE_CREDENTIALS` con todo el JSON
3. El sistema creará automáticamente el archivo en `/app/credentials.json`

**Opción B: Archivo en el proyecto**

1. NO recomendado por seguridad
2. Si lo haces, asegúrate de que el archivo esté en `.gitignore`

### 3. Modificar el código para Railway

El sistema necesita crear el archivo de credenciales desde la variable de entorno:

```javascript
// Agregar al inicio de index.js o lib/config.js
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync('/app/credentials.json', process.env.GOOGLE_CREDENTIALS);
  process.env.GA4_CREDENTIALS_PATH = '/app/credentials.json';
}
```

## 📦 Archivos a subir a Git

✅ **SÍ subir:**
- `package.json`
- `package-lock.json`
- `index.js`
- `index_final.js`
- `scheduler.js`
- `/lib/**`
- `/server/**`
- `/scripts/**`
- `README.md`
- `.gitignore`
- `railway.json`
- `.env.example` (sin datos sensibles)

❌ **NO subir:**
- `.env` (credenciales locales)
- `data/` (CSVs generados)
- `logs/` (logs de ejecución)
- `credentials/` (archivos de credenciales)
- `node_modules/`

## 🚀 Desplegar

### Desde GitHub

1. Conecta tu repositorio de GitHub a Railway
2. Railway detectará automáticamente el `package.json`
3. Configura las variables de entorno
4. Railway desplegará automáticamente

### Desde CLI de Railway

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar proyecto
railway init

# Agregar variables de entorno
railway variables set GA4_PROPERTY_ID=tu_property_id
railway variables set GOOGLE_CREDENTIALS='{"type":"service_account",...}'

# Desplegar
railway up
```

## 🔍 Verificar Despliegue

1. Railway te dará una URL pública: `https://tu-app.up.railway.app`
2. Verifica el estado: `https://tu-app.up.railway.app/api/health`
3. Dashboard: `https://tu-app.up.railway.app`

## 📊 Persistencia de Datos

⚠️ **IMPORTANTE:** Railway usa almacenamiento efímero.

**Solución 1: Base de datos (Recomendado)**
- Usa Railway PostgreSQL para almacenar datos
- Migra el sistema de JSON a base de datos

**Solución 2: Volumen persistente**
- Railway ofrece volúmenes persistentes (de pago)
- Monta `/app/data` como volumen

**Solución 3: Almacenamiento externo**
- S3, Google Cloud Storage, etc.
- Guarda CSVs y JSON en la nube

## 🔄 Scheduler en Railway

El cron job funcionará automáticamente porque está integrado en el servidor principal (`index.js`).

Railway mantendrá el proceso corriendo 24/7:
- ✅ Servidor API activo
- ✅ Scheduler ejecutando cada 6 horas
- ✅ Dashboard accesible públicamente

## 📝 Comandos útiles

```bash
# Ver logs en vivo
railway logs

# Ver variables
railway variables

# Reiniciar servicio
railway restart

# Abrir dashboard
railway open
```

## 🐛 Troubleshooting

### Error: Credenciales no encontradas

```bash
# Verificar que GOOGLE_CREDENTIALS esté configurado
railway variables | grep GOOGLE_CREDENTIALS
```

### Error: Puerto ya en uso

Railway asigna automáticamente `$PORT`. El código ya está configurado:
```javascript
const PORT = process.env.PORT || 3000;
```

### Error: Memoria insuficiente

Railway tiene límites de memoria. Optimiza:
- Reducir número de URLs
- Aumentar intervalo del scheduler
- Usar plan de pago con más recursos

## 🎯 Checklist de Despliegue

- [ ] `.gitignore` configurado correctamente
- [ ] Variables de entorno en Railway
- [ ] `GOOGLE_CREDENTIALS` como variable de entorno
- [ ] Código modificado para crear archivo de credenciales
- [ ] `railway.json` en el repositorio
- [ ] Push a GitHub
- [ ] Conectar repositorio en Railway
- [ ] Verificar logs del despliegue
- [ ] Probar `/api/health`
- [ ] Verificar scheduler en logs

## 🔐 Seguridad

1. **NUNCA** commitees credenciales
2. Usa variables de entorno en Railway
3. Configura `.gitignore` correctamente
4. Revisa el repositorio antes del push:
   ```bash
   git status
   git diff --cached
   ```

---

¿Problemas? Revisa los logs: `railway logs --tail 100`
