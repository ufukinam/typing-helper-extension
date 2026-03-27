const Shared = globalThis.TypingHelperShared;
const settingsStore = Shared.createSettingsStore(chrome.storage.sync);

const sentenceInput = document.getElementById('sentence');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('list');
const currentSiteLabel = document.getElementById('currentSite');
const siteStatusLabel = document.getElementById('siteStatus');
const toggleSiteBtn = document.getElementById('toggleSiteBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');

let settings = Shared.normalizeSettings({});
let currentDomain = '';

function containsOrigins(origins) {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins }, (result) => resolve(Boolean(result)));
  });
}

function requestOrigins(origins) {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins }, (result) => resolve(Boolean(result)));
  });
}

function removeOrigins(origins) {
  return new Promise((resolve) => {
    chrome.permissions.remove({ origins }, (result) => resolve(Boolean(result)));
  });
}

function applyLanguage() {
  Shared.setLanguagePreference(settings.language);
  Shared.localizeDocument(document, settings.language);
}

function renderSentences() {
  list.innerHTML = '';

  if (!settings.sentences.length) {
    const empty = document.createElement('p');
    empty.textContent = Shared.getMessage('noSentences');
    list.appendChild(empty);
    return;
  }

  settings.sentences.forEach((sentence, index) => {
    const row = document.createElement('div');
    row.className = 'sentence';

    const text = document.createElement('span');
    text.textContent = sentence;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', Shared.getMessage('deleteTextButton'));
    deleteBtn.title = Shared.getMessage('deleteTextButton');
    deleteBtn.textContent = 'X';
    deleteBtn.addEventListener('click', () => {
      const sentences = settings.sentences.filter((_, itemIndex) => itemIndex !== index);
      settingsStore.set({ sentences }, (nextSettings) => {
        settings = nextSettings;
        renderSentences();
      });
    });

    row.appendChild(text);
    row.appendChild(deleteBtn);
    list.appendChild(row);
  });
}

async function renderCurrentSite() {
  if (!currentDomain) {
    currentSiteLabel.textContent = Shared.getMessage('siteUnavailable');
    siteStatusLabel.textContent = Shared.getMessage('siteUnavailableDescription');
    toggleSiteBtn.textContent = Shared.getMessage('siteUnavailableAction');
    toggleSiteBtn.disabled = true;
    return;
  }

  currentSiteLabel.textContent = currentDomain;

  const whitelistEnabled = settings.allowedSites.length > 0;
  const matchedRule = Shared.findAllowedSiteMatch(currentDomain, settings.allowedSites);
  const hasExactRule = settings.allowedSites.includes(currentDomain);
  const permissionGranted = matchedRule
    ? await containsOrigins(Shared.getHostPermissionPatterns(matchedRule))
    : false;
  const currentAllowed = Boolean(matchedRule);

  if (!whitelistEnabled) {
    toggleSiteBtn.disabled = false;
    siteStatusLabel.textContent = Shared.getMessage('currentSiteStatusGlobal');
    toggleSiteBtn.textContent = Shared.getMessage('enableCurrentSiteButton');
    return;
  }

  if (currentAllowed && permissionGranted && !hasExactRule) {
    toggleSiteBtn.disabled = true;
    siteStatusLabel.textContent = Shared.getMessage('currentSiteStatusInherited', [matchedRule]);
    toggleSiteBtn.textContent = Shared.getMessage('currentSiteManagedByParentAction');
    return;
  }

  toggleSiteBtn.disabled = false;

  siteStatusLabel.textContent = currentAllowed && permissionGranted
    ? Shared.getMessage('currentSiteStatusAllowed')
    : Shared.getMessage('currentSiteStatusBlocked');
  toggleSiteBtn.textContent = currentAllowed && permissionGranted
    ? Shared.getMessage('disableCurrentSiteButton')
    : Shared.getMessage('enableCurrentSiteButton');
}

async function loadCurrentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    currentDomain = '';
    void renderCurrentSite();
    return;
  }

  currentDomain = Shared.normalizeDomain(tab.url);
  void renderCurrentSite();
}

addBtn.addEventListener('click', () => {
  const value = sentenceInput.value.trim();
  if (!value) {
    return;
  }

  const nextSentences = Shared.normalizeSettings({
    ...settings,
    sentences: [...settings.sentences, value]
  }).sentences;

  settingsStore.set({ sentences: nextSentences }, (nextSettings) => {
    settings = nextSettings;
    sentenceInput.value = '';
    renderSentences();
  });
});

sentenceInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    addBtn.click();
  }
});

toggleSiteBtn.addEventListener('click', () => {
  if (!currentDomain) {
    return;
  }

  toggleSiteBtn.disabled = true;

  void (async () => {
    const matchedRule = Shared.findAllowedSiteMatch(currentDomain, settings.allowedSites);
    const hasExactRule = settings.allowedSites.includes(currentDomain);
    const permissionGranted = matchedRule
      ? await containsOrigins(Shared.getHostPermissionPatterns(matchedRule))
      : false;
    let nextAllowedSites;

    if (!matchedRule || !permissionGranted) {
      await chrome.runtime.sendMessage({
        type: 'prepare-enable-site',
        domain: currentDomain
      });

      const granted = await requestOrigins(Shared.getHostPermissionPatterns(currentDomain));
      if (!granted) {
        await chrome.runtime.sendMessage({
          type: 'clear-pending-enable-site'
        });
        await renderCurrentSite();
        alert(Shared.getMessage('sitePermissionDeniedAlert'));
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'finalize-enable-site',
        domain: currentDomain
      });

      if (response?.settings) {
        settings = response.settings;
      }

      await renderCurrentSite();
      return;
    } else if (hasExactRule) {
      await removeOrigins(Shared.getHostPermissionPatterns(currentDomain));
      nextAllowedSites = settings.allowedSites.filter((site) => site !== currentDomain);
    } else {
      await renderCurrentSite();
      return;
    }

    await new Promise((resolve) => {
      settingsStore.set({ allowedSites: nextAllowedSites }, (nextSettings) => {
        settings = nextSettings;
        resolve();
      });
    });
  })().finally(() => {
    void renderCurrentSite();
  });
});

openSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

settingsStore.get((nextSettings) => {
  settings = nextSettings;
  applyLanguage();
  renderSentences();
  void renderCurrentSite();
});

loadCurrentDomain();
