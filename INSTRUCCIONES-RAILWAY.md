# 🚂 Instrucciones Rápidas para Railway

## ✅ Lo que tienes ahora

- ✅ Código listo para desplegar
- ✅ Servidor web con API REST
- ✅ Webhook configurado automáticamente
- ✅ Todo funciona localmente

## 🎯 Pasos para Desplegar (10 minutos)

### 1. Subir a GitHub (5 minutos)

```bash
# Inicializar git (si no lo has hecho)
git init
git add .
git commit -m "Apollo LinkedIn Prospector - Ready for Railway"

# Crear repo en GitHub
# Ve a: https://github.com/new
# Nombre sugerido: apollo-linkedin-prospector
# Puede ser privado o público

# Conectar y subir
git remote add origin https://github.com/TU-USUARIO/apollo-linkedin-prospector.git
git branch -M main
git push -u origin main
```

### 2. Desplegar en Railway (3 minutos)

1. **Ir a Railway**
   - https://railway.app
   - Login con GitHub

2. **Crear proyecto**
   - Click "New Project"
   - Click "Deploy from GitHub repo"
   - Selecciona `apollo-linkedin-prospector`

3. **Configurar variables**
   - Click en tu proyecto
   - Ve a "Variables"
   - Agrega: `APOLLO_API_KEY` = `tu_api_key_aqui`

4. **Generar dominio**
   - Ve a "Settings"
   - En "Networking" → "Generate Domain"
   - Copia tu URL: `https://tu-app.up.railway.app`

### 3. Probar (2 minutos)

```bash
# Health check
curl https://tu-app.up.railway.app/health

# Enriquecer un perfil
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276",
    "includePhone": false
  }'
```

## 🎉 ¡Listo!

Ahora tienes:
- ✅ URL pública permanente
- ✅ Webhook funcionando automáticamente
- ✅ API REST disponible 24/7
- ✅ Puedes obtener números de teléfono

## 📞 Para obtener números de teléfono

Simplemente usa `includePhone: true`:

```bash
curl -X POST https://tu-app.up.railway.app/api/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276",
    "includePhone": true
  }'
```

**Nota:** Esto puede tardar 30-60 segundos porque espera el webhook de Apollo.

## 🔄 Actualizar el código

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción de cambios"
git push
```

Railway redesplegará automáticamente en 2-3 minutos.

## 📊 Ver logs

En Railway:
1. Click en tu proyecto
2. Ve a "Deployments"
3. Click en el deployment activo
4. "View Logs"

## 💰 Costos

Railway ofrece:
- **$5 gratis al mes** (suficiente para desarrollo)
- **$20/mes** para producción (incluye $20 de crédito)

## 🆘 Si algo falla

### Build failed
```bash
# Verifica que compile localmente
npm run build

# Si funciona local, revisa los logs en Railway
```

### Application failed to respond
```bash
# Verifica que APOLLO_API_KEY esté configurada en Railway
# Ve a Variables y verifica que esté ahí
```

### No phone number received
- No todos los perfiles tienen teléfono en Apollo
- Verifica que uses `includePhone: true`
- Apollo puede tardar hasta 60 segundos

## 📚 Documentación Completa

- [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md) - Guía detallada
- [API-USAGE.md](./API-USAGE.md) - Ejemplos de uso
- [README.md](./README.md) - Documentación general

## 🎯 Próximos Pasos

Una vez desplegado, puedes:
1. Integrar la API en tu aplicación
2. Crear un frontend (React, Vue, etc.)
3. Agregar autenticación
4. Implementar base de datos
5. Exportar a Google Sheets

## 💡 Tips

1. **Guarda tu URL de Railway**: La necesitarás para hacer requests
2. **Usa includePhone: false** si no necesitas teléfonos (es más rápido)
3. **Batch processing** para múltiples perfiles es más eficiente
4. **Revisa los logs** si algo no funciona

## ✅ Checklist

Antes de desplegar:
- [ ] Código subido a GitHub
- [ ] Cuenta de Railway creada
- [ ] APOLLO_API_KEY configurada
- [ ] Dominio generado en Railway
- [ ] Health check funciona
- [ ] API enrich funciona

¡Éxito! 🚀
