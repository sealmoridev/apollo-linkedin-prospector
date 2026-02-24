chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openOptionsPage") {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
    }
    return true; // keep message channel open
});

// Opcional: Permitir que al hacer click en el icono de la extensión se fije/muestre el panel
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("linkedin.com/in/")) {
        // Enviar un mensaje al content script para abrir o cerrar el panel
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } else {
        // Si no está en LinkedIn, abrir las opciones o una pestaña de LinkedIn
        chrome.runtime.openOptionsPage();
    }
});
