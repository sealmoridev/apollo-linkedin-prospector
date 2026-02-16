# Apollo LinkedIn Prospector

Sistema de prospección que permite enriquecer datos de leads desde LinkedIn utilizando la API de Apollo.io.

## 🎯 ¿Qué hace?

Extrae información de perfiles de LinkedIn usando Apollo.io:
- ✅ Nombre completo, email, título, empresa, ubicación
- ✅ Números de teléfono (con webhook)
- ✅ Procesamiento individual o batch (múltiples perfiles)
- ✅ API REST para integración
- ✅ Webhook para datos asíncronos

## 🚀 Despliegue Rápido en Railway (Recomendado)

### Opción 1: Deploy directo desde GitHub

1. **Sube el código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```

2. **Despliega en Railway**
   - Ve a https://railway.app
   - Conecta tu cuenta de GitHub
   - Selecciona "Deploy from GitHub repo"
   - Selecciona tu repositorio
   - Agrega variable de entorno: `APOLLO_API_KEY=tu_api_key`
   - Railway desplegará automáticamente

3. **Obtén tu URL pública**
   - En Railway, ve a Settings → Generate Domain
   - Tu URL será: `https://tu-app.up.railway.app`

4. **¡Listo! Prueba tu API**
   ```bash
   curl https://tu-app.up.railway.app/health
   ```

Ver [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md) para instrucciones detalladas.

## 💻 Desarrollo Local

## 💻 Desarrollo Local

### Instalación

```bash
npm install
cp .env.example .env
# Edita .env y agrega tu APOLLO_API_KEY
```

### Ejecutar servidor local

```bash
npm run dev:server
```

El servidor estará disponible en `http://localhost:3000`

### Scripts de prueba

```bash
# Enriquecer un perfil (sin teléfono)
npx tsx src/test-single.ts https://www.linkedin.com/in/username

# Enriquecer múltiples perfiles
npx tsx src/test-batch.ts <url1> <url2> <url3>
```

## 📡 Uso de la API

Una vez desplegado en Railway, puedes usar la API desde cualquier lugar:

### Enriquecer un perfil

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": false
  }'
```

### Enriquecer con teléfono

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "includePhone": true
  }'
```

### Batch (múltiples perfiles)

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich/batch \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/user1",
      "https://www.linkedin.com/in/user2"
    ],
    "includePhone": false
  }'
```

Ver [API-USAGE.md](./API-USAGE.md) para más ejemplos en diferentes lenguajes.

```typescript
import { EnrichmentService } from './services/enrichment-service';

const service = new EnrichmentService(process.env.APOLLO_API_KEY!);

const lead = await service.enrichProfile(
  'https://www.linkedin.com/in/username'
);

console.log(lead);
```

### Enriquecer múltiples perfiles (batch)

```typescript
const result = await service.enrichProfiles([
  'https://www.linkedin.com/in/user1',
  'https://www.linkedin.com/in/user2',
  'https://www.linkedin.com/in/user3'
]);

console.log(`Exitosos: ${result.successful.length}`);
console.log(`Fallidos: ${result.failed.length}`);
console.log(`Créditos consumidos: ${result.totalCreditsConsumed}`);
```

## 🔧 Estructura del Proyecto

```
src/
├── services/
│   ├── apollo-client.ts        # Cliente de Apollo.io API
│   └── enrichment-service.ts   # Servicio de enriquecimiento
├── utils/
│   └── linkedin-validator.ts   # Validador de URLs de LinkedIn
├── types/
│   └── index.ts                # Tipos TypeScript
├── index.ts                    # Script de ejemplo completo
├── test-single.ts              # Script para probar un perfil
└── test-batch.ts               # Script para probar múltiples perfiles
```

## 📊 Datos Enriquecidos

El sistema extrae la siguiente información de cada perfil:

- **Información personal**: Nombre completo, email corporativo, email personal
- **Información profesional**: Título actual, empresa, dominio de empresa, industria
- **Ubicación**: Ciudad, estado, país (formato completo)
- **Metadata**: ID de Apollo, créditos consumidos, fecha de enriquecimiento, URL de LinkedIn

## 💡 Ejemplos de Salida

### Perfil Individual
```
✅ ¡Perfil enriquecido exitosamente!

