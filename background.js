importScripts('shared.js');

const Shared = globalThis.TypingHelperShared;
const settingsStore = Shared.createSettingsStore(chrome.storage.sync);
const SAVE_SELECTION_MENU_ID = 'save-selected-text';
const SCRIPT_FILES = ['shared.js', 'content.js'];
const PENDING_SITE_ENABLE_KEY = 'pendingSiteEnableDomain';
let contextMenuSyncToken = 0;

function containsOrigins(origins) {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins }, (result) => resolve(Boolean(result)));
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
  });
}

function getSettings() {
  return new Promise((resolve) => {
    settingsStore.get(resolve);
  });
}

function getLocalValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

function setLocalValue(patch) {
  return new Promise((resolve) => {
    chrome.storage.local.set(patch, () => resolve());
  });
}

function removeLocalValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => resolve());
  });
}

function isWebUrl(url) {
  return Boolean(url) && (url.startsWith('http://') || url.startsWith('https://'));
}

async function hasAccessForUrl(url, settings) {
  if (!isWebUrl(url)) {
    return false;
  }

  const domain = Shared.normalizeDomain(url);
  const matchedRule = Shared.findAllowedSiteMatch(domain, settings.allowedSites);
  if (!matchedRule) {
    return false;
  }

  return containsOrigins(Shared.getHostPermissionPatterns(matchedRule));
}

function executeContentScripts(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: SCRIPT_FILES
  }, () => {
    const errorMessage = chrome.runtime.lastError?.message || '';
    if (
      errorMessage &&
      !/Cannot access|No tab with id|The extensions gallery cannot be scripted|Frame with ID 0 was removed/i.test(errorMessage)
    ) {
      console.warn(errorMessage);
    }
  });
}

async function syncTabInjection(tab) {
  if (!tab?.id || !(await hasAccessForUrl(tab.url, await getSettings()))) {
    return;
  }

  executeContentScripts(tab.id);
}

async function syncOpenTabs(settings) {
  const tabs = await queryTabs({ url: ['http://*/*', 'https://*/*'] });

  for (const tab of tabs) {
    if (await hasAccessForUrl(tab.url, settings)) {
      executeContentScripts(tab.id);
    }
  }
}

async function syncAllowedSitesWithPermissions() {
  const settings = await getSettings();
  if (!settings.allowedSites.length) {
    return settings;
  }

  const grantedSites = [];
  for (const site of settings.allowedSites) {
    if (await containsOrigins(Shared.getHostPermissionPatterns(site))) {
      grantedSites.push(site);
    }
  }

  if (grantedSites.length === settings.allowedSites.length) {
    return settings;
  }

  return new Promise((resolve) => {
    settingsStore.set({ allowedSites: grantedSites }, (nextSettings) => resolve(nextSettings));
  });
}

function createContextMenu(languagePreference) {
  const syncToken = ++contextMenuSyncToken;

  chrome.contextMenus.removeAll(() => {
    if (syncToken !== contextMenuSyncToken) {
      return;
    }

    chrome.contextMenus.create({
      id: SAVE_SELECTION_MENU_ID,
      title: Shared.getMessage('saveSelectionContextMenu', undefined, languagePreference),
      contexts: ['selection']
    });
  });
}

function saveSelectedText(selectionText) {
  const value = (selectionText || '').trim();
  if (!value) {
    return;
  }

  settingsStore.get((settings) => {
    const nextSentences = Shared.normalizeSettings({
      ...settings,
      sentences: [...settings.sentences, value]
    }).sentences;

    settingsStore.set({ sentences: nextSentences });
  });
}

async function setPendingSiteEnable(domain) {
  const normalizedDomain = Shared.normalizeDomain(domain);
  if (!normalizedDomain) {
    await removeLocalValue(PENDING_SITE_ENABLE_KEY);
    return '';
  }

  await setLocalValue({ [PENDING_SITE_ENABLE_KEY]: normalizedDomain });
  return normalizedDomain;
}

async function clearPendingSiteEnable() {
  await removeLocalValue(PENDING_SITE_ENABLE_KEY);
}

async function addAllowedSite(domain) {
  const normalizedDomain = Shared.normalizeDomain(domain);
  if (!normalizedDomain) {
    return { ok: false };
  }

  const settings = await getSettings();
  if (settings.allowedSites.includes(normalizedDomain)) {
    await clearPendingSiteEnable();
    return { ok: true, settings };
  }

  return new Promise((resolve) => {
    settingsStore.set({
      allowedSites: [...settings.allowedSites, normalizedDomain]
    }, async (nextSettings) => {
      await clearPendingSiteEnable();
      resolve({ ok: true, settings: nextSettings });
    });
  });
}

async function finalizePendingSiteEnable() {
  const pendingDomain = await getLocalValue(PENDING_SITE_ENABLE_KEY);
  if (!pendingDomain) {
    return { ok: false };
  }

  if (!(await containsOrigins(Shared.getHostPermissionPatterns(pendingDomain)))) {
    return { ok: false };
  }

  return addAllowedSite(pendingDomain);
}

async function syncExtensionState() {
  const settings = await syncAllowedSitesWithPermissions();
  Shared.setLanguagePreference(settings.language);
  createContextMenu(settings.language);
  await syncOpenTabs(settings);
}

chrome.runtime.onInstalled.addListener(() => {
  syncExtensionState();
});

chrome.runtime.onStartup.addListener(() => {
  syncExtensionState();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') {
    return;
  }

  syncTabInjection({ ...tab, id: tabId });
});

chrome.permissions.onAdded.addListener(() => {
  finalizePendingSiteEnable();
  syncExtensionState();
});

chrome.permissions.onRemoved.addListener(() => {
  syncExtensionState();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== SAVE_SELECTION_MENU_ID) {
    return;
  }

  saveSelectedText(info.selectionText);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'prepare-enable-site') {
    void (async () => {
      const domain = await setPendingSiteEnable(message.domain);
      sendResponse({ ok: Boolean(domain), domain });
    })();
    return true;
  }

  if (message?.type === 'clear-pending-enable-site') {
    void (async () => {
      await clearPendingSiteEnable();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === 'finalize-enable-site') {
    void (async () => {
      const result = await addAllowedSite(message.domain);
      sendResponse(result);
    })();
    return true;
  }

  return false;
});

settingsStore.watch((settings) => {
  Shared.setLanguagePreference(settings.language);
  createContextMenu(settings.language);
  syncOpenTabs(settings);
});

syncExtensionState();
