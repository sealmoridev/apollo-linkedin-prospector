document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DEL DOM ---
    const apiUrlInput = document.getElementById('apiUrl');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const apiMessage = document.getElementById('apiMessage');

    const authStatusText = document.getElementById('authStatusText');
    const authBtn = document.getElementById('authBtn');

    const preferencesSection = document.getElementById('preferencesSection');
    const defaultSheetSelect = document.getElementById('defaultSheetSelect');
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    const prefsMessage = document.getElementById('prefsMessage');

    // --- ESTADO INTERNO ---
    let currentApiUrl = 'http://localhost:3000';
    let userId = null;
    let isAuthenticated = false;

    // Utilidades UI
    const showMessage = (element, msg, isError = false) => {
        element.textContent = msg;
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
            showMessage(apiMessage, '✅ URL Base guardada con éxito');
            // Re-checar el estado porque la URL cambió
            checkAuthStatus();
        });
    });

    // --- SECCIÓN 2: ESTADO DE OAUTH ---
    const checkAuthStatus = async () => {
        authStatusText.innerHTML = 'Cargando...';
        authStatusText.className = 'status-text';

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

            if (isAuthenticated) {
                authStatusText.innerHTML = '<span class="indicator">🟢</span> Conectado a Sheets';
                authStatusText.className = 'status-text connected';
                authBtn.style.display = 'none';

                // Activar Pestaña de Preferencias
                preferencesSection.style.opacity = '1';
                preferencesSection.style.pointerEvents = 'auto';
                loadSheetsList();

            } else {
                authStatusText.innerHTML = '<span class="indicator">🔴</span> Desconectado';
                authStatusText.className = 'status-text disconnected';
                authBtn.style.display = 'inline-flex';

                // Bloquear Pestaña de Preferencias
                preferencesSection.style.opacity = '0.5';
                preferencesSection.style.pointerEvents = 'none';
                defaultSheetSelect.disabled = true;
                savePreferencesBtn.disabled = true;
            }
        } catch (err) {
            console.error('Auth error', err);
            authStatusText.innerHTML = '<span class="indicator">🟠</span> Servidor Inaccesible';
            authStatusText.className = 'status-text disconnected';
            authBtn.style.display = 'none';
        }
    };

    authBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${currentApiUrl}/api/auth/google?userId=${userId}`);
            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (err) {
            alert('Error de conexión con el Servidor Backend: ' + currentApiUrl);
        }
    });

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

                data.files.forEach(file => {
                    const opt = document.createElement('option');
                    opt.value = file.id;
                    opt.textContent = `📄 ${file.name}`;
                    defaultSheetSelect.appendChild(opt);
                });

                // Seleccionar valor guardado si existe
                if (config.defaultSheetId) {
                    defaultSheetSelect.value = config.defaultSheetId;
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

    savePreferencesBtn.addEventListener('click', () => {
        const selectedId = defaultSheetSelect.value;
        const saveObj = { defaultSheetId: selectedId };

        chrome.storage.sync.set(saveObj, () => {
            showMessage(prefsMessage, '✅ Hoja Predeterminada guardada con éxito.');
        });
    });

    // Iniciar
    checkAuthStatus();
});
