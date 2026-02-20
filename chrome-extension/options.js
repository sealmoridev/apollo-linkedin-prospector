document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DEL DOM ---
    const apiUrlInput = document.getElementById('apiUrl');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const apiMessage = document.getElementById('apiMessage');

    const authStatusText = document.getElementById('authStatusText');
    const authBtn = document.getElementById('authBtn');

    const preferencesSection = document.getElementById('preferencesSection');
    const defaultSheetSelect = document.getElementById('defaultSheetSelect');
    const defaultSheetNameInput = document.getElementById('defaultSheetNameInput');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const prefsMessage = document.getElementById('prefsMessage');

    // --- ESTADO INTERNO ---
    let currentApiUrl = 'http://localhost:3000';
    let userId = null;
    let isAuthenticated = false;

    // Utilidades UI
    const showMessage = (element, msgHtml, isError = false) => {
        element.innerHTML = msgHtml;
        element.className = `message-box ${isError ? 'msg-error' : 'msg-success'}`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 4000);
    };

    // --- INICIALIZACIÓN ---

    // 1. Obtener User ID
    const getUserId = async () => {
        const result = await chrome.storage.local.get(['prospectorUserId']);
        if (result.prospectorUserId) {
            userId = result.prospectorUserId;
        } else {
            const newId = 'user_' + Math.random().toString(36).substr(2, 9);
            await chrome.storage.local.set({ prospectorUserId: newId });
            userId = newId;
        }
    };

    // 2. Cargar config inicial
    await getUserId();
    const config = await chrome.storage.sync.get(['apiUrl', 'defaultSheetId']);

    if (config.apiUrl) {
        currentApiUrl = config.apiUrl;
        apiUrlInput.value = currentApiUrl;
    }

    // --- SECCIÓN 1: GUARDAR API URL ---
    saveApiBtn.addEventListener('click', () => {
        const urlToSave = apiUrlInput.value.trim().replace(/\/$/, "");
        if (!urlToSave) {
            showMessage(apiMessage, 'La URL no puede estar vacía', true);
            return;
        }

        chrome.storage.sync.set({ apiUrl: urlToSave }, () => {
            currentApiUrl = urlToSave;
            showMessage(apiMessage, '<div style="display:flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> URL Base guardada con éxito</div>');
            // Re-checar el estado porque la URL cambió
            checkAuthStatus();
        });
    });

    // --- SECCIÓN 2: ESTADO DE OAUTH ---
    const checkAuthStatus = async () => {
        authStatusText.innerHTML = 'Conectando con Servidor...';
        authStatusText.className = 'status-text';
        authBtn.style.display = 'none';

        // Sanitizar URL antes de usar
        if (currentApiUrl) {
            currentApiUrl = currentApiUrl.replace(/\/$/, "");
        }

        try {
            const response = await fetch(`${currentApiUrl}/api/auth/status?userId=${userId}`);

            if (!response.ok) {
                throw new Error(`Servidor respondió con ${response.status}`);
            }

            const data = await response.json();

            isAuthenticated = data.authenticated;

            // Limpiar eventos previos para evitar ejecuciones dobles si se reconecta
            authBtn.onclick = null;

            if (isAuthenticated) {
                authStatusText.innerHTML = '<div style="display:flex;align-items:center;gap:6px;"><svg class="indicator" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Conectado a Sheets (Auto-Sync)</div>';
                authStatusText.className = 'status-text connected';
                authBtn.style.display = 'none';

                // Activar Pestaña de Preferencias
                preferencesSection.style.opacity = '1';
                preferencesSection.style.pointerEvents = 'auto';
                loadSheetsList();

            } else {
                authStatusText.innerHTML = '<div style="display:flex;align-items:center;gap:6px;"><svg class="indicator" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Desconectado</div>';
                authStatusText.className = 'status-text disconnected';

                authBtn.textContent = 'Conectar con Google';
                authBtn.style.display = 'inline-flex';
                authBtn.onclick = async () => {
                    try {
                        const res = await fetch(`${currentApiUrl}/api/auth/google?userId=${userId}`);
                        const d = await res.json();
                        if (d.url) window.open(d.url, '_blank');
                    } catch (err) {
                        alert('Error de conexión con el Servidor Backend: ' + currentApiUrl);
                    }
                };

                // Bloquear Pestaña de Preferencias
                preferencesSection.style.opacity = '0.5';
                preferencesSection.style.pointerEvents = 'none';
                defaultSheetSelect.disabled = true;
                savePreferencesBtn.disabled = true;
            }
        } catch (err) {
            console.error('Auth error', err);
            authStatusText.innerHTML = '<div style="display:flex;align-items:center;gap:6px;"><svg class="indicator" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> API Desconectada o Despertando</div>';
            authStatusText.className = 'status-text disconnected';

            authBtn.textContent = '🔄 Reintentar Conexión';
            authBtn.style.display = 'inline-flex';
            authBtn.onclick = () => checkAuthStatus();
        }
    };



    // Detectar cuando el usuario vuelve a la tab después de autenticarse
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAuthStatus();
        }
    });

    // --- SECCIÓN 3: PREFERENCIAS (SHEETS) ---
    const loadSheetsList = async () => {
        defaultSheetSelect.disabled = true;
        savePreferencesBtn.disabled = true;
        defaultSheetSelect.innerHTML = '<option value="">Cargando hojas de cálculo...</option>';

        try {
            const res = await fetch(`${currentApiUrl}/api/sheets/list?userId=${userId}`);
            const data = await res.json();

            if (data.success && data.files) {
                defaultSheetSelect.innerHTML = '<option value="">(No usar predeterminado)</option>';

                // Opción para Crear Hoja Nueva
                const newSheetOpt = document.createElement('option');
                newSheetOpt.value = 'NEW_SHEET';
                newSheetOpt.textContent = 'Crear mi primer Prospector Sheet';
                defaultSheetSelect.appendChild(newSheetOpt);

                data.files.forEach(file => {
                    const opt = document.createElement('option');
                    opt.value = file.id;
                    opt.textContent = `[#] ${file.name}`;
                    defaultSheetSelect.appendChild(opt);
                });

                // Seleccionar valor guardado si existe
                if (config.defaultSheetId) {
                    defaultSheetSelect.value = config.defaultSheetId;
                }

                // Mostrar input si NEW_SHEET quedó seleccionado por defecto (ej. si no hay hojas)
                if (defaultSheetSelect.value === 'NEW_SHEET') {
                    defaultSheetNameInput.style.display = 'block';
                } else {
                    defaultSheetNameInput.style.display = 'none';
                }

                defaultSheetSelect.disabled = false;
                savePreferencesBtn.disabled = false;
            } else {
                defaultSheetSelect.innerHTML = '<option value="">Error cargando la lista</option>';
            }
        } catch (err) {
            console.error('Error fetching sheets', err);
            defaultSheetSelect.innerHTML = '<option value="">Fallo de red</option>';
        }
    };

    // Escuchar cambios en el select para mostrar/ocultar el input de nombre
    defaultSheetSelect.addEventListener('change', () => {
        if (defaultSheetSelect.value === 'NEW_SHEET') {
            defaultSheetNameInput.style.display = 'block';
        } else {
            defaultSheetNameInput.style.display = 'none';
        }
    });

    savePreferencesBtn.addEventListener('click', async () => {
        const selectedId = defaultSheetSelect.value;
        const saveObj = { defaultSheetId: selectedId };

        savePreferencesBtn.disabled = true;
        const origText = savePreferencesBtn.innerHTML;
        savePreferencesBtn.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#ffffff transparent transparent transparent; width:14px; height:14px; margin-right: 6px;"></span> Guardando...';

        try {
            if (selectedId === 'NEW_SHEET') {
                const customName = defaultSheetNameInput.value.trim() || 'Apollo Prospector Leads';

                // Call API to actively create it right now
                const response = await fetch(`${currentApiUrl}/api/sheets/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, sheetName: customName })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Server error creating sheet');
                }

                // Override the target ID with the real created ID
                saveObj.defaultSheetId = data.spreadsheetId;
                saveObj.defaultSheetName = customName;

                // Update dropdown visually
                const newOpt = document.createElement('option');
                newOpt.value = data.spreadsheetId;
                newOpt.textContent = `[#] ${customName}`;
                defaultSheetSelect.appendChild(newOpt);
                defaultSheetSelect.value = data.spreadsheetId;
                defaultSheetNameInput.style.display = 'none';

            } else if (selectedId) {
                const selectedText = defaultSheetSelect.options[defaultSheetSelect.selectedIndex].text;
                saveObj.defaultSheetName = selectedText.replace('[#] ', '');
            }

            chrome.storage.sync.set(saveObj, () => {
                showMessage(prefsMessage, '<div style="display:flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Hoja Predeterminada configurada con éxito.</div>');
                savePreferencesBtn.disabled = false;
                savePreferencesBtn.innerHTML = origText;
            });
        } catch (err) {
            console.error(err);
            showMessage(prefsMessage, '<div style="display:flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Error al crear la hoja en Google Drive.</div>', true);
            savePreferencesBtn.disabled = false;
            savePreferencesBtn.innerHTML = origText;
        }
    });

    // Iniciar
    checkAuthStatus();
});
