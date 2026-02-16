# 🚂 Guía de Despliegue en Railway

Esta guía te ayudará a desplegar el Apollo LinkedIn Prospector en Railway para obtener una URL pública permanente y poder recibir webhooks de Apollo.io.

## 📋 Requisitos Previos

- Cuenta de GitHub
- Cuenta de Railway (gratis - https://railway.app)
- API Key de Apollo.io

## 🚀 Paso 1: Preparar el Repositorio en GitHub

### 1.1 Inicializar Git (si no lo has hecho)

```bash
git init
git add .
git commit -m "Initial commit: Apollo LinkedIn Prospector"
```

### 1.2 Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Crea un nuevo repositorio (puede ser privado o público)
3. NO inicialices con README, .gitignore o licencia

### 1.3 Conectar y subir el código

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

## 🚂 Paso 2: Desplegar en Railway

### 2.1 Crear cuenta en Railway

1. Ve a https://railway.app
2. Haz clic en "Start a New Project"
3. Conecta tu cuenta de GitHub

### 2.2 Crear nuevo proyecto

1. Haz clic en "Deploy from GitHub repo"
2. Selecciona tu repositorio `apollo-linkedin-prospector`
3. Railway detectará automáticamente que es un proyecto Node.js

### 2.3 Configurar Variables de Entorno

En el dashboard de Railway:

1. Ve a la pestaña "Variables"
2. Agrega las siguientes variables:

```
APOLLO_API_KEY=tu_api_key_de_apollo_aqui
NODE_ENV=production
```

Railway automáticamente proporciona:
- `PORT` (Railway lo asigna automáticamente)
- `RAILWAY_PUBLIC_DOMAIN` (tu dominio público)

### 2.4 Desplegar

1. Railway comenzará a construir y desplegar automáticamente
2. Espera a que el despliegue termine (2-3 minutos)
3. Verás un mensaje "Deployment successful"

## 🌐 Paso 3: Obtener tu URL Pública

### 3.1 Generar dominio público

1. En el dashboard de Railway, ve a "Settings"
2. En la sección "Networking", haz clic en "Generate Domain"
3. Railway te dará una URL como: `https://tu-app.up.railway.app`

### 3.2 Verificar que funciona

Abre en tu navegador:
```
https://tu-app.up.railway.app/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "webhookUrl": "https://tu-app.up.railway.app/webhook/apollo"
}
```

## ✅ Paso 4: Probar el Sistema

### 4.1 Probar desde tu computadora local

Crea un archivo `test-railway.ts`:

```typescript
import axios from 'axios';

const RAILWAY_URL = 'https://tu-app.up.railway.app';

async function testEnrichment() {
  try {
    // Sin teléfono (rápido)
    const response = await axios.post(`${RAILWAY_URL}/api/enrich`, {
      linkedinUrl: 'https://www.linkedin.com/in/williamhgates',
      includePhone: false
    });
    
    console.log('✅ Perfil enriquecido:');
    console.log(response.data);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEnrichment();
```

O usa curl:

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": false
  }'
```

### 4.2 Probar con números de teléfono

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": true
  }'
```

Nota: Esto puede tardar 30-60 segundos porque espera el webhook de Apollo.

### 4.3 Probar batch

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich/batch \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/williamhgates",
      "https://www.linkedin.com/in/satyanadella"
    ],
    "includePhone": false
  }'
```

## 📊 Endpoints Disponibles

Una vez desplegado, tu API tendrá estos endpoints:

### GET /
Información general de la API

### GET /health
Health check del servidor

### POST /api/enrich
Enriquecer un perfil individual

**Request:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/username",
  "includePhone": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fullName": "John Doe",
    "email": "john@company.com",
    "title": "CEO",
    "company": "Company Inc",
    ...
  }
}
```

### POST /api/enrich/batch
Enriquecer múltiples perfiles

**Request:**
```json
{
  "linkedinUrls": [
    "https://www.linkedin.com/in/user1",
    "https://www.linkedin.com/in/user2"
  ],
  "includePhone": false
}
```

### POST /webhook/apollo
Webhook para recibir datos de Apollo (usado internamente)

## 🔧 Configuración Avanzada

### Dominio Personalizado

1. En Railway, ve a "Settings" → "Networking"
2. Agrega tu dominio personalizado
3. Configura los DNS según las instrucciones de Railway

### Logs y Monitoreo

Ver logs en tiempo real:
1. En Railway, ve a la pestaña "Deployments"
2. Haz clic en el deployment activo
3. Ve a "View Logs"

### Escalar

Railway escala automáticamente, pero puedes:
1. Ir a "Settings" → "Resources"
2. Ajustar CPU y memoria si es necesario

## 💰 Costos

Railway ofrece:
- **Plan Hobby (Gratis)**: $5 de crédito gratis al mes
- **Plan Pro**: $20/mes con $20 de crédito incluido

Para este proyecto, el plan gratuito debería ser suficiente para desarrollo y pruebas.

## 🔄 Actualizar el Código

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción de cambios"
git push
```

Railway detectará el push y redesplegará automáticamente.

## 🐛 Troubleshooting

### "Build failed"
- Verifica que `package.json` tenga el script `build`
- Verifica que todas las dependencias estén en `package.json`
- Revisa los logs de build en Railway

### "Application failed to respond"
- Verifica que `APOLLO_API_KEY` esté configurada
- Verifica los logs de la aplicación
- Asegúrate de que el puerto sea el que Railway proporciona

### "Webhook timeout"
- Verifica que la URL pública esté accesible
- Verifica que Apollo pueda acceder a tu webhook
- Revisa los logs para ver si Apollo está enviando datos

### "No phone number received"
- No todos los perfiles tienen teléfono en Apollo
- Verifica que `includePhone: true` en la request
- Apollo puede tardar hasta 60 segundos

## 📝 Próximos Pasos

Una vez desplegado en Railway:

1. ✅ Tienes una URL pública permanente
2. ✅ Puedes recibir webhooks de Apollo
3. ✅ Puedes obtener números de teléfono
4. ✅ Tu API está disponible 24/7

Ahora puedes:
- Integrar la API en tu aplicación frontend
- Crear un dashboard web
- Agregar autenticación
- Implementar base de datos
- Exportar a Google Sheets

## 🆘 Soporte

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Apollo.io Docs: https://docs.apollo.io

## 📚 Recursos Adicionales

- [README.md](./README.md) - Documentación principal
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Resumen técnico
- [API-USAGE.md](./API-USAGE.md) - Ejemplos de uso de la API
