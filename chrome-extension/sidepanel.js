// sidepanel.js — All widget logic for the MR Prospect Chrome Side Panel.
// Runs in a privileged extension page context:
// - Asset paths are relative (no chrome.runtime.getURL needed)
// - API calls are not subject to page CSP or CORS restrictions
// - URL tracking comes from content.js via chrome.runtime.sendMessage

// ─── Persistent user ID (reused across sessions) ────────────────────────────
const getUserId = async () => {
    const result = await chrome.storage.local.get(['prospectorUserId']);
    if (result.prospectorUserId) return result.prospectorUserId;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ prospectorUserId: newId });
    return newId;
};

// ─── Module-level state (shared between init and message listener) ───────────
let currentLinkedinUrl = '';
let currentSesionId = crypto.randomUUID();
let isAuthenticated = false;
let extractedLeadData = null;
let hasExtractedCurrentProfile = false;
let verifierCalled = false;
let currentEnrichmentProvider = 'apollo';
let primaryPhoneEnabled = false; // true only when primary provider fetches phone (e.g. Prospeo with toggle on)
let configuredProviders = [];
let triedProviders = { email: new Set(), phone: new Set() };
let cascadeResults = { email: [], phone: [] };
let apiUrl = 'https://mrprospect.app';
let tenantApiKey = '';
let lastProfileName = 'Prospecto';
let authPollInterval = null;

// ─── Provider icon paths (relative — works from extension page) ──────────────
const getProviderIconUrl = (providerId) => {
    const iconMap = {
        apollo:    'assets/apolloicon.png',
        prospeo:   'assets/prospeoicon.png',
        findymail: 'assets/findymail-logo.png',
        leadmagic: 'assets/leadmagic-logo.jpeg',
    };
    return iconMap[providerId] || '';
};

