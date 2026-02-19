document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('apiUrl');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load current settings
    chrome.storage.sync.get(['apiUrl'], (result) => {
        if (result.apiUrl) {
            apiUrlInput.value = result.apiUrl;
        } else {
            apiUrlInput.value = 'http://localhost:3000'; // Default
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        let apiUrl = apiUrlInput.value.trim();

        // Remove trailing slash if present
        if (apiUrl.endsWith('/')) {
            apiUrl = apiUrl.slice(0, -1);
        }

        chrome.storage.sync.set({ apiUrl }, () => {
            statusDiv.textContent = 'Configuración guardada exitosamente.';
            statusDiv.className = 'success';

            setTimeout(() => {
                statusDiv.style.display = 'none';
                statusDiv.className = '';
            }, 3000);
        });
    });
});
