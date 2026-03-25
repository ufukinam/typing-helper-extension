const Shared = globalThis.TypingHelperShared;
const settingsStore = Shared.createSettingsStore(chrome.storage.sync);

const allowedInput = document.getElementById('allowedInput');
const addAllowedBtn = document.getElementById('addAllowedBtn');
const allowedList = document.getElementById('allowedList');
const triggerInput = document.getElementById('triggerCharacter');
const acceptKeySelect = document.getElementById('acceptKey');
const languageSelect = document.getElementById('language');
const shortcutKeyInput = document.getElementById('shortcutKey');
const shortcutValueInput = document.getElementById('shortcutValue');
const shortcutList = document.getElementById('shortcutList');
const addShortcutBtn = document.getElementById('addShortcutBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

let settings = Shared.normalizeSettings({});

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

function renderAllowedSites() {
  allowedList.innerHTML = '';

  if (!settings.allowedSites.length) {
    const item = document.createElement('li');
    item.textContent = Shared.getMessage('noAllowedSites');
    allowedList.appendChild(item);
    return;
  }

  settings.allowedSites.forEach((site) => {
    const item = document.createElement('li');
    item.textContent = site;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = Shared.getMessage('removeButton');
    removeBtn.addEventListener('click', () => {
      void (async () => {
        await removeOrigins(Shared.getHostPermissionPatterns(site));

        const allowedSites = settings.allowedSites.filter((value) => value !== site);
        settingsStore.set({ allowedSites }, (nextSettings) => {
          settings = nextSettings;
          renderAllowedSites();
        });
      })();
    });

    item.appendChild(removeBtn);
    allowedList.appendChild(item);
  });
}

function renderShortcuts() {
  shortcutList.innerHTML = '';

  const entries = Object.entries(settings.shortcuts);
  if (!entries.length) {
    const item = document.createElement('li');
    item.textContent = Shared.getMessage('noShortcuts');
    shortcutList.appendChild(item);
    return;
  }

  entries.forEach(([key, value]) => {
    const item = document.createElement('li');
    item.textContent = `${settings.triggerCharacter}${key} -> ${value}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = Shared.getMessage('removeButton');
    removeBtn.addEventListener('click', () => {
      const shortcuts = { ...settings.shortcuts };
      delete shortcuts[key];

      settingsStore.set({ shortcuts }, (nextSettings) => {
        settings = nextSettings;
        renderShortcuts();
      });
    });

    item.appendChild(removeBtn);
    shortcutList.appendChild(item);
  });
}

function renderTypingSettings() {
  triggerInput.value = settings.triggerCharacter;
  acceptKeySelect.value = settings.acceptKey;
  languageSelect.value = settings.language;
}

addAllowedBtn.addEventListener('click', () => {
  void (async () => {
    const site = Shared.normalizeDomain(allowedInput.value);
    if (!site) {
      return;
    }

    if (settings.allowedSites.includes(site)) {
      alert(Shared.getMessage('duplicateSiteAlert'));
      allowedInput.value = '';
      return;
    }

    const granted = await requestOrigins(Shared.getHostPermissionPatterns(site));
    if (!granted) {
      alert(Shared.getMessage('sitePermissionDeniedAlert'));
      return;
    }

    settingsStore.set({ allowedSites: [...settings.allowedSites, site] }, (nextSettings) => {
      settings = nextSettings;
      allowedInput.value = '';
      renderAllowedSites();
    });
  })();
});

allowedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addAllowedBtn.click();
  }
});

addShortcutBtn.addEventListener('click', () => {
  const key = Shared.normalizeShortcutKey(shortcutKeyInput.value, settings.triggerCharacter);
  const value = shortcutValueInput.value.trim();

  if (!key || !value) {
    return;
  }

  if (settings.shortcuts[key]) {
    alert(Shared.getMessage('duplicateShortcutAlert'));
    return;
  }

  settingsStore.set({
    shortcuts: {
      ...settings.shortcuts,
      [key]: value
    }
  }, (nextSettings) => {
    settings = nextSettings;
    shortcutKeyInput.value = '';
    shortcutValueInput.value = '';
    renderShortcuts();
  });
});

triggerInput.addEventListener('input', (event) => {
  const triggerCharacter = Shared.getTriggerCharacter(event.target.value);
  event.target.value = triggerCharacter;

  settingsStore.set({
    triggerCharacter,
    shortcuts: settings.shortcuts
  }, (nextSettings) => {
    settings = nextSettings;
    renderShortcuts();
    renderTypingSettings();
  });
});

acceptKeySelect.addEventListener('change', (event) => {
  settingsStore.set({ acceptKey: event.target.value }, (nextSettings) => {
    settings = nextSettings;
    renderTypingSettings();
  });
});

languageSelect.addEventListener('change', (event) => {
  settingsStore.set({ language: event.target.value }, (nextSettings) => {
    settings = nextSettings;
    applyLanguage();
    renderAllowedSites();
    renderShortcuts();
    renderTypingSettings();
  });
});

clearDataBtn.addEventListener('click', () => {
  void (async () => {
    const origins = settings.allowedSites.flatMap((site) => Shared.getHostPermissionPatterns(site));
    if (origins.length) {
      await removeOrigins(origins);
    }

    settingsStore.clear((nextSettings) => {
      settings = nextSettings;
      applyLanguage();
      renderAllowedSites();
      renderShortcuts();
      renderTypingSettings();
    });
  })();
});

settingsStore.get((nextSettings) => {
  settings = nextSettings;
  applyLanguage();
  renderAllowedSites();
  renderShortcuts();
  renderTypingSettings();
});
