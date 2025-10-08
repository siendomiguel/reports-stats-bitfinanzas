# 🚂 Setup Rápido en Railway

## 📋 Checklist de Despliegue

### 1. ✅ Preparar Repositorio

```bash
# 1. Verificar que .gitignore está correcto
cat .gitignore

# 2. Ver qué archivos se van a subir
git status

# 3. Agregar archivos al staging
git add .

# 4. Verificar staging (NO debe haber credenciales)
git diff --cached --name-only

# 5. Commit
git commit -m "feat: sistema de reportes GA4 listo para deploy"

# 6. Push
git push origin main
```

### 2. 🔐 Preparar Credenciales

**Copiar contenido del archivo de credenciales:**

```bash
# En tu terminal local
cat ../../bitfinanzas/credentials/bitfinanzas-tv-f43f3f68a926.json
```

Copia TODO el JSON (será una sola línea larga).

### 3. 🚀 Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Autoriza Railway en GitHub
5. Selecciona tu repositorio `bitfinanzas/reports`

### 4. ⚙️ Configurar Variables de Entorno

En Railway → Variables, agrega:

```bash
# Google Analytics (REQUERIDO)
GA4_PROPERTY_ID=tu_property_id_aqui
GA4_TIMEZONE=America/Mexico_City

# Credenciales de Google (REQUERIDO)
# Pega el JSON completo que copiaste antes
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...todo el json..."}

# Google Sheets (OPCIONAL)
GOOGLE_SHEET_ID=tu_sheet_id
GOOGLE_SHEET_RANGE=URLs!A:A
```

**⚠️ IMPORTANTE:**
- `GOOGLE_CREDENTIALS` debe ser el JSON completo en UNA SOLA LÍNEA
- NO incluyas saltos de línea en el JSON
- Railway automáticamente asigna `PORT`, no lo configures

### 5. 🔄 Desplegar

Railway desplegará automáticamente. Espera a que termine (2-3 minutos).

### 6. ✅ Verificar Despliegue

Railway te dará una URL tipo: `https://reports-production-xxxx.up.railway.app`

Verifica:

```bash
# 1. Health check
curl https://tu-url.up.railway.app/api/health

# 2. Dashboard
# Abre en navegador: https://tu-url.up.railway.app

# 3. Ver URLs configuradas
curl https://tu-url.up.railway.app/api/config/urls
```

### 7. 📊 Configurar URLs Iniciales

```bash
# Agregar primera URL vía API
curl -X POST https://tu-url.up.railway.app/api/config/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "/radar-economico-divisas-y-commodities-hoy-105/"}'

# Agregar más URLs
curl -X POST https://tu-url.up.railway.app/api/config/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "/bitcoin-analisis-octubre/"}'

# Listar URLs
curl https://tu-url.up.railway.app/api/config/urls
```

### 8. 🔍 Monitorear

```bash
# Ver logs en Railway dashboard
# O usar Railway CLI:
railway logs --tail 100

# Verificar que el scheduler está activo
curl https://tu-url.up.railway.app/api/health | grep scheduler
```

## 🎯 Variables de Entorno Requeridas

| Variable | Requerido | Ejemplo | Descripción |
|----------|-----------|---------|-------------|
| `GA4_PROPERTY_ID` | ✅ Sí | `123456789` | ID de propiedad GA4 |
| `GA4_TIMEZONE` | ✅ Sí | `America/Mexico_City` | Zona horaria |
| `GOOGLE_CREDENTIALS` | ✅ Sí | `{"type":"service_account"...}` | JSON completo de credenciales |
| `GOOGLE_SHEET_ID` | ⚪ No | `1ABC123...` | ID de Google Sheet (opcional) |
| `GOOGLE_SHEET_RANGE` | ⚪ No | `URLs!A:A` | Rango del sheet (opcional) |

## 📝 Comandos de Railway CLI

```bash
# Instalar CLI
npm i -g @railway/cli

# Login
railway login

# Ver logs
railway logs

# Ver variables
railway variables

# Abrir dashboard
railway open

# Reiniciar
railway restart
```

## ⚠️ Problemas Comunes

### Error: "Credenciales no encontradas"

**Solución:**
```bash
# Verificar que GOOGLE_CREDENTIALS existe
railway variables | grep GOOGLE_CREDENTIALS

# Si no existe, agregarla:
railway variables set GOOGLE_CREDENTIALS='{"type":"service_account",...}'
```

### Error: "Property ID no configurado"

**Solución:**
```bash
railway variables set GA4_PROPERTY_ID=tu_property_id
```

### Error: "Puerto ya en uso"

**Solución:**
Railway asigna automáticamente el puerto. NO configures `PORT` manualmente.

### Scheduler no se ejecuta

**Solución:**
1. Verifica logs: `railway logs --tail 100`
2. El scheduler se activa automáticamente al iniciar
3. Verifica que no haya errores en las credenciales

## 🔄 Actualizar el Proyecto

```bash
# 1. Hacer cambios locales
# 2. Commit
git add .
git commit -m "feat: nueva funcionalidad"

# 3. Push (Railway despliega automáticamente)
git push origin main

# 4. Ver logs del nuevo deploy
railway logs
```

## 📊 Persistencia de Datos

⚠️ **IMPORTANTE:** Railway usa almacenamiento efímero por defecto.

**Los CSVs y JSON se pierden al reiniciar.**

**Soluciones:**

### Opción 1: Volumen Persistente (Recomendado)
```bash
# En Railway dashboard:
# Settings → Volumes → Add Volume
# Mount path: /app/data
```

### Opción 2: Base de Datos
- Agrega PostgreSQL desde Railway
- Migra de JSON a base de datos

### Opción 3: Almacenamiento Externo
- Configura S3, Google Cloud Storage, etc.
- Modifica el código para guardar en la nube

## 🎉 Listo!

Tu sistema está desplegado y funcionando 24/7:
- ✅ API REST pública
- ✅ Dashboard web accesible
- ✅ Scheduler automático cada 6 horas
- ✅ Gestión de URLs vía API

**URL del proyecto:** https://tu-app.up.railway.app

---

**¿Necesitas ayuda?** Revisa los logs: `railway logs --tail 100`
