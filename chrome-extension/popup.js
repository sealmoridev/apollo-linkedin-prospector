document.addEventListener('DOMContentLoaded', async () => {
    // Generate or get a unique User ID for this browser instance
    const getUserId = async () => {
        const result = await chrome.storage.local.get(['prospectorUserId']);
        if (result.prospectorUserId) return result.prospectorUserId;

        const newId = 'user_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ prospectorUserId: newId });
        return newId;
    };

    const userId = await getUserId();
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const currentUrlEl = document.getElementById('currentUrl');
    const extractBtn = document.getElementById('extractBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.getElementById('loader');
    const loginBtn = document.getElementById('loginBtn');
    const authStatusText = document.getElementById('authStatusText');

    let currentLinkedinUrl = '';
    let apiUrl = 'http://localhost:3000'; // updated soon
    let isAuthenticated = false;

    // Functions to update UI state
    function showSuccess(message) {
        resultDiv.textContent = message;
        resultDiv.className = 'result-success';
        resultDiv.style.display = 'block';
    }

    function showError(message) {
        resultDiv.textContent = message;
        resultDiv.className = 'result-error';
        resultDiv.style.display = 'block';
    }

    function clearResult() {
        resultDiv.style.display = 'none';
        resultDiv.className = '';
        resultDiv.textContent = '';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            extractBtn.disabled = true;
            btnText.textContent = 'Procesando...';
            loader.style.display = 'block';
            clearResult();
        } else {
            extractBtn.disabled = false;
            btnText.textContent = 'Extraer y Guardar';
            loader.style.display = 'none';
        }
    }

    // 1. Get current active tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url && tab.url.includes('linkedin.com/in/')) {
            // We are on a LinkedIn profile
            currentLinkedinUrl = tab.url;
            statusDot.classList.add('active');
            statusText.textContent = 'Perfil detectado';
            currentUrlEl.textContent = tab.url;
            extractBtn.disabled = false;
        } else {
            statusText.textContent = 'No es un perfil de LinkedIn';
            currentUrlEl.textContent = 'Navega a un perfil para empezar';
        }
    } catch (err) {
        console.error('Error getting active tab', err);
        statusText.textContent = 'Error al leer la pestaña';
    }

    // 3. Check Authentication Status
    const checkAuthStatus = async () => {
        try {
            const result = await chrome.storage.sync.get(['apiUrl']);
            if (result.apiUrl) apiUrl = result.apiUrl;

            const response = await fetch(`${apiUrl}/api/auth/status?userId=${userId}`);
            const data = await response.json();

            isAuthenticated = data.authenticated;

            if (isAuthenticated) {
                authStatusText.textContent = '✅ Conectado a Sheets';
                authStatusText.style.color = '#16a34a';
                loginBtn.style.display = 'none';

                // Habilitar botón si estamos en un perfil
                if (currentLinkedinUrl) extractBtn.disabled = false;
            } else {
                authStatusText.textContent = 'No conectado';
                authStatusText.style.color = '#ef4444';
                loginBtn.style.display = 'flex';
                extractBtn.disabled = true; // Deshabilitar hasta que inicie sesión
            }
        } catch (err) {
            console.error('Error checking auth state', err);
            authStatusText.textContent = 'Error conectando al servidor';
            loginBtn.style.display = 'none';
        }
    };

    await checkAuthStatus();

    // 4. Handle Login Button
    loginBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${apiUrl}/api/auth/google?userId=${userId}`);
            const data = await response.json();

            if (data.url) {
                // Abre una nueva pestaña para hacer login con Google
                chrome.tabs.create({ url: data.url });
            }
        } catch (err) {
            showError('Error iniciando sesión: Verifica que el servidor esté corriendo');
        }
    });

    // 5. Handle extract button click
    extractBtn.addEventListener('click', async () => {
        if (!currentLinkedinUrl) return;

        setLoading(true);

        try {
            // Get settings (API URL)
            const result = await chrome.storage.sync.get(['apiUrl']);
            // Default to localhost for development if not set
            const apiUrl = result.apiUrl || 'http://localhost:3000';
            const includePhone = includePhoneSelect.value === 'true';

            // Call our backend API
            const response = await fetch(`${apiUrl}/api/enrich`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    linkedinUrl: currentLinkedinUrl,
                    includePhone: includePhone,
                    saveToSheets: true,
                    userId: userId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al conectar con el servidor');
            }

            if (data.success) {
                if (data.sheetSaved) {
                    showSuccess('¡Perfil guardado exitosamente en Google Sheets!');
                } else if (data.sheetError) {
                    showError(`Perfil obtenido, pero error en Sheets: ${data.sheetError}`);
                } else {
                    showSuccess('Perfil procesado exitosamente.');
                }
            } else if (data.status === 'processing') {
                showSuccess('Perfil encolado. El teléfono tardará un poco en llegar por Webhook.');
            }

        } catch (error) {
            console.error('Extraction error:', error);
            showError(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    });
});
