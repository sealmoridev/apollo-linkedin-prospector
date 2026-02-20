// Genera o busca un User ID único
const getUserId = async () => {
    const result = await chrome.storage.local.get(['prospectorUserId']);
    if (result.prospectorUserId) return result.prospectorUserId;

    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ prospectorUserId: newId });
    return newId;
};

// URLs dinámicos de las imágenes
const logo16 = chrome.runtime.getURL('assets/icon16.png');
const logo48 = chrome.runtime.getURL('assets/icon48.png');

// Interfaz HTML del Widget
const widgetHTML = `
  <div id="apolloWidgetTrigger" class="ap-trigger">
    <img src="${logo16}" style="width: 16px; height: 16px; border-radius: 4px;" alt="MR Prospect">
    <span>MR Prospect</span>
  </div>

  <div id="apolloWidgetPanel" class="apollo-prospector-widget">
    <div class="ap-header">
      <div class="ap-header-title">
        <img src="${logo48}" class="ap-header-logo" alt="Logo" style="background: none;">
        MR Prospect
      </div>
      <button id="apCloseBtn" class="ap-close-btn">×</button>
    </div>

    <div class="ap-body">
      <!-- Sección de Auth -->
      <div id="apAuthSection" class="ap-auth-section">
        <div class="ap-auth-title">Google Sheets Sync</div>
        <div id="apAuthStatusText" class="ap-auth-status disconnected">Cargando estado...</div>
        <button id="apLoginBtn" class="ap-btn-google">
          <svg width="18" height="18" viewBox="0 0 48 48" style="margin-right: 5px;">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          Conectar con Google
        </button>
      </div>

      <!-- PASO 1: Extracción -->
      <div id="apExtractSection" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="ap-card">
          <div class="ap-card-label">Perfil a extraer:</div>
          <div id="apCurrentUrl" class="ap-card-value">...</div>
        </div>

        <div class="ap-toggle-group">
          <span class="ap-toggle-label">Incluir Teléfono (Webhook)</span>
          <label class="ap-switch">
            <input type="checkbox" id="apIncludePhone">
            <span class="ap-slider"></span>
          </label>
        </div>

        <button id="apExtractBtn" class="ap-btn-primary" disabled>
          <span class="ap-btn-text">Extraer Datos de Apollo</span>
          <span id="apExtractLoader" class="ap-loader"></span>
        </button>
      </div>

      <!-- PASO 2: Pre-visualización y Guardado -->
      <div id="apPreviewSection" class="ap-preview-section">
        
        <div class="ap-card" style="background-color: #f8fafc; border-color: #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #0f172a; text-align: center;">Datos Encontrados</div>
          <div class="ap-data-row"><span class="ap-data-label">Nombre:</span><span class="ap-data-value" id="apDataName"></span></div>
          <div class="ap-data-row"><span class="ap-data-label">Título:</span><span class="ap-data-value" id="apDataTitle"></span></div>
          <div class="ap-data-row"><span class="ap-data-label">Empresa:</span><span class="ap-data-value" id="apDataCompany"></span></div>
          <div class="ap-data-row"><span class="ap-data-label">Email:</span><span class="ap-data-value" id="apDataEmail"></span></div>
          <div class="ap-data-row"><span class="ap-data-label">Teléfono:</span><span class="ap-data-value" id="apDataPhone"></span></div>
        </div>

        <button id="apSaveBtn" class="ap-btn-primary" style="background-color: #16a34a;">
          <span class="ap-save-btn-text">Confirmar y Guardar</span>
          <span id="apSaveLoader" class="ap-loader"></span>
        </button>
        
        <button id="apCancelBtn" class="ap-btn-primary" style="background-color: white; color: #64748b; border: 1px solid #cbd5e1;">
          Cancelar
        </button>
      </div>

      <!-- Mensajes de Resultado -->
      <div id="apResultDiv" class="ap-result-message"></div>
    </div>

    <div class="ap-footer">
      <span>MR Prospect v1.1.0</span>
      <a id="apOptionsLink" class="ap-options-link">Opciones</a>
    </div>
  </div>
`;

