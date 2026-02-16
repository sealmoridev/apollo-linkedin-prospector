# Configuración de Webhook con ngrok

Para obtener números de teléfono de Apollo.io, necesitas exponer tu servidor webhook públicamente. La forma más fácil para desarrollo es usar **ngrok**.

## Opción 1: Usar ngrok (Recomendado para desarrollo)

### 1. Instalar ngrok

**macOS:**
```bash
brew install ngrok
```

**Otras plataformas:**
Descarga desde https://ngrok.com/download

### 2. Crear cuenta en ngrok (gratis)

1. Ve a https://dashboard.ngrok.com/signup
2. Crea una cuenta gratuita
3. Copia tu authtoken

### 3. Configurar ngrok

```bash
ngrok config add-authtoken TU_AUTHTOKEN_AQUI
```

### 4. Iniciar ngrok

En una terminal separada, ejecuta:

```bash
ngrok http 3000
```

Verás algo como:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 5. Configurar la URL pública

Copia la URL de ngrok (ej: `https://abc123.ngrok.io`) y agrégala a tu archivo `.env`:

```bash
PUBLIC_WEBHOOK_URL=https://abc123.ngrok.io/webhook/apollo
```

### 6. Probar el enriquecimiento con teléfono

```bash
npx tsx src/test-with-phone.ts https://www.linkedin.com/in/username
```

## Opción 2: Usar localtunnel (Alternativa gratuita)

### 1. Instalar localtunnel

```bash
npm install -g localtunnel
```

### 2. Iniciar localtunnel

En una terminal separada:

```bash
lt --port 3000
```

### 3. Configurar la URL

Copia la URL que te da localtunnel y agrégala a `.env`:

```bash
PUBLIC_WEBHOOK_URL=https://tu-subdominio.loca.lt/webhook/apollo
```

## Opción 3: Desplegar en producción

Para producción, despliega tu aplicación en:

- **Heroku**: Automáticamente tendrás una URL pública
- **Railway**: URL pública incluida
- **Vercel/Netlify**: Para funciones serverless
- **AWS/GCP/Azure**: Con IP pública o load balancer

Luego configura:

```bash
PUBLIC_WEBHOOK_URL=https://tu-app.herokuapp.com/webhook/apollo
```

## Verificar que el webhook funciona

1. Inicia ngrok/localtunnel
2. Ejecuta el script de prueba
3. Deberías ver en los logs:

```
🌐 Webhook server running on port 3000
📡 Webhook URL: https://abc123.ngrok.io/webhook/apollo
[Webhook] Received data from Apollo:
```

## Troubleshooting

### "Webhook timeout"
- Verifica que ngrok/localtunnel esté corriendo
- Verifica que la URL en `.env` sea correcta
- Verifica que el puerto 3000 esté disponible

### "No phone number received"
- No todos los perfiles tienen teléfono en Apollo
- Apollo puede tardar hasta 60 segundos en enviar los datos
- Verifica que tu cuenta de Apollo tenga créditos

### "Port 3000 already in use"
- Cambia el puerto en `.env`: `WEBHOOK_PORT=3001`
- Reinicia ngrok con el nuevo puerto: `ngrok http 3001`
