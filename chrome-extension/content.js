// content.js — URL tracker + floating trigger tab for the MR Prospect Side Panel.

// ── Floating trigger tab ─────────────────────────────────────────────────────
// Injects the "MR Prospect" tab on the right edge of LinkedIn pages.
// Clicking it tells the background to open the side panel.

const injectTrigger = () => {
    if (document.getElementById('mrpTrigger')) return;

    const trigger = document.createElement('div');
    trigger.id = 'mrpTrigger';
    trigger.className = 'ap-trigger';
    trigger.innerHTML = `
        <img src="${chrome.runtime.getURL('assets/icon48.png')}" alt="MR Prospect">
        <span>MR Prospect</span>
    `;
    trigger.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });
    document.body.appendChild(trigger);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTrigger);
} else {
    injectTrigger();
}

// ── URL tracker ──────────────────────────────────────────────────────────────
// Detects LinkedIn SPA navigation and forwards URL + profile name to the panel.

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

sendUrlUpdate();

let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        sendUrlUpdate();
    }
}, 1000);
