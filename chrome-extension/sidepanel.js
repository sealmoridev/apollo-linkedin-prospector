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
let currentEnrichmentProvider = 'apollo';
let configuredProviders = [];
let triedProviders = { email: new Set(), phone: new Set() };
let apiUrl = 'https://mrprospect.app';
let tenantApiKey = '';
let lastProfileName = 'Prospecto';

// ─── Provider icon paths (relative — works from extension page) ──────────────
const getProviderIconUrl = (providerId) => {
    const iconMap = {
        apollo:    'assets/apolloicon.png',
        prospeo:   'assets/prospeoicon.png',
        findymail: 'assets/apolloicon.png',
        leadmagic: 'assets/apolloicon.png',
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
    pcSettingsBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
    document.getElementById('apPcHintOptionsBtn').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));
    optionsLink.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));

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

    obOptionsLink.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'openOptionsPage' }));

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
        } catch (e) {
            console.warn('[MRP] Could not load tenant providers:', e);
        }
    };

    const renderCascadeButtons = (field) => {
        const containerId = field === 'email' ? 'apCascadeEmail' : 'apCascadePhone';
        const container = document.getElementById(containerId);
        if (!container) return;

        const available = configuredProviders.filter(p =>
            p.fields.includes(field) &&
            p.id !== currentEnrichmentProvider &&
            !triedProviders[field].has(p.id)
        );

        if (available.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = '';

        const trigger = document.createElement('button');
        trigger.className = 'ap-btn-validate';
        trigger.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:10px; padding:3px 8px;';
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

    const handleCascadeSearch = async (field, provider) => {
        if (!extractedLeadData) return;

        const containerId = field === 'email' ? 'apCascadeEmail' : 'apCascadePhone';
        const container = document.getElementById(containerId);
        const valueEl = document.getElementById(field === 'email' ? 'apDataEmail' : 'apDataPhone');

        if (container) {
            container.innerHTML = `<span style="font-size:10px; color:#94a3b8; display:flex; align-items:center; gap:4px;"><span class="ap-loader" style="display:inline-block; border-color:#94a3b8 transparent transparent transparent; width:10px; height:10px;"></span> Buscando con ${provider.name}...</span>`;
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

            if (data.found && data.value) {
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
                } else {
                    extractedLeadData.phoneNumber = data.value;
                    if (valueEl) valueEl.textContent = data.value;
                    const phoneBtn = document.getElementById('apRequestPhoneBtn');
                    if (phoneBtn) phoneBtn.style.display = 'none';
                }
                if (container) {
                    const iconUrl = getProviderIconUrl(provider.id);
                    container.innerHTML = `<span style="display:flex; align-items:center; gap:4px; font-size:10px; color:#16a34a; background:#dcfce7; border-radius:20px; padding:2px 7px; width:fit-content;"><img src="${iconUrl}" style="width:11px;height:11px;object-fit:contain;"> ${provider.name} ✓</span>`;
                }
            } else {
                if (container) {
                    container.innerHTML = '';
                    const notFoundLabel = document.createElement('span');
                    notFoundLabel.style.cssText = 'font-size:10px; color:#94a3b8;';
                    notFoundLabel.textContent = `${provider.name}: no encontrado`;
                    container.appendChild(notFoundLabel);
                }
                setTimeout(() => renderCascadeButtons(field), 1200);
            }
        } catch (err) {
            if (container) {
                container.innerHTML = '';
                renderCascadeButtons(field);
            }
        }
    };

    // ── State transitions ────────────────────────────────────────────────────

    const resetToExtractState = () => {
        extractSection.style.display = 'flex';
        previewSection.style.display = 'none';
        extractedLeadData = null;

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

        // Cascade: email
        if (!leadData.email && !leadData.primaryEmail) {
            triedProviders.email.add(currentEnrichmentProvider);
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
            triedProviders.phone.add(currentEnrichmentProvider);
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
            currentSesionId = crypto.randomUUID();
            hasExtractedCurrentProfile = false;
            triedProviders = { email: new Set(), phone: new Set() };
            updateUrlDisplay();
            resetToExtractState();
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
    cancelBtn.addEventListener('click', resetToExtractState);

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
                validateEmailBtn.style.display = 'none';
                emailBadge.style.display = 'inline-flex';

                if (data.status === 'valid') {
                    emailBadge.className = 'ap-badge ap-badge-valid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Válido';
                } else if (data.status === 'invalid') {
                    emailBadge.className = 'ap-badge ap-badge-invalid';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Inválido';
                } else if (data.status === 'catch_all') {
                    emailBadge.className = 'ap-badge ap-badge-catchall';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg> Catch-All';
                } else {
                    emailBadge.className = 'ap-badge ap-badge-unknown';
                    emailBadge.innerHTML = '<svg style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg> Error/Desc';
                }

                extractedLeadData.emailStatus = data.status;
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

        try {
            const response = await fetch(`${apiUrl}/api/sheets/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    spreadsheetId: selectedSheetId,
                    lead: extractedLeadData,
                    sheetName: customSheetName,
                    sesion_id: currentSesionId,
                    provider: currentEnrichmentProvider
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Fallo al guardar en Sheets');

            if (data.success) {
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

})();
