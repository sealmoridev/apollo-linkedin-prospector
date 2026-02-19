# 🚀 Cómo usar la Extensión de Chrome con Google Sheets (OAuth2)

¡La extensión ha sido actualizada para soportar **Cuentas Individuales por Usuario**! Esto significa que la extensión te pedirá iniciar sesión con tu cuenta de Google, y automáticamente creará un archivo nuevo de Excel en *tu* Google Drive y lo irá llenando con los leads que captures.

Sigue estos pasos para configurar la integración correctamente.

---

## 1️⃣ Configurar Google Cloud (El Backend OAuth2)

Para poder usar el inicio de sesión con Google, necesitas generar un "Client ID" y un "Client Secret" en Google Cloud.

### Paso A: Crear Pantalla de Consentimiento
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Ve a **"APIs y Servicios" > "Biblioteca"** y asegúrate de habilitar la **Google Sheets API**.
4. Ve a **"APIs y Servicios" > "Pantalla de consentimiento de OAuth"**.
5. Selecciona **Externo** y dale a "Crear" (O interno si tu correo es de empresa tipo Workspace).
6. Llena el nombre de la app (ej: Apollo Prospector) y tu correo. Abajo pon también tu correo como contacto del desarrollador.
7. Guarda y continúa. En la sección "Permisos (Scopes)", agrega `.../auth/spreadsheets`.
8. En "Usuarios de prueba", **agrega tu correo electrónico personal/empresarial**. Al estar la app en modo prueba, solo los correos que pongas aquí podrán iniciar sesión.
9. Guarda y termina.

### Paso B: Obtener Credenciales
1. En el menú izquierdo, ve a **"APIs y Servicios" > "Credenciales"**.
2. Haz clic en **"Crear Credenciales" > "ID de cliente de OAuth 2.0"**.
3. Tipo de aplicación: **Aplicación Web**.
4. Nombre: *El que prefieras*.
5. Orígenes de JavaScript autorizados: (No necesitas poner ninguno por ahora).
6. **URIs de redireccionamiento autorizados (MUY IMPORTANTE)**: 
   - Si lo pruebas localmente, pon: `http://localhost:3000/api/auth/google/callback`
   - Si usas la URL de ngrok, pon: `https://TU_URL_DE_NGROK.ngrok-free.app/api/auth/google/callback`
   - Si lo subes a Railway, pon: `https://TU_RAILWAY_URL.up.railway.app/api/auth/google/callback`
7. Dale a **"Crear"**.
8. Te aparecerá una ventana con tu **ID de cliente** (Client ID) y tu **Secreto de cliente** (Client Secret). Cópialos.

### Paso C: Actualizar Variables de Entorno (.env)
Abre tu archivo `.env` en este proyecto, y **reemplaza** las credenciales anteriores por estas nuevas:

```env
GOOGLE_CLIENT_ID="TU_ID_DE_CLIENTE_AQUI"
GOOGLE_CLIENT_SECRET="TU_SECRETO_DE_CLIENTE_AQUI"
# Elimina GOOGLE_APPLICATION_CREDENTIALS y GOOGLE_SHEETS_SPREADSHEET_ID si las tenías, ya no se usan.
```

---

## 2️⃣ Instalar la Extensión de Chrome

1. Abre Google Chrome.
2. Navega a `chrome://extensions/`.
3. Activa el **"Modo de desarrollador"** (interruptor arriba a la derecha).
4. Haz clic en **"Cargar descomprimida"** (Load unpacked).
5. Selecciona la carpeta `chrome-extension` que está dentro de este proyecto.
6. (Opcional) Si ya la tenías instalada, haz clic en la "flecha redonda" (botón de refrescar) sobre la tarjeta de la extensión para actualizar los cambios.

---

## 3️⃣ Iniciando Todo

1. **Inicia el servidor backend:**
   ```bash
   npm run dev:server
   ```

2. **Abre la Extensión en Chrome:**
   - Haz clic en el icono de Apollo Prospector.
   - Verás que dice "Google Sheets - No conectado".
   - Haz clic en el botón de **"Conectar con Google"**.
   - Se abrirá una pestaña de Google. Inicia sesión con la misma cuenta que pusiste como usuario de prueba en el Paso A.
   - Acepta la advertencia ("Google no verificó esta app" -> Haz clic en *Avanzado* -> *Ir a la App (inseguro)*).
   - Acepta los permisos de "crear, editar o borrar todas tus hojas de cálculo de Google".
   - Te aparecerá un mensaje de éxito. Ya puedes cerrar esa ventana.

3. **¡La Magia Sucede! 🪄**
   - Al iniciar sesión, el servidor automáticamente fue a tu Google Drive y creó un archivo llamado **"Apollo Prospector Leads"**, con los encabezados correspondientes pintados de gris.
   - Vuelve a la extensión, ¡ahora dirá "Conectado a Sheets"!

4. **Extrae un Perfil:**
   - Navega a un perfil de **LinkedIn**.
   - Abre la extensión, presiona **"Extraer y Guardar"**.
   - Ve a buscar el archivo "Apollo Prospector Leads" en tu Google Drive. ¡La fila estará ahí!
