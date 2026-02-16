# 📞 Guía Rápida: Obtener Números de Teléfono

Apollo.io requiere un webhook HTTPS público para enviar números de teléfono. Aquí está la forma más rápida de configurarlo:

## ⚡ Configuración Rápida (5 minutos)

### Paso 1: Instalar ngrok

```bash
# macOS
brew install ngrok

# Windows (con Chocolatey)
choco install ngrok

# O descarga desde: https://ngrok.com/download
```

### Paso 2: Crear cuenta gratuita en ngrok

1. Ve a https://dashboard.ngrok.com/signup
2. Crea una cuenta (es gratis)
3. Copia tu authtoken desde https://dashboard.ngrok.com/get-started/your-authtoken

### Paso 3: Configurar ngrok

```bash
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

### Paso 4: Iniciar ngrok

**Abre una terminal NUEVA** y ejecuta:

```bash
ngrok http 3000
```

Deberías ver algo como:

```
Session Status                online
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### Paso 5: Configurar la URL en .env

Copia la URL de ngrok (la parte `https://abc123.ngrok.io`) y agrégala a tu archivo `.env`:

```bash
PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/webhook/apollo
```

### Paso 6: ¡Probar!

En tu terminal original, ejecuta:

```bash
npx tsx src/test-with-phone.ts https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276/
```

## 🎯 Ejemplo Completo

```bash
# Terminal 1: Iniciar ngrok
ngrok http 3000

# Terminal 2: Configurar y ejecutar
echo "PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/webhook/apollo" >> .env
npx tsx src/test-with-phone.ts https://www.linkedin.com/in/username
```

## ✅ Verificar que funciona

Deberías ver en los logs:

```
🌐 Webhook server running on port 3000
📡 Webhook URL: https://abc123.ngrok.io/webhook/apollo
[Apollo] Requesting enrichment with webhook: true
[Apollo] Waiting for webhook data...
[Webhook] Received data from Apollo:
[Apollo] ✓ Phone number received via webhook
```

## ⚠️ Notas Importantes

1. **ngrok debe estar corriendo**: Mantén la terminal de ngrok abierta mientras usas el script
2. **URL cambia cada vez**: Cada vez que reinicias ngrok, la URL cambia (a menos que uses ngrok pro)
3. **No todos los perfiles tienen teléfono**: Apollo solo tiene teléfonos para algunos perfiles
4. **Puede tardar**: Apollo puede tardar 30-60 segundos en enviar los datos al webhook

## 🚫 Sin números de teléfono?

Si no obtienes el número, puede ser porque:

- ❌ El perfil no tiene teléfono en la base de datos de Apollo
- ❌ ngrok no está corriendo
- ❌ La URL en `.env` no es correcta
- ❌ Apollo no pudo acceder a tu webhook

Para verificar que el webhook funciona, visita:
```
https://tu-url-ngrok.ngrok.io/health
```

Deberías ver: `{"status":"ok","timestamp":"..."}`

## 💡 Alternativas a ngrok

### localtunnel (Gratis, sin cuenta)

```bash
npm install -g localtunnel
lt --port 3000
# Usa la URL que te da
```

### Producción

Para producción, despliega en:
- Heroku (gratis con hobby tier)
- Railway (gratis con límites)
- Vercel/Netlify (funciones serverless)

## 🆘 Ayuda

Si tienes problemas, verifica:

1. ✅ ngrok está instalado: `ngrok version`
2. ✅ ngrok está corriendo: Deberías ver "Forwarding" en la terminal
3. ✅ `.env` tiene la URL correcta: `cat .env | grep PUBLIC_WEBHOOK_URL`
4. ✅ El puerto 3000 está libre: `lsof -i :3000`
