// content.js — URL tracker for the MR Prospect side panel.
// This script no longer injects any UI into LinkedIn.
// It only detects URL changes and forwards them to the side panel.

const sendUrlUpdate = () => {
    const url = location.href;
    let profileName = 'Prospecto';
    if (url.includes('linkedin.com/in/')) {
        const nameEl = document.querySelector('h1.text-heading-xlarge');
        if (nameEl?.innerText) {
            profileName = nameEl.innerText.split('(')[0].trim();
        }
    }
    chrome.runtime.sendMessage({ type: 'URL_CHANGED', url, profileName }).catch(() => {});
};

// Send initial URL when the content script loads
sendUrlUpdate();

// Detect LinkedIn SPA navigation
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        sendUrlUpdate();
    }
}, 1000);