// ─── Main async init ─────────────────────────────────────────────────────────
(async () => {
    const userId = await getUserId();

    // Seed URL from the currently active tab
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url) currentLinkedinUrl = tabs[0].url;
    } catch (_) {}

    // ── UI element refs ──────────────────────────────────────────────────────
    const authSection       = document.getElementById('apAuthSection');
    const loginBtn          = document.getElementById('apLoginBtn');
    const authStatusText    = document.getElementById('apAuthStatusText');
    const disconnectWrap    = document.querySelector('.ap-auth-disconnect-wrap');

    const extractSection    = document.getElementById('apExtractSection');
    const previewSection    = document.getElementById('apPreviewSection');

    const currentUrlEl      = document.getElementById('apCurrentUrl');
    const validateEmailBtn  = document.getElementById('apValidateEmailBtn');
    const emailBadge        = document.getElementById('apEmailBadge');
    const requestPhoneBtn   = document.getElementById('apRequestPhoneBtn');

    const extractBtn        = document.getElementById('apExtractBtn');
    const extractBtnText    = extractBtn.querySelector('.ap-btn-text');
    const extractLoader     = document.getElementById('apExtractLoader');

    const saveBtn           = document.getElementById('apSaveBtn');
    const saveBtnText       = saveBtn.querySelector('.ap-save-btn-text');
    const saveLoader        = document.getElementById('apSaveLoader');
    const cancelBtn         = document.getElementById('apCancelBtn');

    const resultDiv         = document.getElementById('apResultDiv');
    const optionsLink       = document.getElementById('apOptionsLink');

    const headerAvatarImg   = document.getElementById('apHeaderAvatarImg');
    const headerAvatarInitial = document.getElementById('apHeaderAvatarInitial');
    const headerName        = document.getElementById('apHeaderName');
    const headerEmail       = document.getElementById('apHeaderEmail');

    const profileCard       = document.getElementById('apProfileCard');
    const pcCompanyName     = document.getElementById('apPcCompanyName');
    const pcCompanyLogo     = document.getElementById('apPcCompanyLogo');
    const pcSettingsBtn     = document.getElementById('apPcSettingsBtn');
    const pcSheetName       = document.getElementById('apPcSheetName');
    const pcSheetHint       = document.getElementById('apPcSheetHint');
    const pcSheetLink       = document.getElementById('apPcSheetLink');
    const pcSheetLabel      = document.getElementById('apPcSheetLabel');

    const onboardingSection = document.getElementById('apOnboarding');
    const onboardingInput   = document.getElementById('apOnboardingKey');
    const onboardingBtn     = document.getElementById('apOnboardingBtn');
    const onboardingError   = document.getElementById('apObError');
    const obToggle          = document.getElementById('apObToggle');
    const obEye             = document.getElementById('apObEye');
    const obOptionsLink     = document.getElementById('apObOptionsLink');

    // ── Settings button handlers ─────────────────────────────────────────────
    pcSettingsBtn.addEventListener('click', () => window.location.href = 'options.html');
    document.getElementById('apPcHintOptionsBtn').addEventListener('click', () => window.location.href = 'options.html');
    optionsLink.addEventListener('click', () => window.location.href = 'options.html');

    // ── Onboarding ───────────────────────────────────────────────────────────

    const showOnboarding = () => {
        onboardingSection.style.display = 'flex';
        authSection.style.display = 'none';
        extractSection.style.display = 'none';
        previewSection.style.display = 'none';
    };

    const hideOnboarding = () => {
        onboardingSection.style.display = 'none';
    };

    obToggle.addEventListener('click', () => {
        const hidden = onboardingInput.type === 'password';
        onboardingInput.type = hidden ? 'text' : 'password';
        obEye.innerHTML = hidden
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    });

    obOptionsLink.addEventListener('click', () => window.location.href = 'options.html');

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

    onboardingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onboardingBtn.click();
    });

    // ── General UI helpers ───────────────────────────────────────────────────

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

    // ── Confirmation dialog for saving with invalid email ────────────────────
    // Returns a Promise<boolean>: true = confirmed, false = cancelled

    const showInvalidEmailConfirm = () => new Promise((resolve) => {
        saveBtn.style.display = 'none';
        cancelBtn.disabled = true;

        const confirmDiv = document.createElement('div');
        confirmDiv.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:10px 12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:8px;';
        confirmDiv.innerHTML = `
            <p style="font-size:11px; color:#f87171; margin:0; line-height:1.5;">
                <strong>⚠️ El email fue verificado como inválido.</strong><br>¿Deseas guardarlo de todas formas?
            </p>
            <div style="display:flex; gap:6px;">
                <button id="apConfirmNo"  style="flex:1; padding:5px 0; font-size:11px; border:1px solid rgba(255,255,255,0.15); border-radius:6px; background:transparent; cursor:pointer; color:#94a3b8;">No, cancelar</button>
                <button id="apConfirmYes" style="flex:1; padding:5px 0; font-size:11px; border:none; border-radius:6px; background:#ef4444; color:#fff; cursor:pointer; font-weight:600;">Guardar igual</button>
            </div>
        `;

        saveBtn.parentElement.insertBefore(confirmDiv, saveBtn);

        const cleanup = (result) => {
            confirmDiv.remove();
            saveBtn.style.display = '';
            cancelBtn.disabled = false;
            resolve(result);
        };

        document.getElementById('apConfirmNo').addEventListener('click',  () => cleanup(false));
        document.getElementById('apConfirmYes').addEventListener('click', () => cleanup(true));
    });

    // ── Preview state persistence ────────────────────────────────────────────
    // Survives tab switches within the same Chrome session (storage.session is
    // cleared automatically when the browser closes, so no stale data).

    const _PREVIEW_KEY = 'mrp_preview';

    const savePreviewState = () => {
        if (!extractedLeadData) return;
        chrome.storage.session.set({
            [_PREVIEW_KEY]: {
                url:                   currentLinkedinUrl,
                sesionId:              currentSesionId,
                provider:              currentEnrichmentProvider,
                primaryPhoneEnabled,
                verifierCalled,
                extractedLeadData,
                cascadeResults: {
                    email: cascadeResults.email,
                    phone: cascadeResults.phone,
                },
                triedProviders: {
                    email: [...triedProviders.email],
                    phone: [...triedProviders.phone],
                },
            }
        }).catch(() => {});
    };

    const clearPreviewState = () => {
        chrome.storage.session.remove(_PREVIEW_KEY).catch(() => {});
    };

    const tryRestorePreviewState = async (url) => {
        if (extractedLeadData) return false; // already in-progress, skip
        try {
            const result = await chrome.storage.session.get(_PREVIEW_KEY);
            const s = result[_PREVIEW_KEY];
            if (!s || s.url !== url) return false;

            // Restore module-level vars before calling showPreviewState
            currentSesionId          = s.sesionId;
            currentEnrichmentProvider = s.provider;
            primaryPhoneEnabled      = s.primaryPhoneEnabled;
            verifierCalled           = s.verifierCalled;
            hasExtractedCurrentProfile = false;

            // Rebuild base UI (sets extractedLeadData, shows previewSection)
            showPreviewState(s.extractedLeadData);

            // Override cascade state with persisted values
            // (showPreviewState may have set its own initial values — we win)
            cascadeResults = {
                email: s.cascadeResults.email || [],
                phone: s.cascadeResults.phone || [],
            };
            triedProviders = {
                email: new Set(s.triedProviders.email || []),
                phone: new Set(s.triedProviders.phone || []),
            };

            // Re-render email cascade
            const cEmail = document.getElementById('apCascadeEmail');
            if (cEmail) {
                cEmail.innerHTML = '';
                renderCascadeBadges('email');
                renderCascadeButtons('email');
                if (cascadeResults.email.length > 0 || triedProviders.email.size > 0) {
                    cEmail.style.display = 'block';
                }
            }

            // Re-render phone cascade
            const cPhone = document.getElementById('apCascadePhone');
            if (cPhone) {
                cPhone.innerHTML = '';
                renderCascadeBadges('phone');
                renderCascadeButtons('phone');
                if (cascadeResults.phone.length > 0 || triedProviders.phone.size > 0) {
                    cPhone.style.display = 'block';
                }
            }

            // Restore email verification badge
            const BADGE_MAP = {
                valid:     ['ap-badge ap-badge-valid',    '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Válido'],
                invalid:   ['ap-badge ap-badge-invalid',  '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Inválido'],
                catch_all: ['ap-badge ap-badge-catchall', '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg> Catch-All'],
            };
            const emailStatus = s.extractedLeadData?.emailStatus;
            if (emailStatus && BADGE_MAP[emailStatus]) {
                const [cls, html] = BADGE_MAP[emailStatus];
                if (validateEmailBtn) validateEmailBtn.style.display = 'none';
                if (emailBadge) {
                    emailBadge.style.display = 'inline-flex';
                    emailBadge.className = cls;
                    emailBadge.innerHTML = html;
                }
            }

            return true;
        } catch (e) {
            console.warn('[MRP] Could not restore preview state:', e);
            return false;
        }
    };

    // ── Cascade enrichment ───────────────────────────────────────────────────

    const loadTenantProviders = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/tenant-providers`, {
                headers: { 'x-api-key': tenantApiKey, 'x-google-id': userId }
            });
            if (!res.ok) return;
            const data = await res.json();
            configuredProviders = data.providers || [];
            currentEnrichmentProvider = data.active || 'apollo';
            primaryPhoneEnabled = data.primaryPhoneEnabled === true;
        } catch (e) {
            console.warn('[MRP] Could not load tenant providers:', e);
        }
    };

    // ── renderCascadeBadges: renders accumulated provider result badges ─────────

    const renderCascadeBadges = (field) => {
        const containerId = field === 'email' ? 'apCascadeEmail' : 'apCascadePhone';
        const container = document.getElementById(containerId);
        if (!container) return;

        const results = cascadeResults[field];
        if (results.length === 0) return;

        // Remove existing badge wrap, then re-render
        const existingWrap = container.querySelector('.ap-cascade-badge-wrap');
        if (existingWrap) existingWrap.remove();

        const wrap = document.createElement('div');
        wrap.className = 'ap-cascade-badge-wrap';

        results.forEach(r => {
            const badge = document.createElement('span');
            badge.className = `ap-cascade-badge ${r.found ? 'ap-cascade-badge-ok' : 'ap-cascade-badge-fail'}`;
            const iconUrl = getProviderIconUrl(r.providerId);
            badge.innerHTML = `<img src="${iconUrl}" style="width:10px;height:10px;object-fit:contain;"> ${r.name} ${r.found ? '✓' : '✗'}`;
            wrap.appendChild(badge);
        });

        container.insertBefore(wrap, container.firstChild);
        container.style.display = 'block';
    };

    // ── renderCascadeButtons: renders the "Buscar con ▾" dropdown trigger ──────
    // Does NOT clear badge wrap — only updates the trigger button.

    const renderCascadeButtons = (field) => {
        const containerId = field === 'email' ? 'apCascadeEmail' : 'apCascadePhone';
        const container = document.getElementById(containerId);
        if (!container) return;

        // Remove only the previous trigger and dropdown, keep badge wrap
        const existingTrigger = container.querySelector('.ap-btn-validate');
        const existingDropdown = container.querySelector('.ap-cascade-dropdown');
        if (existingTrigger) existingTrigger.remove();
        if (existingDropdown) existingDropdown.remove();

        const available = configuredProviders.filter(p =>
            p.fields.includes(field) &&
            !triedProviders[field].has(p.id)
        );

        if (available.length === 0) {
            // No more providers — only hide container if there are no badges either
            if (cascadeResults[field].length === 0) {
                container.style.display = 'none';
            }
            return;
        }

        container.style.display = 'block';

        const trigger = document.createElement('button');
        trigger.className = 'ap-btn-validate';
        trigger.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:10px; padding:3px 8px; position:relative;';
        trigger.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Buscar con <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
        container.appendChild(trigger);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const existing = container.querySelector('.ap-cascade-dropdown');
            if (existing) { existing.remove(); return; }

            const dropdown = document.createElement('div');
            dropdown.className = 'ap-cascade-dropdown';
            dropdown.style.cssText = 'position:absolute; top:calc(100% + 4px); left:0; z-index:9999; background:#fff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.12); padding:4px; min-width:150px;';

            available.forEach(p => {
                const item = document.createElement('button');
                item.style.cssText = 'display:flex; align-items:center; gap:8px; width:100%; padding:7px 10px; border:none; background:none; border-radius:6px; cursor:pointer; text-align:left; font-size:12px; color:#1e293b; transition:background 0.1s;';
                item.onmouseenter = () => { item.style.background = '#f1f5f9'; };
                item.onmouseleave = () => { item.style.background = 'none'; };
                item.innerHTML = `<img src="${getProviderIconUrl(p.id)}" style="width:14px;height:14px;object-fit:contain;border-radius:2px;"> ${p.name}`;
                item.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    dropdown.remove();
                    handleCascadeSearch(field, p);
                });
                dropdown.appendChild(item);
            });

            container.appendChild(dropdown);

            const onOutsideClick = (ev) => {
                if (!container.contains(ev.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', onOutsideClick);
                }
            };
            setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
        });
    };

    // ── Apollo phone cascade: async polling flow ─────────────────────────────
    const handleApolloPhoneCascade = async (provider, container, valueEl) => {
        const loaderHtml = `<span class="ap-loader" style="display:inline-block;border-color:#94a3b8 transparent transparent transparent;width:10px;height:10px;"></span>`;

        const setContainerLoading = (msg) => {
            if (!container) return;
            const oldTrigger = container.querySelector('.ap-btn-validate');
            const oldDropdown = container.querySelector('.ap-cascade-dropdown');
            if (oldTrigger) oldTrigger.remove();
            if (oldDropdown) oldDropdown.remove();
            const existing = container.querySelector('.ap-cascade-loading');
            if (existing) existing.remove();
            const span = document.createElement('span');
            span.className = 'ap-cascade-loading';
            span.style.cssText = 'font-size:10px;color:#94a3b8;display:flex;align-items:center;gap:4px;';
            span.innerHTML = `${loaderHtml} ${msg}`;
            container.appendChild(span);
            container.style.display = 'block';
        };

        const finishCascade = (found, phone) => {
            cascadeResults.phone.push({ providerId: provider.id, name: provider.name, found });
            savePreviewState();
            if (found && phone) {
                extractedLeadData.phoneNumber = phone;
                if (valueEl) valueEl.textContent = phone;
                if (container) { container.innerHTML = ''; renderCascadeBadges('phone'); }
            } else {
                if (container) { container.innerHTML = ''; renderCascadeBadges('phone'); }
                setTimeout(() => renderCascadeButtons('phone'), 0);
            }
        };

        setContainerLoading('Solicitando a Apollo...');

        let apolloPersonId = null;
        try {
            const res = await fetch(`${apiUrl}/api/enrich-phone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': tenantApiKey, 'x-google-id': userId },
                body: JSON.stringify({ linkedinUrl: currentLinkedinUrl, sesion_id: currentSesionId })
            });
            if (!res.ok) throw new Error('request failed');
            const data = await res.json();

            // Short-circuit: Apollo devolvió teléfono síncrono
            if (data.phone) { finishCascade(true, data.phone); return; }
            apolloPersonId = data.apolloPersonId;
        } catch (_) {
            finishCascade(false, null); return;
        }

        if (!apolloPersonId) { finishCascade(false, null); return; }

        // Fase de polling con timer visible
        if (container) {
            const existing = container.querySelector('.ap-cascade-loading');
            if (existing) existing.remove();
            const waitSpan = document.createElement('span');
            waitSpan.className = 'ap-cascade-loading ap-apollo-phone-wait';
            waitSpan.style.cssText = 'font-size:10px;color:#94a3b8;display:flex;align-items:center;gap:4px;';
            waitSpan.innerHTML = `${loaderHtml} Esperando Apollo… <span class="ap-apollo-phone-timer">0s</span>`;
            container.appendChild(waitSpan);
        }

        const MAX_WAIT = 5 * 60 * 1000; // 5 minutos
        const INTERVAL  = 5000;
        const startTime = Date.now();
        let pollTimer   = null;

        const updateTimer = () => {
            const el = container && container.querySelector('.ap-apollo-phone-timer');
            if (el) el.textContent = `${Math.floor((Date.now() - startTime) / 1000)}s`;
        };

        const poll = async () => {
            updateTimer();
            try {
                const r = await fetch(`${apiUrl}/api/phone-status?apollo_person_id=${apolloPersonId}`, {
                    headers: { 'x-api-key': tenantApiKey, 'x-google-id': userId }
                });
                const d = await r.json();

                if (d.status === 'found') { finishCascade(true, d.phone); return; }
                if (d.status === 'not_found') { finishCascade(false, null); return; }
            } catch (_) { /* network error — keep polling */ }

            const elapsed = Date.now() - startTime;
            if (elapsed < MAX_WAIT) {
                pollTimer = setTimeout(poll, INTERVAL);
            } else {
                // Timeout: mostrar mensaje breve antes de limpiar
                if (container) {
                    const existing = container.querySelector('.ap-cascade-loading');
                    if (existing) existing.remove();
                    const msg = document.createElement('span');
                    msg.style.cssText = 'font-size:10px;color:#f59e0b;';
                    msg.textContent = 'Apollo no respondió. Prueba otro proveedor.';
                    container.appendChild(msg);
                }
                setTimeout(() => finishCascade(false, null), 3000);
            }
        };

        pollTimer = setTimeout(poll, INTERVAL);
    };

    const handleCascadeSearch = async (field, provider) => {
        if (!extractedLeadData) return;

        const containerId = field === 'email' ? 'apCascadeEmail' : 'apCascadePhone';
        const container = document.getElementById(containerId);
        const valueEl = document.getElementById(field === 'email' ? 'apDataEmail' : 'apDataPhone');

        // Apollo phone usa flujo async con polling — no pasa por /api/enrich-field
        if (provider.id === 'apollo' && field === 'phone') {
            triedProviders.phone.add('apollo');
            await handleApolloPhoneCascade(provider, container, valueEl);
            return;
        }

        if (container) {
            // Clear only trigger/dropdown, keep badge wrap
            const oldTrigger = container.querySelector('.ap-btn-validate');
            const oldDropdown = container.querySelector('.ap-cascade-dropdown');
            if (oldTrigger) oldTrigger.remove();
            if (oldDropdown) oldDropdown.remove();
            const loadingSpan = document.createElement('span');
            loadingSpan.className = 'ap-cascade-loading';
            loadingSpan.style.cssText = 'font-size:10px; color:#94a3b8; display:flex; align-items:center; gap:4px;';
            loadingSpan.innerHTML = `<span class="ap-loader" style="display:inline-block; border-color:#94a3b8 transparent transparent transparent; width:10px; height:10px;"></span> Buscando con ${provider.name}...`;
            container.appendChild(loadingSpan);
        }

        triedProviders[field].add(provider.id);

        try {
            const body = {
                linkedinUrl: currentLinkedinUrl,
                field,
                provider: provider.id,
                sesion_id: currentSesionId,
                metadata: {
                    firstName: extractedLeadData.firstName,
                    lastName: extractedLeadData.lastName,
                    companyDomain: extractedLeadData.companyDomain,
                    companyName: extractedLeadData.company
                }
            };

            const res = await fetch(`${apiUrl}/api/enrich-field`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': tenantApiKey, 'x-google-id': userId },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            const found = !!(data.found && data.value);

            cascadeResults[field].push({ providerId: provider.id, name: provider.name, found });
            savePreviewState();

            if (found) {
                if (field === 'email') {
                    extractedLeadData.email = data.value;
                    extractedLeadData.primaryEmail = data.value;
                    if (valueEl) valueEl.textContent = data.value;
                    const validateBtn = document.getElementById('apValidateEmailBtn');
                    if (validateBtn) {
                        validateBtn.style.display = 'flex';
                        validateBtn.disabled = false;
                        validateBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Validar';
                    }
                    // Reset previous verification badge so user knows this is a fresh email
                    if (emailBadge) { emailBadge.style.display = 'none'; emailBadge.className = 'ap-badge'; }
                    extractedLeadData.emailStatus = null;
                } else {
                    extractedLeadData.phoneNumber = data.value;
                    if (valueEl) valueEl.textContent = data.value;
                    const phoneBtn = document.getElementById('apRequestPhoneBtn');
                    if (phoneBtn) phoneBtn.style.display = 'none';
                }
                if (container) {
                    // Clear loading state then render final badges (no button)
                    container.innerHTML = '';
                    renderCascadeBadges(field);
                }
            } else {
                if (container) {
                    container.innerHTML = '';
                    renderCascadeBadges(field);
                }
                setTimeout(() => renderCascadeButtons(field), 0);
            }
        } catch (err) {
            if (container) {
                container.innerHTML = '';
                renderCascadeBadges(field);
                renderCascadeButtons(field);
            }
        }
    };

    // ── State transitions ────────────────────────────────────────────────────

    const resetToExtractState = () => {
        extractSection.style.display = 'flex';
        previewSection.style.display = 'none';
        extractedLeadData = null;
        cascadeResults = { email: [], phone: [] };
        verifierCalled = false;

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
            saveLoader.style.display = 'none';
        }
        if (cancelBtn) cancelBtn.disabled = false;

        updateUrlDisplay();
        clearMessage();
    };

    const showPreviewState = (leadData) => {
        extractSection.style.display = 'none';
        previewSection.style.display = 'flex';
        extractedLeadData = leadData;

        // Provider badge
        const providerBadge = document.getElementById('apProviderBadge');
        if (providerBadge) {
            const iconUrl = getProviderIconUrl(currentEnrichmentProvider);
            const providerNames = { apollo: 'Apollo', prospeo: 'Prospeo', findymail: 'Findymail', leadmagic: 'LeadMagic' };
            const name = providerNames[currentEnrichmentProvider] || currentEnrichmentProvider;
            providerBadge.innerHTML = `<img src="${iconUrl}" style="width:12px;height:12px;object-fit:contain;border-radius:2px;"> ${name}`;
            providerBadge.style.display = 'flex';
        }

        // Populate card
        document.getElementById('apDataName').textContent = leadData.fullName || leadData.firstName || 'Sin nombre';
        const titleStr = leadData.title || 'Sin título';
        const companyStr = leadData.company || 'Sin empresa';
        document.getElementById('apDataTitleCompany').textContent = `${titleStr} - ${companyStr}`;

        const emailsRaw = [leadData.email, leadData.personalEmail].filter(Boolean).join(', ');
        const emailsList = emailsRaw ? emailsRaw.split(',').map(e => e.trim()).filter(Boolean) : [];
        const emailContainer = document.getElementById('apDataEmail');
        const emailTitle = document.getElementById('apDataEmailTitle');
        emailContainer.innerHTML = '';

        if (emailsList.length === 0) {
            emailTitle.innerHTML = 'Email';
            emailContainer.textContent = 'Sin email';
            extractedLeadData.primaryEmail = null;
        } else if (emailsList.length === 1) {
            emailTitle.innerHTML = 'Email';
            emailContainer.textContent = emailsList[0];
            extractedLeadData.primaryEmail = emailsList[0];
            const controlsContainer = document.getElementById('apEmailControlsContainer');
            if (controlsContainer) {
                controlsContainer.appendChild(validateEmailBtn);
                controlsContainer.appendChild(emailBadge);
            }
        } else {
            // Multiple emails — radio selection
            emailTitle.innerHTML = '<span id="apEmailTitleHint" style="color:#9941c0;">Selecciona Email Principal</span>';
            extractedLeadData.primaryEmail = null;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'ap-email-radio-group';

            emailsList.forEach((email) => {
                const label = document.createElement('label');
                label.className = 'ap-email-radio-label unselected-pulse';

                const topRow = document.createElement('div');
                topRow.style.display = 'flex';
                topRow.style.alignItems = 'center';
                topRow.style.gap = '8px';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'apPrimaryEmail';
                radio.className = 'ap-email-radio-input';
                radio.value = email;

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

                const bottomRow = document.createElement('div');
                bottomRow.className = 'ap-email-bottom-row';
                bottomRow.style.display = 'none';
                bottomRow.style.alignItems = 'center';
                bottomRow.style.gap = '8px';
                bottomRow.style.marginTop = '4px';

                const noteSpan = document.createElement('span');
                noteSpan.className = 'ap-email-note';
                noteSpan.style.fontSize = '11px';
                noteSpan.style.color = '#64748b';
                noteSpan.textContent = 'Se guardará en notas';
                noteSpan.style.display = 'none';
                bottomRow.appendChild(noteSpan);
                label.appendChild(bottomRow);
                groupDiv.appendChild(label);

                radio.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        extractedLeadData.primaryEmail = e.target.value;
                        extractedLeadData.emailStatus = 'Sin verificar';

                        const hint = document.getElementById('apEmailTitleHint');
                        if (hint) emailTitle.innerHTML = 'Email';

                        document.querySelectorAll('.ap-email-radio-label').forEach(lbl => {
                            lbl.classList.remove('unselected-pulse');
                            lbl.classList.remove('selected');
                            const check = lbl.querySelector('.ap-primary-check');
                            if (check) check.style.display = 'none';
                            const bRow = lbl.querySelector('.ap-email-bottom-row');
                            if (bRow) bRow.style.display = 'flex';
                            const note = lbl.querySelector('.ap-email-note');
                            if (note) note.style.display = 'inline';
                        });

                        label.classList.add('selected');
                        primaryCheck.style.display = 'inline-flex';
                        noteSpan.style.display = 'none';

                        bottomRow.appendChild(validateEmailBtn);
                        bottomRow.appendChild(emailBadge);

                        if (emailBadge) emailBadge.style.display = 'none';
                        if (validateEmailBtn) {
                            validateEmailBtn.style.display = 'flex';
                            validateEmailBtn.disabled = false;
                            validateEmailBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Validar';
                        }
                        if (saveBtn) saveBtn.disabled = false;
                    }
                });
            });
            emailContainer.appendChild(groupDiv);
            validateEmailBtn.style.display = 'none';
            emailBadge.style.display = 'none';
        }

        // Provider name lookup helper
        const providerNames = { apollo: 'Apollo', prospeo: 'Prospeo', findymail: 'Findymail', leadmagic: 'LeadMagic' };

        // Cascade: email
        if (!leadData.email && !leadData.primaryEmail) {
            cascadeResults.email.push({
                providerId: currentEnrichmentProvider,
                name: providerNames[currentEnrichmentProvider] || currentEnrichmentProvider,
                found: false
            });
            triedProviders.email.add(currentEnrichmentProvider);
            renderCascadeBadges('email');
            renderCascadeButtons('email');
        } else {
            const cascadeEl = document.getElementById('apCascadeEmail');
            if (cascadeEl) cascadeEl.style.display = 'none';
        }

        // Phone
        const phoneEl = document.getElementById('apDataPhone');
        const phBadge = document.getElementById('apPhoneBadge');
        if (leadData.phoneNumber) {
            phoneEl.textContent = leadData.phoneNumber;
            if (requestPhoneBtn) requestPhoneBtn.style.display = 'none';
            if (phBadge) phBadge.style.display = 'none';
            const cascadeEl = document.getElementById('apCascadePhone');
            if (cascadeEl) cascadeEl.style.display = 'none';
        } else {
            phoneEl.textContent = '—';
            if (phBadge) phBadge.style.display = 'none';
            if (requestPhoneBtn) requestPhoneBtn.style.display = 'none';
            // Only mark as tried / show ✗ badge if the primary provider actually requested phone.
            // e.g. Prospeo with primaryPhone=true tried and failed → block it from cascade.
            // e.g. Prospeo with primaryPhone=false never tried → leave it available in cascade.
            const providerAlwaysTriesPhone = ['prospeo'];
            const primaryTriedPhone = primaryPhoneEnabled && providerAlwaysTriesPhone.includes(currentEnrichmentProvider);
            if (primaryTriedPhone) {
                triedProviders.phone.add(currentEnrichmentProvider);
                cascadeResults.phone.push({
                    providerId: currentEnrichmentProvider,
                    name: providerNames[currentEnrichmentProvider] || currentEnrichmentProvider,
                    found: false
                });
                renderCascadeBadges('phone');
            }
            renderCascadeButtons('phone');
        }

        if (extractedLeadData.primaryEmail && validateEmailBtn && emailBadge) {
            validateEmailBtn.style.display = 'flex';
            validateEmailBtn.disabled = false;
            validateEmailBtn.innerHTML = '<svg style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Validar';
            emailBadge.style.display = 'none';
        } else if (validateEmailBtn && emailBadge) {
            validateEmailBtn.style.display = 'none';
            emailBadge.style.display = 'none';
        }

        if (!extractedLeadData.primaryEmail && emailsList.length > 1 && saveBtn) {
            saveBtn.disabled = true;
        }
    };

    // ── URL display ──────────────────────────────────────────────────────────

    const updateUrlDisplay = () => {
        const cardParent = currentUrlEl.parentElement;
        cardParent.className = 'ap-card';

        if (hasExtractedCurrentProfile) {
            cardParent.classList.add('ap-state-info');
            currentUrlEl.innerHTML = '<div class="ap-state-icon-box" style="color:#2563eb;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></div> Perfil guardado. Navega a otro.';
            extractBtn.disabled = true;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Extraído</div>';
        } else if (currentLinkedinUrl.includes('linkedin.com/in/')) {
            cardParent.classList.add('ap-state-success');
            currentUrlEl.innerHTML = `<div class="ap-state-icon-box" style="color:#16a34a;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div> ¿Extraer a ${lastProfileName}?`;
            extractBtn.disabled = !isAuthenticated;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
        } else {
            cardParent.classList.add('ap-state-warning');
            currentUrlEl.innerHTML = '<div class="ap-state-icon-box" style="color:#ea580c;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg></div> Abre un perfil de LinkedIn';
            extractBtn.disabled = true;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
        }
    };

    updateUrlDisplay();

    // ── URL change messages from content script / background ─────────────────
    chrome.runtime.onMessage.addListener((request) => {
        const newUrl = (request.type === 'URL_CHANGED' || request.type === 'TAB_ACTIVATED')
            ? (request.url || '')
            : null;

        if (newUrl === null) return;

        if (request.profileName) lastProfileName = request.profileName;

        if (newUrl !== currentLinkedinUrl) {
            currentLinkedinUrl = newUrl;
            // Try to restore a previously saved extraction for this URL.
            // Only if nothing is saved (or URL doesn't match) fall back to reset.
            (async () => {
                const restored = await tryRestorePreviewState(newUrl);
                if (!restored) {
                    currentSesionId = crypto.randomUUID();
                    hasExtractedCurrentProfile = false;
                    triedProviders = { email: new Set(), phone: new Set() };
                    updateUrlDisplay();
                    resetToExtractState();
                }
            })();
        }
    });

    // ── Auth ─────────────────────────────────────────────────────────────────

    const checkAuthStatus = async () => {
        try {
            if (!chrome?.storage?.sync) {
                profileCard.style.display = 'none';
                authSection.style.display = 'block';
                disconnectWrap.style.display = 'block';
                authStatusText.style.display = 'block';
                authStatusText.innerHTML = '⚠️ Recarga el panel para reconectar';
                authStatusText.className = 'ap-auth-status disconnected';
                loginBtn.style.display = 'none';
                extractBtn.disabled = true;
                return;
            }

            authStatusText.innerHTML = '<span class="ap-loader" style="display:inline-block; border-color:#0f172a transparent transparent transparent; width:12px; height:12px; margin-right: 4px;"></span> Conectando...';
            loginBtn.style.display = 'none';

            const result = await chrome.storage.sync.get(['apiUrl', 'tenantApiKey']);
            if (result.apiUrl) apiUrl = result.apiUrl.replace(/\/$/, '');
            if (result.tenantApiKey) tenantApiKey = result.tenantApiKey;

            if (!tenantApiKey) {
                showOnboarding();
                return;
            }

            hideOnboarding();
            extractSection.style.display = 'flex';

            const statusUrl = `${apiUrl}/api/auth/status?userId=${userId}${tenantApiKey ? '&apiKey=' + encodeURIComponent(tenantApiKey) : ''}`;
            const response = await fetch(statusUrl);
            if (!response.ok) throw new Error(`Servidor respondió con ${response.status}`);
            const data = await response.json();

            isAuthenticated = data.authenticated;
            authSection.style.display = 'block';
            loginBtn.onclick = null;

            if (isAuthenticated) {
                // Stop polling — auth confirmed
                if (authPollInterval) { clearInterval(authPollInterval); authPollInterval = null; }

                const storageConfig = await chrome.storage.sync.get(['defaultSheetId', 'defaultSheetName']);
                const hasDefaultSheet = storageConfig?.defaultSheetId;

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
                headerEmail.textContent = (gp?.email || '').replace('@mrprospect.local', ' · reconecta Google');

                pcCompanyName.textContent = emp?.nombre || '—';
                if (emp?.logo_url) {
                    pcCompanyLogo.innerHTML = `<img src="${emp.logo_url}" style="width:36px;height:36px;border-radius:8px;object-fit:contain;">`;
                }

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

                loadTenantProviders();

                // Restore any in-progress extraction for the currently visible profile
                if (currentLinkedinUrl) tryRestorePreviewState(currentLinkedinUrl).catch(() => {});

            } else {
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

                // Poll every 4 s so panel auto-refreshes when OAuth completes in another tab
                if (!authPollInterval) {
                    authPollInterval = setInterval(async () => {
                        await checkAuthStatus().catch(() => {});
                    }, 4000);
                }
            }
        } catch (err) {
            console.error('Auth error:', err);
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

    // Re-check when panel is re-opened (after Google OAuth, etc.)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAuthStatus().catch(() => {});
        }
    });

    // ── Extract action ───────────────────────────────────────────────────────

    extractBtn.addEventListener('click', async () => {
        if (!currentLinkedinUrl.includes('linkedin.com/in/')) return;

        extractBtn.disabled = true;
        extractBtnText.textContent = 'Extrayendo...';
        extractLoader.style.display = 'inline-block';
        clearMessage();

        // Refresh provider config before every extraction so backoffice changes apply immediately
        await loadTenantProviders();

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
                    userId,
                    sesion_id: currentSesionId
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Fallo de conexión al Servidor');

            if (data.success && data.data) {
                currentEnrichmentProvider = data.provider || 'apollo';
                showPreviewState(data.data);
                savePreviewState();
            }
        } catch (error) {
            console.error('Extraction error:', error);
            showMessage(`Error extractivo: ${error.message}`, true);
        } finally {
            extractBtn.disabled = false;
            extractBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg> Extraer Datos</div>';
            extractLoader.style.display = 'none';
        }
    });

    // ── Cancel ───────────────────────────────────────────────────────────────
    cancelBtn.addEventListener('click', () => {
        clearPreviewState();
        resetToExtractState();
    });

    // ── Copy data ────────────────────────────────────────────────────────────
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

    // ── Validate email ───────────────────────────────────────────────────────
    if (validateEmailBtn) {
        validateEmailBtn.addEventListener('click', async () => {
            if (!extractedLeadData) return;
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
                verifierCalled = true;
                validateEmailBtn.style.display = 'none';
                emailBadge.style.display = 'inline-flex';

                if (data.status === 'valid') {
                    emailBadge.className = 'ap-badge ap-badge-valid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Válido';
                } else if (data.status === 'invalid') {
                    emailBadge.className = 'ap-badge ap-badge-invalid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Inválido';
                    // Mark the provider that found this email as tried, then offer cascade alternatives
                    const emailFoundByProvider = (() => {
                        const w = cascadeResults.email.find(r => r.found);
                        return w ? w.providerId : currentEnrichmentProvider;
                    })();
                    triedProviders.email.add(emailFoundByProvider);
                    const cascadeEl = document.getElementById('apCascadeEmail');
                    if (cascadeEl) {
                        cascadeEl.style.display = 'block';
                        renderCascadeBadges('email');
                        renderCascadeButtons('email');
                    }
                } else if (data.status === 'catch_all') {
                    emailBadge.className = 'ap-badge ap-badge-catchall';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg> Catch-All';
                } else {
                    emailBadge.className = 'ap-badge ap-badge-unknown';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg> Error/Desc';
                }

                extractedLeadData.emailStatus = data.status;
                savePreviewState();
            } catch (err) {
                console.error('Validation error:', err);
                validateEmailBtn.disabled = false;
                validateEmailBtn.innerHTML = 'Reintentar';
            }
        });
    }

    // ── Request phone (Apollo legacy) ────────────────────────────────────────
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
                    body: JSON.stringify({ linkedinUrl: currentLinkedinUrl, sesion_id: currentSesionId })
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

    // ── Save to Google Sheets ────────────────────────────────────────────────
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

        const emailsRaw = [extractedLeadData.email, extractedLeadData.personalEmail].filter(Boolean).join(', ');
        const allEmails = emailsRaw ? emailsRaw.split(',').map(e => e.trim()).filter(Boolean) : [];
        const secondaryEmails = allEmails.filter(e => e !== extractedLeadData.primaryEmail);
        extractedLeadData.secondaryEmails = secondaryEmails.join(', ');

        saveBtn.disabled = true;
        saveBtnText.textContent = 'Guardando...';
        saveLoader.style.display = 'inline-block';
        cancelBtn.disabled = true;
        clearMessage();

        // If email is verified invalid, ask for explicit confirmation before saving
        if (extractedLeadData.emailStatus === 'invalid') {
            saveBtn.disabled = false;
            saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
            saveLoader.style.display = 'none';
            cancelBtn.disabled = false;
            const confirmed = await showInvalidEmailConfirm();
            if (!confirmed) return;
            // Re-lock while saving
            saveBtn.disabled = true;
            saveBtnText.textContent = 'Guardando...';
            saveLoader.style.display = 'inline-block';
            cancelBtn.disabled = true;
        }

        try {
            // Determine which provider actually found each field
            const emailCascadeWin = cascadeResults.email.find(r => r.found);
            const emailProvider = emailCascadeWin
                ? emailCascadeWin.providerId
                : (extractedLeadData.primaryEmail || extractedLeadData.email) ? currentEnrichmentProvider : null;

            const phoneCascadeWin = cascadeResults.phone.find(r => r.found);
            const phoneProvider = phoneCascadeWin
                ? phoneCascadeWin.providerId
                : extractedLeadData.phoneNumber ? currentEnrichmentProvider : null;

            const response = await fetch(`${apiUrl}/api/sheets/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    spreadsheetId: selectedSheetId,
                    lead: extractedLeadData,
                    sheetName: customSheetName,
                    sesion_id: currentSesionId,
                    provider: currentEnrichmentProvider,
                    emailProvider,
                    phoneProvider,
                    verifierCalled
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Fallo al guardar en Sheets');

            if (data.success) {
                clearPreviewState();
                if (data.spreadsheetId && selectedSheetId === 'NEW_SHEET') {
                    await chrome.storage.sync.set({ defaultSheetId: data.spreadsheetId });
                    checkAuthStatus();
                }

                saveBtn.disabled = false;
                saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
                saveLoader.style.display = 'none';
                cancelBtn.disabled = false;

                hasExtractedCurrentProfile = true;
                resetToExtractState();
                clearMessage();
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Save error:', error);
            showMessage(`Error guardando: ${error.message}`, true);
            saveBtn.disabled = false;
            saveBtnText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:6px;"><svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Confirmar y Guardar</div>';
            saveLoader.style.display = 'none';
            cancelBtn.disabled = false;
        }
    });

    // ── Sheets mode ──────────────────────────────────────────────────────────

    const sheetsSection       = document.getElementById('apSheetsSection');
    const sheetsModeName      = document.getElementById('apSheetsModeName');
    const sheetsModeLink      = document.getElementById('apSheetsModeLink');
    const sheetsLeadList      = document.getElementById('apSheetsLeadList');
    const sheetsLeadListInner = document.getElementById('apSheetsLeadListInner');
    const sheetsDiffView      = document.getElementById('apSheetsDiffView');
    const sheetsDiffRows      = document.getElementById('apSheetsDiffRows');
    const sheetsSyncBtn       = document.getElementById('apSheetsSyncBtn');
    const sheetsSyncBtnText   = document.getElementById('apSheetsSyncBtnText');
    const sheetsSyncLoader    = document.getElementById('apSheetsSyncLoader');
    const sheetsBackBtn       = document.getElementById('apSheetsBackBtn');
    const sheetsStatus        = document.getElementById('apSheetsStatus');

    let currentSpreadsheetId = null;
    let currentSheetsUrl     = '';
    let selectedConsumoId    = null;
    let selectedRowIndex     = null;
    let loadedSheetLeads     = [];

    const FIELD_LABELS = {
        full_name:      'Nombre completo',
        first_name:     'Nombre',
        last_name:      'Apellido',
        title:          'Cargo',
        primary_email:  'Email principal',
        personal_email: 'Email personal',
        phone_number:   'Teléfono',
        company_name:   'Empresa',
        company_domain: 'Dominio empresa',
        industry:       'Industria',
        location:       'Ubicación',
        email_status:   'Estado email',
        notes:          'Notas',
    };
    const SYNCABLE_FIELDS_LIST = Object.keys(FIELD_LABELS);

    const isGoogleSheetsUrl    = (url) => !!(url && url.includes('docs.google.com/spreadsheets/d/'));
    const extractSpreadsheetId = (url) => { const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/); return m ? m[1] : null; };
    const extractRowFromHash   = (url)  => { const m = (url.split('#')[1] || '').match(/range=[A-Z](\d+)/); return m ? parseInt(m[1]) : null; };

    const setSheetsStatus = (html, isError = false) => {
        if (!html) { sheetsStatus.style.display = 'none'; sheetsStatus.innerHTML = ''; return; }
        sheetsStatus.style.cssText = `display:block; font-size:12px; padding:8px 10px; border-radius:8px; text-align:center; margin-top:4px; color:${isError ? '#dc2626' : '#16a34a'}; background:${isError ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.07)'}; border:1px solid ${isError ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'};`;
        sheetsStatus.innerHTML = html;
    };

    const enterSheetsMode = async (url) => {
        currentSpreadsheetId = extractSpreadsheetId(url);
        if (!currentSpreadsheetId) return;

        sheetsSection.style.display  = 'flex';
        extractSection.style.display = 'none';
        previewSection.style.display = 'none';
        sheetsLeadList.style.display = 'block';
        sheetsDiffView.style.display = 'none';

        sheetsModeLink.href          = url;
        sheetsModeLink.style.display = 'flex';
        sheetsModeName.textContent   = 'Cargando...';

        await loadSheetLeads();

        const row = extractRowFromHash(url);
        if (row && loadedSheetLeads.some(l => l.row_index === row)) {
            await showSheetDiff(row);
        }
    };

    const exitSheetsMode = () => {
        sheetsSection.style.display  = 'none';
        currentSpreadsheetId         = null;
        currentSheetsUrl             = '';
        selectedConsumoId            = null;
        selectedRowIndex             = null;
        sheetsLeadList.style.display = 'block';
        sheetsDiffView.style.display = 'none';
        setSheetsStatus('');
    };

    const loadSheetLeads = async () => {
        if (!currentSpreadsheetId) return;
        sheetsLeadListInner.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;"><span class="ap-loader" style="display:inline-block;border-color:#94a3b8 transparent transparent;width:14px;height:14px;margin-right:6px;vertical-align:-3px;"></span>Cargando leads...</div>';
        try {
            const res = await fetch(`${apiUrl}/api/sheet-leads?userId=${encodeURIComponent(userId)}&spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}`);
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();
            loadedSheetLeads = data.leads || [];
            sheetsModeName.textContent = `${loadedSheetLeads.length} lead${loadedSheetLeads.length !== 1 ? 's' : ''} guardado${loadedSheetLeads.length !== 1 ? 's' : ''}`;
            renderSheetLeadList();
        } catch (_) {
            sheetsLeadListInner.innerHTML = '<div style="text-align:center;padding:24px 0;color:#dc2626;font-size:12px;">Error al cargar leads</div>';
        }
    };

    const linkLeadsToSheet = async () => {
        sheetsLeadListInner.innerHTML = '<div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;"><span class="ap-loader" style="display:inline-block;border-color:#7c3aed transparent transparent;width:14px;height:14px;margin-right:6px;vertical-align:-3px;border-width:2px;"></span>Escaneando hoja...</div>';
        try {
            const res = await fetch(`${apiUrl}/api/sheet-link-leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, spreadsheetId: currentSpreadsheetId })
            });
            if (!res.ok) throw new Error('Error del servidor');
            const data = await res.json();
            if (data.linked > 0) {
                await loadSheetLeads(); // reload with newly linked leads
            } else {
                sheetsLeadListInner.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:12px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>No se encontraron leads registrados en esta hoja</div>';
            }
        } catch (err) {
            sheetsLeadListInner.innerHTML = `<div style="text-align:center;padding:24px 0;color:#dc2626;font-size:12px;">Error: ${err.message}</div>`;
        }
    };

    const renderSheetLeadList = () => {
        if (loadedSheetLeads.length === 0) {
            sheetsLeadListInner.innerHTML = `
<div style="text-align:center;padding:24px 16px;color:#94a3b8;font-size:12px;">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
  <p style="margin:0 0 12px;">No hay leads vinculados a esta hoja.<br>¿Tienes leads guardados antes del update?</p>
  <button id="apSheetsLinkBtn" style="font-size:11px;font-weight:600;color:#7c3aed;background:#f5f3ff;border:1px solid #e9d5ff;border-radius:6px;padding:6px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    Vincular leads existentes
  </button>
</div>`;
            document.getElementById('apSheetsLinkBtn').addEventListener('click', linkLeadsToSheet);
            return;
        }
        const html = loadedSheetLeads.map(lead => {
            const d    = lead.lead_data || {};
            const name = d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Sin nombre';
            const sub  = [d.title, d.company_name].filter(Boolean).join(' · ') || d.primary_email || '—';
            const hasRow = lead.row_index != null;
            const fecha  = new Date(lead.fecha).toLocaleDateString('es', { day: '2-digit', month: 'short' });
            return `<button class="ap-sheets-lead-item" data-id="${lead.id}" data-row="${hasRow ? lead.row_index : ''}" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;text-align:left;transition:background 0.15s;margin-bottom:4px;">
  <div style="flex-shrink:0;width:28px;height:28px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#475569;">${name.charAt(0).toUpperCase()}</div>
  <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div><div style="font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div></div>
  <div style="flex-shrink:0;text-align:right;">${hasRow ? `<div style="font-size:10px;font-weight:600;color:#7c3aed;background:#f5f3ff;border:1px solid #e9d5ff;border-radius:4px;padding:1px 5px;">F${lead.row_index}</div>` : ''}<div style="font-size:9px;color:#94a3b8;margin-top:2px;">${fecha}</div></div>
</button>`;
        }).join('');
        sheetsLeadListInner.innerHTML = html;
        sheetsLeadListInner.querySelectorAll('.ap-sheets-lead-item').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.background = '#f8fafc'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; });
            btn.addEventListener('click', async () => {
                const row = btn.dataset.row ? parseInt(btn.dataset.row) : null;
                await showSheetDiff(row, btn.dataset.id);
            });
        });
    };

    const showSheetDiff = async (rowIndex, consumoId) => {
        const lead = loadedSheetLeads.find(l => l.id === consumoId) ||
                     (rowIndex ? loadedSheetLeads.find(l => l.row_index === rowIndex) : null);

        selectedConsumoId = consumoId || lead?.id || null;
        selectedRowIndex  = rowIndex  ?? lead?.row_index ?? null;

        sheetsLeadList.style.display = 'none';
        sheetsDiffView.style.display = 'flex';
        sheetsDiffRows.innerHTML     = '<div style="text-align:center;padding:16px 0;color:#94a3b8;font-size:12px;"><span class="ap-loader" style="display:inline-block;border-color:#94a3b8 transparent transparent;width:12px;height:12px;margin-right:4px;vertical-align:-2px;"></span>Leyendo hoja...</div>';

        if (!selectedRowIndex) {
            // No row_index: show DB data + offer retroactive search by linkedin_url
            renderDiff(lead?.lead_data || {}, null, true);
            const linkedinUrl = lead?.lead_data?.linkedin_url;
            if (linkedinUrl) renderFindRowButton(linkedinUrl);
            return;
        }
        try {
            const res = await fetch(`${apiUrl}/api/sheet-row?userId=${encodeURIComponent(userId)}&spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}&rowIndex=${selectedRowIndex}`);
            if (!res.ok) throw new Error('Error al leer la fila');
            const data = await res.json();
            if (data.consumoId) selectedConsumoId = data.consumoId;
            renderDiff(data.dbData || {}, data.sheetData || {}, false);
        } catch (err) {
            sheetsDiffRows.innerHTML = `<div style="text-align:center;padding:16px 0;color:#dc2626;font-size:12px;">Error: ${err.message}</div>`;
        }
    };

    const renderFindRowButton = (linkedinUrl) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:10px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; text-align:center;';
        wrap.innerHTML = `
            <p style="font-size:11px;color:#64748b;margin:0 0 8px 0;">Este registro es anterior al sistema de filas.<br>¿Buscarlo en el Sheet?</p>
            <button id="apSheetsFindRowBtn" style="font-size:11px;font-weight:600;color:#7c3aed;background:#f5f3ff;border:1px solid #e9d5ff;border-radius:6px;padding:5px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Buscar fila en Sheet
            </button>`;
        sheetsDiffRows.appendChild(wrap);

        document.getElementById('apSheetsFindRowBtn').addEventListener('click', async () => {
            const btn = document.getElementById('apSheetsFindRowBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="ap-loader" style="display:inline-block;border-color:#7c3aed transparent transparent;width:10px;height:10px;margin-right:4px;vertical-align:-1px;"></span> Buscando...';
            try {
                // Pass consumoId so positional matching resolves duplicates correctly
                const consumoParam = selectedConsumoId ? `&consumoId=${encodeURIComponent(selectedConsumoId)}` : '';
                const res = await fetch(`${apiUrl}/api/sheet-find-row?userId=${encodeURIComponent(userId)}&spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}&linkedinUrl=${encodeURIComponent(linkedinUrl)}${consumoParam}`);
                if (!res.ok) throw new Error('Error del servidor');
                const data = await res.json();
                if (data.rowIndex) {
                    selectedRowIndex = data.rowIndex;
                    // Update local cache
                    const lead = loadedSheetLeads.find(l => l.id === selectedConsumoId);
                    if (lead) lead.row_index = data.rowIndex;
                    wrap.remove();
                    // Now load full diff
                    sheetsDiffRows.innerHTML = '<div style="text-align:center;padding:12px 0;color:#94a3b8;font-size:12px;"><span class="ap-loader" style="display:inline-block;border-color:#94a3b8 transparent transparent;width:12px;height:12px;margin-right:4px;vertical-align:-2px;"></span>Leyendo fila...</div>';
                    const rowRes = await fetch(`${apiUrl}/api/sheet-row?userId=${encodeURIComponent(userId)}&spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}&rowIndex=${selectedRowIndex}`);
                    if (!rowRes.ok) throw new Error('Error al leer la fila');
                    const rowData = await rowRes.json();
                    if (rowData.consumoId) selectedConsumoId = rowData.consumoId;
                    renderDiff(rowData.dbData || {}, rowData.sheetData || {}, false);
                } else {
                    wrap.querySelector('p').textContent = 'No se encontró el perfil en esta hoja.';
                    btn.style.display = 'none';
                }
            } catch (err) {
                wrap.querySelector('p').textContent = `Error: ${err.message}`;
                btn.disabled = false;
                btn.innerHTML = 'Reintentar';
            }
        });
    };

    const renderDiff = (dbData, sheetData, dbOnly) => {
        const db    = dbData    || {};
        const sheet = sheetData || {};
        let changeCount = 0;
        const rows = SYNCABLE_FIELDS_LIST.map(field => {
            const dbVal    = String(db[field]    ?? '');
            const sheetVal = dbOnly ? dbVal : String(sheet[field] ?? '');
            const changed  = !dbOnly && sheetVal !== dbVal;
            if (changed) changeCount++;
            return `<div style="padding:6px 8px;border-radius:6px;background:${changed ? '#fffbeb' : 'transparent'};border:${changed ? '1px solid #fde68a' : 'none'};">
  <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:${changed ? '#d97706' : '#64748b'};margin-bottom:2px;">${FIELD_LABELS[field]}${changed ? ' · cambiado' : ''}</div>
  ${changed ? `<div style="font-size:11px;color:#9ca3af;text-decoration:line-through;word-break:break-all;">${dbVal || '—'}</div><div style="font-size:12px;color:#1e293b;font-weight:500;word-break:break-all;">${sheetVal || '—'}</div>` : `<div style="font-size:12px;color:#1e293b;word-break:break-all;">${sheetVal || dbVal || '—'}</div>`}
</div>`;
        }).join('');
        sheetsDiffRows.innerHTML = rows;

        if (!dbOnly && selectedConsumoId) {
            sheetsSyncBtn.style.display = '';
            sheetsSyncBtn.disabled      = changeCount === 0;
            sheetsSyncBtnText.innerHTML = changeCount === 0
                ? '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Sin cambios'
                : `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> Sincronizar ${changeCount} campo${changeCount !== 1 ? 's' : ''}`;
        } else {
            sheetsSyncBtn.style.display = 'none';
        }
    };

    sheetsSyncBtn.addEventListener('click', async () => {
        if (!selectedConsumoId || !selectedRowIndex) return;
        sheetsSyncBtn.disabled          = true;
        sheetsSyncBtnText.style.display = 'none';
        sheetsSyncLoader.style.display  = 'inline-block';
        try {
            const rowRes = await fetch(`${apiUrl}/api/sheet-row?userId=${encodeURIComponent(userId)}&spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}&rowIndex=${selectedRowIndex}`);
            if (!rowRes.ok) throw new Error('Error al leer la fila');
            const { sheetData } = await rowRes.json();
            const syncRes = await fetch(`${apiUrl}/api/sheet-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, consumoId: selectedConsumoId, sheetData })
            });
            if (!syncRes.ok) throw new Error('Error al sincronizar');
            const lead = loadedSheetLeads.find(l => l.id === selectedConsumoId);
            if (lead) lead.lead_data = { ...(lead.lead_data || {}), ...sheetData };
            setSheetsStatus('✓ Datos sincronizados correctamente');
            setTimeout(() => setSheetsStatus(''), 3500);
            renderDiff(lead?.lead_data || {}, sheetData, false);
        } catch (err) {
            setSheetsStatus(`Error: ${err.message}`, true);
        } finally {
            sheetsSyncBtnText.style.display = 'flex';
            sheetsSyncLoader.style.display  = 'none';
        }
    });

    sheetsBackBtn.addEventListener('click', () => {
        sheetsLeadList.style.display = 'block';
        sheetsDiffView.style.display = 'none';
        setSheetsStatus('');
    });

    // Track tab URL changes to detect Google Sheets navigation
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
        if (!tab.active || !changeInfo.url) return;
        const url = changeInfo.url;
        if (isGoogleSheetsUrl(url)) {
            if (url !== currentSheetsUrl) {
                currentSheetsUrl   = url;
                currentLinkedinUrl = '';
                enterSheetsMode(url).catch(() => {});
            }
        } else if (currentSheetsUrl) {
            exitSheetsMode();
            currentLinkedinUrl = url;
            updateUrlDisplay();
        }
    });

    // If sidepanel was opened while already on a Google Sheets tab
    if (isGoogleSheetsUrl(currentLinkedinUrl)) {
        currentSheetsUrl   = currentLinkedinUrl;
        currentLinkedinUrl = '';
        enterSheetsMode(currentSheetsUrl).catch(() => {});
    }

})();