// Inyectar HTML en la página
const injectWidget = () => {
    if (document.getElementById('apolloWidgetPanel')) return;

    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container);

    initializeWidgetLogic();
};

const initializeWidgetLogic = async () => {
    const userId = await getUserId();
    const trigger = document.getElementById('apolloWidgetTrigger');
    const panel = document.getElementById('apolloWidgetPanel');
    const closeBtn = document.getElementById('apCloseBtn');

    // UI Elements
    const authSection = document.getElementById('apAuthSection');
    const loginBtn = document.getElementById('apLoginBtn');
    const authStatusText = document.getElementById('apAuthStatusText');

    const extractSection = document.getElementById('apExtractSection');
    const previewSection = document.getElementById('apPreviewSection');

    const currentUrlEl = document.getElementById('apCurrentUrl');
    const includePhoneToggle = document.getElementById('apIncludePhone');
    const extractBtn = document.getElementById('apExtractBtn');
    const extractBtnText = extractBtn.querySelector('.ap-btn-text');
    const extractLoader = document.getElementById('apExtractLoader');

    const saveBtn = document.getElementById('apSaveBtn');
    const saveBtnText = saveBtn.querySelector('.ap-save-btn-text');
    const saveLoader = document.getElementById('apSaveLoader');
    const cancelBtn = document.getElementById('apCancelBtn');

    const resultDiv = document.getElementById('apResultDiv');
    const optionsLink = document.getElementById('apOptionsLink');

    // Estado Interno
    let currentLinkedinUrl = window.location.href;
    let apiUrl = 'http://localhost:3000';
    let isAuthenticated = false;
    let extractedLeadData = null; // Almacenamos los datos en memoria antes de guardar

    // --- FUNCIONES UI GENERALES ---

    const showMessage = (msg, isError = false) => {
        resultDiv.textContent = msg;
        resultDiv.className = isError ? 'ap-result-message ap-result-error' : 'ap-result-message ap-result-success';
        resultDiv.style.display = 'block';
    };

    const clearMessage = () => {
        resultDiv.style.display = 'none';
        resultDiv.className = 'ap-result-message';
        resultDiv.textContent = '';
    };

    const resetToExtractState = () => {
        extractSection.style.display = 'flex';
        previewSection.style.display = 'none';
        extractedLeadData = null;
        clearMessage();
    };

    const showPreviewState = (leadData) => {
        extractSection.style.display = 'none';
        previewSection.style.display = 'flex';
        extractedLeadData = leadData;

        // Populate card
        document.getElementById('apDataName').textContent = leadData.fullName || leadData.firstName || 'Sin nombre';
        document.getElementById('apDataTitle').textContent = leadData.title || 'Sin título';
        document.getElementById('apDataCompany').textContent = leadData.company || 'Sin empresa';
        document.getElementById('apDataEmail').textContent = leadData.email || leadData.personalEmail || 'Sin email';
        document.getElementById('apDataPhone').textContent = leadData.phoneNumber || (includePhoneToggle.checked ? '(Pendiente de Webhook)' : 'No solicitado');
    };

    // --- LÓGICA DE ABRIR/CERRAR ---

    trigger.addEventListener('click', () => {
        panel.classList.add('open');
        trigger.classList.add('hidden');
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        trigger.classList.remove('hidden');
    });

    // Escuchar mensajes desde el background script (ej. click en el icono de extensión)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "togglePanel") {
            const isOpen = panel.classList.contains('open');
            if (isOpen) {
                panel.classList.remove('open');
                trigger.classList.remove('hidden');
            } else {
                panel.classList.add('open');
                trigger.classList.add('hidden');
            }
        }
    });

    // --- DETECCIÓN DE URL SPAs ---
    const updateUrlDisplay = () => {
        currentLinkedinUrl = window.location.href;
        if (currentLinkedinUrl.includes('linkedin.com/in/')) {
            currentUrlEl.textContent = 'Perfil detectado automáticamente';
            currentUrlEl.style.color = '#16a34a';
        } else {
            currentUrlEl.textContent = 'Navega a un perfil para extraer';
            currentUrlEl.style.color = '#0f172a';
            extractBtn.disabled = true;
        }
    };

    updateUrlDisplay();

    setInterval(() => {
        if (currentLinkedinUrl !== window.location.href) {
            updateUrlDisplay();
            resetToExtractState(); // Al cambiar de página, volver al estado 1
            if (isAuthenticated && window.location.href.includes('linkedin.com/in/')) {
                extractBtn.disabled = false;
            }
        }
    }, 1000);

    // --- AUTHENTICATION & SHEETS ---

    const checkAuthStatus = async () => {
        try {
            authStatusText.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#0f172a transparent transparent transparent; width:12px; height:12px; margin-right: 4px;"></span> Conectando...';
            // Desactiva el botón de login durante la carga para evitar spam
            loginBtn.style.display = 'none';

            const result = await chrome.storage.sync.get(['apiUrl']);
            if (result.apiUrl) {
                // Limpiar slash final si el usuario lo puso por error
                apiUrl = result.apiUrl.replace(/\/$/, "");
            }

            const response = await fetch(`${apiUrl}/api/auth/status?userId=${userId}`);
            if (!response.ok) {
                throw new Error(`Servidor respondió con ${response.status}`);
            }
            const data = await response.json();

            isAuthenticated = data.authenticated;
            authSection.style.display = 'block';

            // Limpiar acciones previas
            loginBtn.onclick = null;

            if (isAuthenticated) {
                const storageConfig = await chrome.storage.sync.get(['defaultSheetId', 'defaultSheetName']);
                const hasDefaultSheet = storageConfig && storageConfig.defaultSheetId;

                if (!hasDefaultSheet) {
                    // Autenticado pero SIN hoja configurada
                    authStatusText.innerHTML = '<span class="indicator">⚠️</span> Falta Configurar Hoja';
                    authStatusText.className = 'ap-auth-status disconnected';

                    loginBtn.innerHTML = '⚙️ Configurar Destino en Opciones';
                    loginBtn.style.display = 'flex';
                    loginBtn.onclick = () => chrome.runtime.sendMessage({ action: "openOptionsPage" });

                    if (!currentLinkedinUrl.includes('linkedin.com/in/')) {
                        extractBtn.disabled = true;
                    } else {
                        extractBtn.disabled = false;
                    }
                } else {
                    // Autenticado y CON hoja
                    let sheetNameHtml = storageConfig.defaultSheetName || 'Tu Base de Datos';
                    if (storageConfig.defaultSheetId !== 'NEW_SHEET') {
                        sheetNameHtml = `<a href="https://docs.google.com/spreadsheets/d/${storageConfig.defaultSheetId}/edit" target="_blank" title="Abrir Base de Datos" style="color: #2563eb; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; padding-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">📄 ${sheetNameHtml} <svg style="width:12px; height:12px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`;
                    } else {
                        sheetNameHtml = `<div style="padding-top: 4px; font-weight: 600; color: #0f172a;">✨ ${sheetNameHtml} (Pendiente de Creación)</div>`;
                    }
                    authStatusText.innerHTML = `<span class="indicator">🟢</span> Enlazado a:<br>${sheetNameHtml}`;
                    authStatusText.className = 'ap-auth-status connected';
                    loginBtn.style.display = 'none';
                    if (currentLinkedinUrl.includes('linkedin.com/in/')) extractBtn.disabled = false;
                }
            } else {
                // NO autenticado
                authStatusText.innerHTML = '<span class="indicator">🔴</span> Desconectado';
                authStatusText.className = 'ap-auth-status disconnected';
                loginBtn.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 48 48" style="margin-right: 5px;">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  Conectar con Google`;
                loginBtn.style.display = 'flex';
                extractBtn.disabled = true;

                loginBtn.onclick = async () => {
                    try {
                        const res = await fetch(`${apiUrl}/api/auth/google?userId=${userId}`);
                        const d = await res.json();
                        if (d.url) window.open(d.url, '_blank');
                    } catch (err) {
                        showMessage('Error de conexión con el Servidor.', true);
                    }
                };
            }
        } catch (err) {
            console.error('Auth error in checkAuthStatus:', err);
            authSection.style.display = 'block';
            authStatusText.innerHTML = '<span class="indicator">🟠</span> API Desconectada o Despertando';
            authStatusText.className = 'ap-auth-status disconnected';
            extractBtn.disabled = true;

            loginBtn.innerHTML = '🔄 Reintentar Conexión';
            loginBtn.style.display = 'flex';
            loginBtn.onclick = async () => {
                await checkAuthStatus();
            };
        }
    };

    await checkAuthStatus();

    // Detectar cuando el usuario vuelve a la pestaña de LinkedIn (probablemente después de loguearse en Google)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAuthStatus(); // Refrescar estado de Auth silenciosamente
        }
    });

    optionsLink.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
    });



    // --- ACCIÓN: EXTRAER DATOS (PASO 1) ---

    extractBtn.addEventListener('click', async () => {
        if (!currentLinkedinUrl.includes('linkedin.com/in/')) return;

        extractBtn.disabled = true;
        extractBtnText.textContent = 'Extrayendo...';
        extractLoader.style.display = 'inline-block';
        clearMessage();

        try {
            const response = await fetch(`${apiUrl}/api/enrich`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    linkedinUrl: currentLinkedinUrl,
                    includePhone: includePhoneToggle.checked,
                    userId: userId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fallo de conexión al Servidor');
            }

            if (data.success && data.data) {
                showPreviewState(data.data);

                // --- AUTO SAVE ---
                const storageConfig = await chrome.storage.sync.get(['defaultSheetId']);
                if (storageConfig.defaultSheetId) {
                    saveBtn.click();
                }
            }
        } catch (error) {
            console.error('Extraction error:', error);
            showMessage(`Error extractivo: ${error.message} `, true);
        } finally {
            extractBtn.disabled = false;
            extractBtnText.textContent = 'Extraer Datos de Apollo';
            extractLoader.style.display = 'none';
        }
    });

    // --- ACCIÓN: CAnCELAR (VOLVER AL PASO 1) ---
    cancelBtn.addEventListener('click', resetToExtractState);

    // --- ACCIÓN: GUARDAR EN SHEETS (PASO 2) ---
    saveBtn.addEventListener('click', async () => {
        if (!extractedLeadData) return;

        const storageConfig = await chrome.storage.sync.get(['defaultSheetId', 'defaultSheetName']);
        const selectedSheetId = storageConfig.defaultSheetId;

        if (!selectedSheetId) {
            showMessage('Por favor configura una hoja destino en Opciones primero.', true);
            return;
        }

        let customSheetName = undefined;
        if (selectedSheetId === 'NEW_SHEET') {
            customSheetName = storageConfig.defaultSheetName || 'Apollo Prospector Leads';
        }

        saveBtn.disabled = true;
        saveBtnText.textContent = 'Guardando...';
        saveLoader.style.display = 'inline-block';
        cancelBtn.disabled = true;
        clearMessage();

        try {
            const response = await fetch(`${apiUrl}/api/sheets/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    spreadsheetId: selectedSheetId,
                    lead: extractedLeadData,
                    sheetName: customSheetName
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fallo al guardar en Sheets');
            }

            if (data.success) {
                showMessage('✅ ¡Lead guardado exitosamente en Google Sheets!');

                // Si acabamos de crear una hoja nueva, obtener y guardar el id persistente
                if (data.spreadsheetId && selectedSheetId === 'NEW_SHEET') {
                    await chrome.storage.sync.set({ defaultSheetId: data.spreadsheetId });
                    // Hacemos que aparezca el link en vivo
                    checkAuthStatus();
                }

                // Auto-cerrar o resetear después de 3 segundos
                setTimeout(resetToExtractState, 3000);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Save error:', error);
            showMessage(`Error guardando: ${error.message} `, true);
            saveBtn.disabled = false;
            saveBtnText.textContent = 'Confirmar y Guardar';
            saveLoader.style.display = 'none';
            cancelBtn.disabled = false;
        }
    });
};

// Iniciar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWidget);
} else {
    injectWidget();
}
