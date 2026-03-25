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

Shared.localizeDocument(document);

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

function renderCurrentSite() {
  if (!currentDomain) {
    currentSiteLabel.textContent = Shared.getMessage('siteUnavailable');
    siteStatusLabel.textContent = Shared.getMessage('siteUnavailableDescription');
    toggleSiteBtn.textContent = Shared.getMessage('siteUnavailableAction');
    toggleSiteBtn.disabled = true;
    return;
  }

  currentSiteLabel.textContent = currentDomain;
  toggleSiteBtn.disabled = false;

  const whitelistEnabled = settings.allowedSites.length > 0;
  const currentAllowed = Shared.isSiteAllowed(currentDomain, settings.allowedSites);

  if (!whitelistEnabled) {
    siteStatusLabel.textContent = Shared.getMessage('currentSiteStatusGlobal');
    toggleSiteBtn.textContent = Shared.getMessage('currentSiteActionRestrict');
    return;
  }

  siteStatusLabel.textContent = currentAllowed
    ? Shared.getMessage('currentSiteStatusAllowed')
    : Shared.getMessage('currentSiteStatusBlocked');
  toggleSiteBtn.textContent = currentAllowed
    ? Shared.getMessage('disableCurrentSiteButton')
    : Shared.getMessage('enableCurrentSiteButton');
}

async function loadCurrentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    currentDomain = '';
    renderCurrentSite();
    return;
  }

  currentDomain = Shared.normalizeDomain(tab.url);
  renderCurrentSite();
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

  let nextAllowedSites;
  if (!settings.allowedSites.length) {
    nextAllowedSites = [currentDomain];
  } else if (Shared.isSiteAllowed(currentDomain, settings.allowedSites)) {
    nextAllowedSites = settings.allowedSites.filter((site) => site !== currentDomain);
  } else {
    nextAllowedSites = [...settings.allowedSites, currentDomain];
  }

  settingsStore.set({ allowedSites: nextAllowedSites }, (nextSettings) => {
    settings = nextSettings;
    renderCurrentSite();
  });
});

openSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

settingsStore.get((nextSettings) => {
  settings = nextSettings;
  renderSentences();
  renderCurrentSite();
});

loadCurrentDomain();
