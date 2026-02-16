# 🎯 Instrucciones para Obtener Números de Teléfono

## ✅ Lo que ya funciona (SIN configuración adicional)

Puedes obtener estos datos AHORA MISMO:

```bash
npx tsx src/test-single.ts https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276/
```

**Obtienes:**
- ✅ Nombre: Jeronimo Horta Scherpf
- ✅ Email: jeronimo.horta@loreal.com
- ✅ Título: Retail Area Manager
- ✅ Empresa: L'Oréal
- ✅ Ubicación: Santiago, Chile

## 📞 Para obtener NÚMEROS DE TELÉFONO

Necesitas 3 pasos simples:

### Paso 1: Instalar ngrok (1 minuto)

```bash
brew install ngrok
```

Si no tienes Homebrew, descarga desde: https://ngrok.com/download

### Paso 2: Configurar ngrok (2 minutos)

1. Ve a https://dashboard.ngrok.com/signup y crea una cuenta GRATIS
2. Copia tu authtoken desde https://dashboard.ngrok.com/get-started/your-authtoken
3. Ejecuta:

```bash
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

### Paso 3: Usar el sistema (cada vez que quieras obtener teléfonos)

**Terminal 1 - Iniciar ngrok:**
```bash
ngrok http 3000
```

Verás algo como:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**Terminal 2 - Configurar y ejecutar:**
```bash
# Agrega la URL de ngrok a tu .env (reemplaza abc123 con tu URL real)
echo "PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/webhook/apollo" >> .env

# Ejecuta el script
npx tsx src/test-with-phone.ts https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276/
```

## 🎬 Ejemplo Completo Paso a Paso

```bash
# 1. Instalar ngrok (solo una vez)
brew install ngrok

# 2. Configurar authtoken (solo una vez)
ngrok config add-authtoken tu_authtoken_aqui

# 3. Abrir una terminal nueva e iniciar ngrok
ngrok http 3000

# 4. En tu terminal original, copiar la URL de ngrok y ejecutar:
PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/webhook/apollo npx tsx src/test-with-phone.ts https://www.linkedin.com/in/jeronimo-horta-scherpf-920036276/
```

## ⚠️ Importante

1. **Mantén ngrok corriendo**: Mientras usas el script, ngrok debe estar abierto
2. **La URL cambia**: Cada vez que reinicias ngrok, la URL cambia (debes actualizarla en .env)
3. **No todos tienen teléfono**: Apollo solo tiene teléfonos para algunos perfiles
4. **Puede tardar**: El webhook puede tardar 30-60 segundos

## 🔍 ¿Cómo saber si funcionó?

Deberías ver en los logs:

```
🌐 Webhook server running on port 3000
📡 Webhook URL: https://abc123.ngrok.io/webhook/apollo
[Apollo] Requesting enrichment with webhook: true
[Apollo] Waiting for webhook data...
[Webhook] Received data from Apollo:
[Apollo] ✓ Phone number received via webhook

✅ ¡Número de teléfono obtenido exitosamente!
📞 Teléfono:           +56 9 1234 5678
```

## 🚫 Si no obtienes el teléfono

Puede ser porque:

1. **El perfil no tiene teléfono en Apollo**: No todos los perfiles tienen teléfono
2. **ngrok no está corriendo**: Verifica que veas "Forwarding" en la terminal de ngrok
3. **URL incorrecta**: Verifica que la URL en .env coincida con la de ngrok
4. **Timeout**: Apollo puede tardar más de 30 segundos (poco común)

## 💡 Alternativa: Sin ngrok (solo datos básicos)

Si no quieres configurar ngrok, puedes usar:

```bash
npx tsx src/test-single.ts https://www.linkedin.com/in/username
```

Obtienes todo EXCEPTO el teléfono. Es más rápido y no requiere configuración.

## 🆘 Ayuda Rápida

**Error: "Webhook URL is not a valid HTTPS URL"**
- ngrok no está corriendo o la URL en .env es incorrecta

**Error: "Port 3000 already in use"**
```bash
# Usa otro puerto
WEBHOOK_PORT=3001 npx tsx src/test-with-phone.ts <url>
# Y en ngrok:
ngrok http 3001
```

**Error: "Webhook timeout"**
- El perfil probablemente no tiene teléfono en Apollo
- O Apollo no pudo acceder a tu webhook

## 📚 Más Información

- [WEBHOOK-GUIDE.md](./WEBHOOK-GUIDE.md) - Guía detallada de webhooks
- [setup-ngrok.md](./setup-ngrok.md) - Configuración completa de ngrok
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Resumen técnico completo
