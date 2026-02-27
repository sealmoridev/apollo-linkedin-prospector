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
const logoMRP = chrome.runtime.getURL('assets/mrprospect-logo.png');

// Interfaz HTML del Widget
const widgetHTML = `
  <div id="apolloWidgetTrigger" class="ap-trigger">
    <img src="${logo48}" alt="MR Prospect">
    <span>MR Prospect</span>
  </div>

  <div id="apolloWidgetPanel" class="apollo-prospector-widget">
    <div class="ap-header">
      <div class="ap-header-user">
        <div id="apHeaderAvatar" class="ap-header-avatar">
          <img src="${logo48}" id="apHeaderAvatarImg" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:none;" referrerpolicy="no-referrer">
          <span id="apHeaderAvatarInitial" style="font-size:14px;font-weight:700;">M</span>
        </div>
        <div class="ap-header-user-info">
          <div id="apHeaderName" class="ap-header-name">MR Prospect</div>
          <div id="apHeaderEmail" class="ap-header-email">Cargando...</div>
        </div>
      </div>
      <button id="apCloseBtn" class="ap-close-btn">×</button>
    </div>

    <div class="ap-body">

      <!-- ONBOARDING — se muestra si no hay API Key configurada -->
      <div id="apOnboarding" class="ap-onboarding" style="display:none;">
        <div class="ap-ob-brand">
          <div class="ap-ob-logo-ring">
            <img src="${logo48}" alt="MR Prospect" class="ap-ob-logo-img">
          </div>
          <span class="ap-ob-brand-name">MR Prospect</span>
        </div>
        <div class="ap-ob-copy">
          <h2 class="ap-ob-title">¡Bienvenido!</h2>
          <p class="ap-ob-subtitle">Ingresa la clave de tu empresa para comenzar a prospectar en LinkedIn.</p>
        </div>
        <div class="ap-ob-field-wrap">
          <div class="ap-ob-input-group">
            <input type="password" id="apOnboardingKey" class="ap-ob-input" placeholder="mrp_••••••••••••" autocomplete="off" spellcheck="false">
            <button type="button" id="apObToggle" class="ap-ob-toggle" title="Mostrar/ocultar">
              <svg id="apObEye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          <p class="ap-ob-hint">Obtenla en el backoffice → <button type="button" id="apObOptionsLink" class="ap-ob-link">Configuración</button></p>
        </div>
        <button id="apOnboardingBtn" class="ap-ob-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
          Comenzar
        </button>
        <p id="apObError" class="ap-ob-error"></p>
      </div>

      <!-- Sección de Auth -->
      <div id="apAuthSection" class="ap-auth-section">

        <!-- Profile Card (visible cuando conectado) -->
        <div id="apProfileCard" class="ap-profile-card" style="display:none;">

          <!-- Fila empresa -->
          <div class="ap-pc-top-row">
            <div id="apPcCompanyLogo" class="ap-pc-company-logo-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </div>
            <span id="apPcCompanyName" class="ap-pc-company-name">—</span>
            <button id="apPcSettingsBtn" class="ap-pc-settings-btn" title="Opciones">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>

          <!-- Separador -->
          <div class="ap-pc-inner-sep"></div>

          <!-- Fila sheet -->
          <div class="ap-pc-sheet-row" id="apPcSheetRow">
            <div class="ap-pc-sheet-info">
              <div class="ap-pc-sheet-top-line">
                <div id="apPcSheetName" class="ap-pc-sheet-name-big">—</div>
                <a id="apPcSheetLink" href="#" target="_blank" class="ap-pc-sheet-link" style="display:none;" title="Abrir Google Sheets">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
              </div>
              <div id="apPcSheetLabel" class="ap-pc-sheet-label" style="display:none;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>Sheet Sincronizada</span>
              </div>
              <div id="apPcSheetHint" class="ap-pc-sheet-hint" style="display:none;">Falta seleccionar tu Base Google Sheet · <button type="button" id="apPcHintOptionsBtn" class="ap-pc-hint-link">Ir a Opciones</button></div>
            </div>
          </div>

        </div>

        <!-- Estado desconectado / cargando -->
        <div class="ap-auth-disconnect-wrap">
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
      </div>

      <!-- PASO 1: Extracción -->
      <div id="apExtractSection" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="ap-card">
          <div class="ap-card-label">Perfil a extraer:</div>
          <div id="apCurrentUrl" class="ap-card-value">...</div>
        </div>

        <button id="apExtractBtn" class="ap-btn-primary" disabled>
          <span class="ap-btn-text" style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</span>
          <span id="apExtractLoader" class="ap-loader"></span>
        </button>
      </div>

      <!-- PASO 2: Pre-visualización y Guardado -->
      <div id="apPreviewSection" class="ap-preview-section">
        
        <div class="ap-card" style="background-color: #ffffff; padding: 0; overflow: hidden; border-color: #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid rgba(226, 232, 240, 0.8); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <svg style="width:14px; height:14px; stroke-width:2.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Prospecto Extraído
            </div>
            <button id="apCopyDataBtn" class="ap-icon-btn" title="Copiar Datos" style="background: none; border: none; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 6px; transition: all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div class="ap-data-row-modern">
                <div class="ap-data-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
                <div class="ap-data-content">
                    <div class="ap-data-label-modern">Nombre</div>
                    <div class="ap-data-value-modern" id="apDataName"></div>
                </div>
            </div>
            <div class="ap-data-row-modern">
                <div class="ap-data-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
                <div class="ap-data-content">
                    <div class="ap-data-label-modern">Título y Empresa</div>
                    <div class="ap-data-value-modern" id="apDataTitleCompany"></div>
                </div>
            </div>
            <div class="ap-data-row-modern">
                <div class="ap-data-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div>
                <div class="ap-data-content" style="flex:1; min-width: 0;">
                    <div class="ap-data-label-modern" id="apDataEmailTitle">Email</div>
                    <div id="apEmailControlsContainer" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div class="ap-data-value-modern" id="apDataEmail" style="word-break: break-all; flex:1;"></div>
                        <button id="apValidateEmailBtn" class="ap-btn-validate" style="display: none;">Validar</button>
                        <div id="apEmailBadge" class="ap-badge" style="display: none;"></div>
                    </div>
                </div>
            </div>
            <div class="ap-data-row-modern">
                <div class="ap-data-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div>
                <div class="ap-data-content" style="flex:1; min-width:0;">
                    <div class="ap-data-label-modern">Teléfono</div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div class="ap-data-value-modern" id="apDataPhone" style="flex:1;"></div>
                        <button id="apRequestPhoneBtn" class="ap-btn-validate" style="display: none;"></button>
                        <div id="apPhoneBadge" class="ap-badge" style="display: none;"></div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <button id="apSaveBtn" class="ap-btn-primary">
          <span class="ap-save-btn-text" style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</span>
          <span id="apSaveLoader" class="ap-loader"></span>
        </button>
        
        <button id="apCancelBtn" class="ap-btn-cancel">
          <div style="display:flex; align-items:center; justify-content:center; gap:4px;"><svg style="width:14px; height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</div>
        </button>
      </div>

      <!-- Mensajes de Resultado -->
      <div id="apResultDiv" class="ap-result-message"></div>
    </div>

    <div class="ap-footer">
      <div class="ap-footer-brand">
        <img src="${logo48}" class="ap-footer-icon" alt="">
        <span>MR Prospect</span>
      </div>
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
    const disconnectWrap = document.querySelector('.ap-auth-disconnect-wrap');

    const extractSection = document.getElementById('apExtractSection');
    const previewSection = document.getElementById('apPreviewSection');

    const currentUrlEl = document.getElementById('apCurrentUrl');
    const validateEmailBtn = document.getElementById('apValidateEmailBtn');
    const emailBadge = document.getElementById('apEmailBadge');
    const requestPhoneBtn = document.getElementById('apRequestPhoneBtn');

    const extractBtn = document.getElementById('apExtractBtn');
    const extractBtnText = extractBtn.querySelector('.ap-btn-text');
    const extractLoader = document.getElementById('apExtractLoader');

    const saveBtn = document.getElementById('apSaveBtn');
    const saveBtnText = saveBtn.querySelector('.ap-save-btn-text');
    const saveLoader = document.getElementById('apSaveLoader');
    const cancelBtn = document.getElementById('apCancelBtn');

    const resultDiv = document.getElementById('apResultDiv');

    const optionsLink = document.getElementById('apOptionsLink');

    // Header user elements
    const headerAvatarImg = document.getElementById('apHeaderAvatarImg');
    const headerAvatarInitial = document.getElementById('apHeaderAvatarInitial');
    const headerName = document.getElementById('apHeaderName');
    const headerEmail = document.getElementById('apHeaderEmail');

    // Profile card elements
    const profileCard = document.getElementById('apProfileCard');
    const pcCompanyName = document.getElementById('apPcCompanyName');
    const pcCompanyLogo = document.getElementById('apPcCompanyLogo');
    const pcSettingsBtn = document.getElementById('apPcSettingsBtn');
    const pcSheetName = document.getElementById('apPcSheetName');
    const pcSheetHint = document.getElementById('apPcSheetHint');
    const pcSheetLink = document.getElementById('apPcSheetLink');
    const pcSheetLabel = document.getElementById('apPcSheetLabel');

    pcSettingsBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
    document.getElementById('apPcHintOptionsBtn').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
    optionsLink.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));

    // Onboarding elements
    const onboardingSection = document.getElementById('apOnboarding');
    const onboardingInput = document.getElementById('apOnboardingKey');
    const onboardingBtn = document.getElementById('apOnboardingBtn');
    const onboardingError = document.getElementById('apObError');
    const obToggle = document.getElementById('apObToggle');
    const obEye = document.getElementById('apObEye');
    const obOptionsLink = document.getElementById('apObOptionsLink');

    // Estado Interno
    let currentLinkedinUrl = window.location.href;
    let currentSesionId = crypto.randomUUID(); // UUID único por perfil visitado (solo en RAM)
    let apiUrl = 'https://mrprospect.app';
    let tenantApiKey = '';
    let isAuthenticated = false;
    let extractedLeadData = null; // Almacenamos los datos en memoria antes de guardar
    let hasExtractedCurrentProfile = false; // Bandera para State 3

    // --- ONBOARDING ---

    const showOnboarding = () => {
        onboardingSection.style.display = 'flex';
        authSection.style.display = 'none';
        extractSection.style.display = 'none';
        previewSection.style.display = 'none';
    };

    const hideOnboarding = () => {
        onboardingSection.style.display = 'none';
    };

    // Toggle show/hide key
    obToggle.addEventListener('click', () => {
        const hidden = onboardingInput.type === 'password';
        onboardingInput.type = hidden ? 'text' : 'password';
        obEye.innerHTML = hidden
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    });

    // Open options from onboarding hint
    obOptionsLink.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    });

    // Save key from onboarding
    onboardingBtn.addEventListener('click', async () => {
        const key = onboardingInput.value.trim();
        if (!key) {
            onboardingError.textContent = 'Ingresa la API Key para continuar.';
            return;
        }
        onboardingError.textContent = '';
        onboardingBtn.disabled = true;
        onboardingBtn.innerHTML = '<span class="ap-loader" style="display:inline-block;border-color:#fff transparent transparent;width:14px;height:14px;margin-right:8px;"></span>Verificando...';

        await chrome.storage.sync.set({ tenantApiKey: key });
        tenantApiKey = key;
        onboardingBtn.disabled = false;
        onboardingBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>Comenzar';
        hideOnboarding();
        await checkAuthStatus();
    });

    // Allow Enter key in the onboarding input
    onboardingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onboardingBtn.click();
    });

    // --- FUNCIONES UI GENERALES ---

    const showMessage = (msgHtml, isError = false) => {
        const icon = isError
            ? '<svg style="width:14px; height:14px; margin-right:4px; vertical-align:-2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
            : '<svg style="width:14px; height:14px; margin-right:4px; vertical-align:-2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

        resultDiv.innerHTML = `${icon} ${msgHtml}`;
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

        // Resetear botones en caso de estar pegados
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
            saveLoader.style.display = 'none';
        }
        if (cancelBtn) cancelBtn.disabled = false;

        updateUrlDisplay(); // Forzar actualización visual al volver al paso 1
        clearMessage();
    };

    const showPreviewState = (leadData) => {
        extractSection.style.display = 'none';
        previewSection.style.display = 'flex';
        extractedLeadData = leadData;

        // Populate card
        document.getElementById('apDataName').textContent = leadData.fullName || leadData.firstName || 'Sin nombre';
        const titleStr = leadData.title || 'Sin título';
        const companyStr = leadData.company || 'Sin empresa';
        document.getElementById('apDataTitleCompany').textContent = `${titleStr} - ${companyStr}`;

        const emailsRaw = [leadData.email, leadData.personalEmail].filter(Boolean).join(', ');
        const emailsList = emailsRaw ? emailsRaw.split(',').map(e => e.trim()).filter(Boolean) : [];
        const emailContainer = document.getElementById('apDataEmail');
        const emailTitle = document.getElementById('apDataEmailTitle');
        // The controlsContainer is no longer needed as elements are moved directly into emailContainer or its children
        // const controlsContainer = document.getElementById('apEmailControlsContainer');
        emailContainer.innerHTML = ''; // Clear previous

        if (emailsList.length === 0) {
            emailTitle.innerHTML = 'Email';
            emailContainer.textContent = 'Sin email';
            extractedLeadData.primaryEmail = null;
        } else if (emailsList.length === 1) {
            emailTitle.innerHTML = 'Email';
            emailContainer.textContent = emailsList[0];
            extractedLeadData.primaryEmail = emailsList[0];
            // Asegurar que validación vuelva a su lugar por defecto
            const controlsContainer = document.getElementById('apEmailControlsContainer');
            if (controlsContainer) {
                controlsContainer.appendChild(validateEmailBtn);
                controlsContainer.appendChild(emailBadge);
            }
        } else {
            // Multiple emails - Create radio buttons (force selection)
            emailTitle.innerHTML = '<span id="apEmailTitleHint" style="color:#9941c0;">Selecciona Email Principal</span>';
            extractedLeadData.primaryEmail = null;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'ap-email-radio-group';

            emailsList.forEach((email, index) => {
                const label = document.createElement('label');
                label.className = 'ap-email-radio-label unselected-pulse';

                // Top row: Radio + Text
                const topRow = document.createElement('div');
                topRow.style.display = 'flex';
                topRow.style.alignItems = 'center';
                topRow.style.gap = '8px';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'apPrimaryEmail';
                radio.className = 'ap-email-radio-input';
                radio.value = email;
                // Ninguno pre-seleccionado

                const textSpan = document.createElement('span');
                textSpan.textContent = email;
                textSpan.style.flex = '1';
                textSpan.style.wordBreak = 'break-all';

                const primaryCheck = document.createElement('span');
                primaryCheck.className = 'ap-primary-check';
                primaryCheck.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#9941c0" stroke="#9941c0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
                primaryCheck.style.display = 'none';

                topRow.appendChild(radio);
                topRow.appendChild(textSpan);
                topRow.appendChild(primaryCheck);
                label.appendChild(topRow);

                // Bottom row: Button + Notes
                const bottomRow = document.createElement('div');
                bottomRow.className = 'ap-email-bottom-row';
                bottomRow.style.display = 'none'; // Hidden entirely to save space before selection
                bottomRow.style.alignItems = 'center';
                bottomRow.style.gap = '8px';
                bottomRow.style.marginTop = '4px';

                const noteSpan = document.createElement('span');
                noteSpan.className = 'ap-email-note';
                noteSpan.style.fontSize = '11px';
                noteSpan.style.color = '#64748b';
                noteSpan.textContent = 'Se guardará en notas';
                noteSpan.style.display = 'none'; // ocultar por defecto hasta que haya selección
                bottomRow.appendChild(noteSpan);

                label.appendChild(bottomRow);
                groupDiv.appendChild(label);

                radio.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        extractedLeadData.primaryEmail = e.target.value;
                        extractedLeadData.emailStatus = 'Sin verificar'; // Reset validation status for new selection

                        // Ocultar el hint del Email Title reinstaurando el texto base
                        const hint = document.getElementById('apEmailTitleHint');
                        if (hint) emailTitle.innerHTML = 'Email';

                        // Limpiar todas las filas
                        document.querySelectorAll('.ap-email-radio-label').forEach(lbl => {
                            lbl.classList.remove('unselected-pulse');
                            lbl.classList.remove('selected');

                            const check = lbl.querySelector('.ap-primary-check');
                            if (check) check.style.display = 'none';

                            const bRow = lbl.querySelector('.ap-email-bottom-row');
                            if (bRow) bRow.style.display = 'flex'; // show for notes/buttons

                            const note = lbl.querySelector('.ap-email-note');
                            if (note) note.style.display = 'inline'; // todos muestran la nota
                        });

                        label.classList.add('selected');

                        // Show check on selected
                        primaryCheck.style.display = 'inline-flex';

                        // Ocultar nota en el seleccionado
                        noteSpan.style.display = 'none';

                        // Mover el botón Validar aquí mismo
                        bottomRow.appendChild(validateEmailBtn);
                        bottomRow.appendChild(emailBadge);

                        // Habilitar Validar
                        if (emailBadge) emailBadge.style.display = 'none';
                        if (validateEmailBtn) {
                            validateEmailBtn.style.display = 'flex';
                            validateEmailBtn.disabled = false;
                            validateEmailBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Validar';
                        }

                        // Habilitar Guardar
                        if (saveBtn) {
                            saveBtn.disabled = false;
                        }
                    }
                });
            });
            emailContainer.appendChild(groupDiv);

            // Ocultar la zona global de "Validar" si son múltiples inicialmente
            validateEmailBtn.style.display = 'none';
            emailBadge.style.display = 'none';
        }

        // Phone: show if Apollo returned it, else offer "Solicitar" button
        const phoneEl = document.getElementById('apDataPhone');
        const phBadge = document.getElementById('apPhoneBadge');
        if (leadData.phoneNumber) {
            phoneEl.textContent = leadData.phoneNumber;
            if (requestPhoneBtn) requestPhoneBtn.style.display = 'none';
            if (phBadge) phBadge.style.display = 'none';
        } else {
            phoneEl.textContent = '—';
            if (phBadge) phBadge.style.display = 'none';
            if (requestPhoneBtn) {
                requestPhoneBtn.style.display = 'flex';
                requestPhoneBtn.disabled = false;
                requestPhoneBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Solicitar';
            }
        }

        // Initial setup for Validate and Save buttons based on if there is a primary email
        if (extractedLeadData.primaryEmail && validateEmailBtn && emailBadge) {
            validateEmailBtn.style.display = 'flex';
            validateEmailBtn.disabled = false;
            validateEmailBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Validar';
            emailBadge.style.display = 'none';
        } else if (validateEmailBtn && emailBadge) {
            // Either no emails at all, or multiple awaiting selection
            validateEmailBtn.style.display = 'none';
            emailBadge.style.display = 'none';
        }

        if (!extractedLeadData.primaryEmail && emailsList.length > 1 && saveBtn) {
            saveBtn.disabled = true;
            // Removed custom text to avoid breaking default button layout/SVG
        }
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

    // --- DETECCIÓN DE URL Y ESTADOS ---
    const updateUrlDisplay = () => {
        currentLinkedinUrl = window.location.href;
        const cardParent = currentUrlEl.parentElement;

        // Reset base class
        cardParent.className = 'ap-card';

        if (hasExtractedCurrentProfile) {
            // State 3: Already Extracted
            cardParent.classList.add('ap-state-info');
            currentUrlEl.innerHTML = '<div class="ap-state-icon-box" style="color:#2563eb;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></div> Perfil guardado. Navega a otro.';
            extractBtn.disabled = true;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Extraído</div>';
        } else if (currentLinkedinUrl.includes('linkedin.com/in/')) {
            // State 2: Ready
            cardParent.classList.add('ap-state-success');

            // Intentar buscar el nombre en el DOM de LinkedIn de forma ligera
            let prospectName = 'Prospecto';
            const nameEl = document.querySelector('h1.text-heading-xlarge');
            if (nameEl && nameEl.innerText) {
                // Remove pronouns if any (e.g. "Juan Perez (He/Him)" -> "Juan Perez")
                prospectName = nameEl.innerText.split('(')[0].trim();
            }

            currentUrlEl.innerHTML = `<div class="ap-state-icon-box" style="color:#16a34a;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div> ¿Extraer a ${prospectName}?`;
            extractBtn.disabled = !isAuthenticated;

            // Restore default extract button text
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
        } else {
            // State 1: Warning (Not on LinkedIn Profile)
            cardParent.classList.add('ap-state-warning');
            currentUrlEl.innerHTML = '<div class="ap-state-icon-box" style="color:#ea580c;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg></div> Abre un perfil de LinkedIn';
            extractBtn.disabled = true;

            // Restore default extract button text
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
        }
    };

    updateUrlDisplay();

    setInterval(() => {
        if (currentLinkedinUrl !== window.location.href) {
            currentLinkedinUrl = window.location.href;
            currentSesionId = crypto.randomUUID(); // Nuevo perfil → nueva sesión
            hasExtractedCurrentProfile = false; // Reset lock when URL changes
            updateUrlDisplay();
            resetToExtractState(); // Al cambiar de página, volver al estado 1
        }
    }, 1000);

    // --- AUTHENTICATION & SHEETS ---

    const checkAuthStatus = async () => {
        // Guard: el widget puede haber sido eliminado por la navegación SPA de LinkedIn
        if (!document.getElementById('apolloWidgetPanel')) return;

        try {
            // Si el contexto de la extensión fue invalidado (ej. recarga de la extensión)
            // chrome.storage deja de estar disponible
            if (!chrome?.storage?.sync) {
                profileCard.style.display = 'none';
                authSection.style.display = 'block';
                disconnectWrap.style.display = 'block';
                authStatusText.style.display = 'block';
                authStatusText.innerHTML = '⚠️ Recarga la página para reconectar';
                authStatusText.className = 'ap-auth-status disconnected';
                loginBtn.style.display = 'none';
                extractBtn.disabled = true;
                return;
            }

            authStatusText.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#0f172a transparent transparent transparent; width:12px; height:12px; margin-right: 4px;"></span> Conectando...';
            // Desactiva el botón de login durante la carga para evitar spam
            loginBtn.style.display = 'none';

            const result = await chrome.storage.sync.get(['apiUrl', 'tenantApiKey']);
            if (result.apiUrl) {
                apiUrl = result.apiUrl.replace(/\/$/, "");
            }
            if (result.tenantApiKey) tenantApiKey = result.tenantApiKey;

            // Verificar que la clave de empresa esté configurada
            if (!tenantApiKey) {
                showOnboarding();
                return;
            }

            // Key presente: ocultar onboarding y asegurar que las secciones principales estén visibles
            hideOnboarding();
            extractSection.style.display = 'flex';

            const statusUrl = `${apiUrl}/api/auth/status?userId=${userId}${tenantApiKey ? '&apiKey=' + encodeURIComponent(tenantApiKey) : ''}`;
            const response = await fetch(statusUrl);
            if (!response.ok) {
                throw new Error(`Servidor respondió con ${response.status}`);
            }
            const data = await response.json();

            isAuthenticated = data.authenticated;
            authSection.style.display = 'block';
            loginBtn.onclick = null;

            if (isAuthenticated) {
                const storageConfig = await chrome.storage.sync.get(['defaultSheetId', 'defaultSheetName']);
                const hasDefaultSheet = storageConfig && storageConfig.defaultSheetId;

                // — Poblar header con perfil de usuario —
                const gp = data.googleProfile;
                const emp = data.empresa;

                if (gp?.avatar_url) {
                    headerAvatarImg.src = gp.avatar_url;
                    headerAvatarImg.style.display = 'block';
                    headerAvatarInitial.style.display = 'none';
                } else {
                    headerAvatarInitial.textContent = (gp?.nombre || gp?.email || 'M').charAt(0).toUpperCase();
                }
                headerName.textContent = gp?.nombre || 'MR Prospect';
                headerEmail.textContent = (gp?.email || '').replace('@mrprospect.local', ' ·  reconecta Google');

                // — Poblar profile card —
                // Empresa
                pcCompanyName.textContent = emp?.nombre || '—';
                if (emp?.logo_url) {
                    pcCompanyLogo.innerHTML = `<img src="${emp.logo_url}" style="width:36px;height:36px;border-radius:8px;object-fit:contain;">`;
                }

                // Sheet
                if (hasDefaultSheet && storageConfig.defaultSheetId !== 'NEW_SHEET') {
                    pcSheetName.textContent = storageConfig.defaultSheetName || 'Hoja vinculada';
                    pcSheetName.className = 'ap-pc-sheet-name-big ap-pc-sheet-ok';
                    pcSheetHint.style.display = 'none';
                    pcSheetLabel.style.display = 'flex';
                    pcSheetLink.href = `https://docs.google.com/spreadsheets/d/${storageConfig.defaultSheetId}/edit`;
                    pcSheetLink.style.display = 'flex';
                } else {
                    pcSheetName.textContent = '¡Falta tu base de datos!';
                    pcSheetName.className = 'ap-pc-sheet-name-big ap-pc-sheet-warn';
                    pcSheetHint.style.display = 'block';
                    pcSheetLabel.style.display = 'none';
                    pcSheetLink.style.display = 'none';
                }

                profileCard.style.display = 'flex';
                disconnectWrap.style.display = 'none';

                if (currentLinkedinUrl.includes('linkedin.com/in/')) extractBtn.disabled = false;

            } else {
                // NO autenticado
                profileCard.style.display = 'none';
                disconnectWrap.style.display = 'block';
                authStatusText.style.display = 'block';
                authStatusText.innerHTML = '<svg class="indicator" style="width:14px; height:14px; margin-right:4px; vertical-align:-2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Conecta tu cuenta Google';
                authStatusText.className = 'ap-auth-status disconnected';
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
            profileCard.style.display = 'none';
            authSection.style.display = 'block';
            disconnectWrap.style.display = 'block';
            authStatusText.style.display = 'block';
            authStatusText.innerHTML = '<svg class="indicator" style="width:14px; height:14px; margin-right:4px; vertical-align:-2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> API Desconectada o Despertando';
            authStatusText.className = 'ap-auth-status disconnected';
            extractBtn.disabled = true;

            loginBtn.innerHTML = '🔄 Reintentar Conexión';
            loginBtn.style.display = 'flex';
            loginBtn.onclick = () => checkAuthStatus();
        }
    };

    await checkAuthStatus();

    // Detectar cuando el usuario vuelve a la pestaña de LinkedIn (probablemente después de loguearse en Google)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAuthStatus().catch(() => {}); // Silenciar errores en refresco pasivo
        }
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
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': tenantApiKey,
                    'x-google-id': userId
                },
                body: JSON.stringify({
                    linkedinUrl: currentLinkedinUrl,
                    includePhone: false,
                    userId: userId,
                    sesion_id: currentSesionId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fallo de conexión al Servidor');
            }

            if (data.success && data.data) {
                showPreviewState(data.data);
            }
        } catch (error) {
            console.error('Extraction error:', error);
            showMessage(`Error extractivo: ${error.message} `, true);
        } finally {
            extractBtn.disabled = false;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
            extractLoader.style.display = 'none';
        }
    });

    // --- ACCIÓN: CELULAR Y COPIAR ---
    cancelBtn.addEventListener('click', resetToExtractState);

    const copyBtn = document.getElementById('apCopyDataBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!extractedLeadData) return;
            const textToCopy = [
                extractedLeadData.fullName || extractedLeadData.firstName || 'Sin nombre',
                extractedLeadData.primaryEmail || 'Sin email',
                extractedLeadData.title || 'Sin título',
                extractedLeadData.company || 'Sin empresa',
                extractedLeadData.phoneNumber || 'Sin teléfono'
            ].join('\t');

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 2000);
            }).catch(err => console.error('Error copiando:', err));
        });
    }

    if (validateEmailBtn) {
        validateEmailBtn.addEventListener('click', async () => {
            if (!extractedLeadData) return;
            // Get the explicitly selected primary email to validate
            const emailToVerify = extractedLeadData.primaryEmail;
            if (!emailToVerify) return;

            validateEmailBtn.disabled = true;
            validateEmailBtn.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#334155 transparent transparent transparent; width:12px; height:12px; margin-right: 4px;"></span>...';

            try {
                const response = await fetch(`${apiUrl}/api/verify-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': tenantApiKey,
                        'x-google-id': userId
                    },
                    body: JSON.stringify({ email: emailToVerify, sesion_id: currentSesionId })
                });

                const data = await response.json();

                validateEmailBtn.style.display = 'none';
                emailBadge.style.display = 'inline-flex';

                if (data.status === 'valid') {
                    emailBadge.className = 'ap-badge ap-badge-valid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Válido';
                } else if (data.status === 'invalid') {
                    emailBadge.className = 'ap-badge ap-badge-invalid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Inválido';
                } else if (data.status === 'catch_all') {
                    emailBadge.className = 'ap-badge ap-badge-catchall';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg> Catch-All';
                } else {
                    emailBadge.className = 'ap-badge ap-badge-unknown';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg> Error/Desc';
                }

                // Attach to memory model for Google Sheets passing
                extractedLeadData.emailStatus = data.status;

            } catch (err) {
                console.error('Validation error:', err);
                validateEmailBtn.disabled = false;
                validateEmailBtn.innerHTML = 'Reintentar';
            }
        });
    }

    // --- ACCIÓN: SOLICITAR TELÉFONO (PASO 2) ---
    if (requestPhoneBtn) {
        requestPhoneBtn.addEventListener('click', async () => {
            if (!extractedLeadData) return;
            requestPhoneBtn.disabled = true;
            requestPhoneBtn.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#334155 transparent transparent transparent; width:12px; height:12px; margin-right: 4px;"></span>...';

            try {
                const response = await fetch(`${apiUrl}/api/enrich-phone`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': tenantApiKey,
                        'x-google-id': userId
                    },
                    body: JSON.stringify({
                        linkedinUrl: currentLinkedinUrl,
                        sesion_id: currentSesionId
                    })
                });

                if (response.ok) {
                    requestPhoneBtn.style.display = 'none';
                    const phBadge = document.getElementById('apPhoneBadge');
                    if (phBadge) {
                        phBadge.style.display = 'inline-flex';
                        phBadge.className = 'ap-badge ap-badge-catchall';
                        phBadge.innerHTML = '<svg style="width:12px; height:12px; margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Enviado';
                    }
                    document.getElementById('apDataPhone').textContent = 'Pendiente de webhook...';
                } else {
                    throw new Error('Error en la solicitud');
                }
            } catch (err) {
                console.error('Phone request error:', err);
                requestPhoneBtn.disabled = false;
                requestPhoneBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Reintentar';
                showMessage('Error al solicitar teléfono', true);
            }
        });
    }

    // --- ACCIÓN: GUARDAR EN SHEETS (PASO 2) ---
    saveBtn.addEventListener('click', async () => {
        if (!extractedLeadData) return;

        const storageConfig = await chrome.storage.sync.get(['defaultSheetId', 'defaultSheetName']);
        const selectedSheetId = storageConfig.defaultSheetId;

        if (!selectedSheetId) {
            showMessage('Por favor configura una hoja destino en Opciones primero.', true);
            return;
        }

        const customSheetName = storageConfig.defaultSheetName ||
            (selectedSheetId === 'NEW_SHEET' ? 'Apollo Prospector Leads' : undefined);

        // Calculate secondary emails to pass to backend securely
        const emailsRaw = [extractedLeadData.email, extractedLeadData.personalEmail].filter(Boolean).join(', ');
        const allEmails = emailsRaw ? emailsRaw.split(',').map(e => e.trim()).filter(Boolean) : [];
        const secondaryEmails = allEmails.filter(e => e !== extractedLeadData.primaryEmail);
        extractedLeadData.secondaryEmails = secondaryEmails.join(', ');

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
                    sheetName: customSheetName,
                    sesion_id: currentSesionId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fallo al guardar en Sheets');
            }

            if (data.success) {
                // Si acabamos de crear una hoja nueva, obtener y guardar el id persistente
                if (data.spreadsheetId && selectedSheetId === 'NEW_SHEET') {
                    await chrome.storage.sync.set({ defaultSheetId: data.spreadsheetId });
                    // Hacemos que aparezca el link en vivo
                    checkAuthStatus();
                }

                // Restaurar estado del botón antes de ocultar
                saveBtn.disabled = false;
                saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
                saveLoader.style.display = 'none';
                cancelBtn.disabled = false;

                // Marcar que este perfil ya se extrajo para activar la UI Azul
                hasExtractedCurrentProfile = true;

                // Volver al paso 1 inmediatamente
                resetToExtractState();

                // Limpiamos el mensaje flotante porque la UI azul es auto-explicativa
                clearMessage();
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Save error:', error);
            showMessage(`Error guardando: ${error.message} `, true);
            saveBtn.disabled = false;
            saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
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
