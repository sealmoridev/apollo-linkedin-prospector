// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Forward tab-switch events to the side panel so it updates its URL state
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        chrome.runtime.sendMessage({ type: 'TAB_ACTIVATED', url: tab.url || '' }).catch(() => {});
    } catch (_) {}
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openOptionsPage') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
    }
    if (request.action === 'openSidePanel' && sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch(console.error);
        sendResponse({ ok: true });
    }
    return true;
});
