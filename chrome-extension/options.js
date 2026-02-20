document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DEL DOM ---
    const apiUrlInput = document.getElementById('apiUrl');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const apiMessage = document.getElementById('apiMessage');

    const authStatusText = document.getElementById('authStatusText');
    const authBtn = document.getElementById('authBtn');

    const preferencesSection = document.getElementById('preferencesSection');
    const customSheetSelectWrapper = document.getElementById('customSheetSelectWrapper');
    const customSheetTrigger = document.getElementById('customSheetTrigger');
    const customSheetSelectedValue = document.getElementById('customSheetSelectedValue');
    const customSheetDropdown = document.getElementById('customSheetDropdown');
    const customSheetSearchInput = document.getElementById('customSheetSearchInput');
    const customSheetOptionsList = document.getElementById('customSheetOptionsList');

    const defaultSheetNameInput = document.getElementById('defaultSheetNameInput');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const prefsMessage = document.getElementById('prefsMessage');

    // --- ESTADO INTERNO ---
    let currentApiUrl = 'http://localhost:3000';
    let userId = null;
    let isAuthenticated = false;
    let allSheets = [];
    let selectedSheetId = '';
    let selectedSheetName = '';

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
    const config = await chrome.storage.sync.get(['apiUrl', 'defaultSheetId', 'defaultSheetName']);

    if (config.apiUrl) {
        currentApiUrl = config.apiUrl;
        apiUrlInput.value = currentApiUrl;
    }

    if (config.defaultSheetId) {
        selectedSheetId = config.defaultSheetId;
        selectedSheetName = config.defaultSheetName || 'Documento Guardado';
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
                customSheetTrigger.classList.add('disabled');
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

    // Cerrar dropdown al hacer click afuera
    document.addEventListener('click', (e) => {
        if (!customSheetSelectWrapper.contains(e.target)) {
            customSheetSelectWrapper.classList.remove('open');
        }
    });

    customSheetTrigger.addEventListener('click', () => {
        if (customSheetTrigger.classList.contains('disabled')) return;
        customSheetSelectWrapper.classList.toggle('open');
        if (customSheetSelectWrapper.classList.contains('open')) {
            customSheetSearchInput.value = ''; // Reset search
            renderCustomOptions(allSheets);
            customSheetSearchInput.focus();
        }
    });

    customSheetSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allSheets.filter(sheet => sheet.name.toLowerCase().includes(query));
        renderCustomOptions(filtered);
    });

    const renderCustomOptions = (sheets) => {
        customSheetOptionsList.innerHTML = ''; // Clear

        if (sheets.length === 0) {
            customSheetOptionsList.innerHTML = '<div class="no-results">No se encontraron bases de datos</div>';
        }

        // 1. (Opcional) Opción para no usar predeterminado
        const nullOpt = document.createElement('div');
        nullOpt.className = 'custom-option';
        nullOpt.innerHTML = '<span style="color: #64748b; font-style: italic;">(No usar predeterminado)</span>';
        nullOpt.addEventListener('click', () => handleOptionSelect('', '(No usar predeterminado)'));
        customSheetOptionsList.appendChild(nullOpt);

        // 2. Opciones de Google Sheets
        sheets.forEach(file => {
            const opt = document.createElement('div');
            opt.className = `custom-option ${selectedSheetId === file.id ? 'selected' : ''}`;
            opt.innerHTML = `<svg style="width:14px; height:14px; color:#10b981; flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M14 13h2"></path><path d="M14 17h2"></path></svg> <span>${file.name}</span>`;
            opt.addEventListener('click', () => handleOptionSelect(file.id, file.name));
            customSheetOptionsList.appendChild(opt);
        });

        // 3. Opción de Crear Nuevo (Fija al final)
        const newOpt = document.createElement('div');
        newOpt.className = 'custom-option action-option';
        newOpt.innerHTML = '<svg style="width:14px; height:14px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg> Crear mi primer Prospector Sheet';
        newOpt.addEventListener('click', () => handleOptionSelect('NEW_SHEET', 'Crear Base de Datos Nueva...'));
        customSheetOptionsList.appendChild(newOpt);
    };

    const handleOptionSelect = (id, name) => {
        selectedSheetId = id;
        selectedSheetName = name;

        // Update Trigger UI
        if (id === 'NEW_SHEET') {
            customSheetSelectedValue.innerHTML = `<span style="color:#2563eb; font-weight: 500;">${name}</span>`;
            defaultSheetNameInput.style.display = 'block';
        } else if (id === '') {
            customSheetSelectedValue.innerHTML = '<span style="color:#64748b;">(No usar predeterminado)</span>';
            defaultSheetNameInput.style.display = 'none';
        } else {
            customSheetSelectedValue.innerHTML = `<svg style="width:16px; height:16px; color:#10b981; flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M14 13h2"></path><path d="M14 17h2"></path></svg> <span style="font-weight: 500; color: #0f172a;">${name}</span>`;
            defaultSheetNameInput.style.display = 'none';
        }

        customSheetSelectWrapper.classList.remove('open');
        savePreferencesBtn.disabled = false;
    };

    const loadSheetsList = async () => {
        customSheetTrigger.classList.add('disabled');
        customSheetSelectedValue.innerText = 'Cargando hojas de cálculo...';
        savePreferencesBtn.disabled = true;

        try {
            const res = await fetch(`${currentApiUrl}/api/sheets/list?userId=${userId}`);
            const data = await res.json();

            if (data.success && data.files) {
                allSheets = data.files;
                customSheetTrigger.classList.remove('disabled');

                // Determine initial selected text based on existing config, or default
                if (selectedSheetId === 'NEW_SHEET') {
                    handleOptionSelect('NEW_SHEET', 'Crear Base de Datos Nueva...');
                } else if (selectedSheetId && selectedSheetId !== '') {
                    // find name
                    const found = allSheets.find(s => s.id === selectedSheetId);
                    if (found) {
                        handleOptionSelect(found.id, found.name);
                    } else {
                        handleOptionSelect(selectedSheetId, selectedSheetName);
                    }
                } else {
                    handleOptionSelect('', '(No usar predeterminado)');
                }

                savePreferencesBtn.disabled = false;
            } else {
                customSheetSelectedValue.innerText = 'Error cargando la lista';
            }
        } catch (err) {
            console.error('Error fetching sheets', err);
            customSheetSelectedValue.innerText = 'Fallo de red';
        }
    };

    savePreferencesBtn.addEventListener('click', async () => {
        const saveObj = { defaultSheetId: selectedSheetId, defaultSheetName: selectedSheetName };

        savePreferencesBtn.disabled = true;
        const origText = savePreferencesBtn.innerHTML;
        savePreferencesBtn.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#ffffff transparent transparent transparent; width:14px; height:14px; margin-right: 6px;"></span> Guardando...';

        try {
            if (selectedSheetId === 'NEW_SHEET') {
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

                // Add to internal list and re-select
                allSheets.unshift({ id: data.spreadsheetId, name: customName });
                handleOptionSelect(data.spreadsheetId, customName);

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