📊 Datos extraídos:
═══════════════════════════════════════════════════════
👤 Nombre completo:    Bill Gates
📧 Email:              be@breakthroughenergy.org
💼 Título:             Founder
🏢 Empresa:            Breakthrough Energy
🌐 Dominio empresa:    breakthroughenergy.org
🏭 Industria:          management consulting
📍 Ubicación:          Seattle, Washington, United States
💳 Créditos usados:    1
═══════════════════════════════════════════════════════
```

### Batch de Perfiles
```
═══════════════════════════════════════════════════════
📊 RESUMEN DEL BATCH
═══════════════════════════════════════════════════════
✅ Exitosos:           2
❌ Fallidos:           0
💳 Créditos totales:   2
═══════════════════════════════════════════════════════
```

## ⚙️ Características Implementadas

- ✅ Validación de URLs de LinkedIn
- ✅ Normalización de URLs
- ✅ Enriquecimiento individual de perfiles
- ✅ Enriquecimiento batch (múltiples perfiles)
- ✅ Manejo de errores robusto
- ✅ Deduplicación de URLs
- ✅ Logging detallado

## 🔜 Próximas Características

- [ ] Autenticación multi-usuario
- [ ] Almacenamiento en base de datos (PostgreSQL)
- [ ] Caching con Redis
- [ ] Exportación a Google Sheets
- [ ] Registro de actividad y auditoría
- [ ] Interfaz web (React)
- [ ] Property-based testing

## 📝 Notas

- Cada llamada a la API de Apollo consume créditos de tu cuenta
- Las URLs se normalizan automáticamente al formato estándar
- Los perfiles duplicados se procesan solo una vez en batch
- Los errores se manejan individualmente en operaciones batch

## 🔑 Obtener API Key de Apollo.io

1. Crea una cuenta en [Apollo.io](https://www.apollo.io/)
2. Ve a Settings → Integrations → API
3. Genera una nueva API key
4. Copia la key a tu archivo `.env`

## 🐛 Troubleshooting

### Error: "Apollo API key is required"
- Verifica que el archivo `.env` existe
- Verifica que `APOLLO_API_KEY` está configurada correctamente

### Error: "Invalid Apollo API key"
- Verifica que tu API key es válida
- Verifica que tu cuenta de Apollo tiene créditos disponibles

### Error: "Profile not found in Apollo database"
- El perfil de LinkedIn no existe en la base de datos de Apollo
- Verifica que la URL del perfil es correcta y pública


## 📚 Documentación Completa

- **[INSTRUCCIONES-RAILWAY.md](./INSTRUCCIONES-RAILWAY.md)** - ⭐ Empieza aquí para desplegar
- **[DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md)** - Guía detallada de despliegue
- **[API-USAGE.md](./API-USAGE.md)** - Ejemplos de uso en diferentes lenguajes
- **[IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md)** - Resumen técnico completo

## 📊 Endpoints de la API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check del servidor |
| `/api/enrich` | POST | Enriquecer un perfil individual |
| `/api/enrich/batch` | POST | Enriquecer múltiples perfiles |
| `/webhook/apollo` | POST | Webhook de Apollo (uso interno) |

## 🔐 Variables de Entorno

```bash
# Requerido
APOLLO_API_KEY=tu_api_key_aqui

# Opcional (Railway lo configura automáticamente)
PORT=3000
NODE_ENV=production
RAILWAY_PUBLIC_DOMAIN=tu-app.up.railway.app
```

## 💰 Costos

- **Apollo.io**: Según tu plan (tienen plan gratuito limitado)
- **Railway**: $5 gratis/mes, luego $20/mes con $20 de crédito incluido

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

MIT

## 🆘 Soporte

- **Apollo.io Docs**: https://docs.apollo.io
- **Railway Docs**: https://docs.railway.app
- **Issues**: Abre un issue en GitHub

## 🎯 Roadmap

- [ ] Autenticación multi-usuario con JWT
- [ ] Base de datos PostgreSQL para almacenar leads
- [ ] Caching con Redis
- [ ] Exportación automática a Google Sheets
- [ ] Frontend React con dashboard
- [ ] Analytics y reportes
- [ ] Property-based testing completo
- [ ] Rate limiting y throttling
- [ ] Webhooks personalizados para clientes

---

Hecho con ❤️ para prospección eficiente en LinkedIn
