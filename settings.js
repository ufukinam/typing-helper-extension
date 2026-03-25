const allowedInput = document.getElementById('allowedInput');
const addAllowedBtn = document.getElementById('addAllowedBtn');
const allowedList = document.getElementById('allowedList');
const triggerInput = document.getElementById('triggerCharacter');

const normalize = str => (str || '').toLocaleLowerCase();

function getTriggerCharacter(value = triggerInput.value) {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.charAt(0) : '#';
}

function normalizeDomain(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  try {
    let value = trimmed;
    if (!value.startsWith('http')) value = `https://${value}`;
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch (error) {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
}

function normalizeShortcutKey(input, triggerCharacter) {
  let key = normalize((input || '').trim());
  if (!key) return '';

  const normalizedTrigger = normalize(triggerCharacter);
  if (normalizedTrigger && key.startsWith(normalizedTrigger)) {
    key = key.slice(normalizedTrigger.length);
  }

  return key;
}

function normalizeShortcutMap(shortcuts, triggerCharacter) {
  const normalizedShortcuts = {};

  for (const [rawKey, rawValue] of Object.entries(shortcuts || {})) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    const key = normalizeShortcutKey(rawKey, triggerCharacter);

    if (key && value) {
      normalizedShortcuts[key] = value;
    }
  }

  return normalizedShortcuts;
}

function renderAllowedSites(sites) {
  allowedList.innerHTML = '';

  if (sites.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Izin verilen site yok.';
    allowedList.appendChild(li);
    return;
  }

  sites.forEach((site, index) => {
    const li = document.createElement('li');
    li.textContent = site;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.className = 'remove-btn';
    removeBtn.onclick = () => {
      sites.splice(index, 1);
      chrome.storage.sync.set({ allowedSites: sites }, () => renderAllowedSites(sites));
    };

    li.appendChild(removeBtn);
    allowedList.appendChild(li);
  });
}

function renderShortcuts(shortcuts) {
  const list = document.getElementById('shortcutList');
  const triggerCharacter = getTriggerCharacter();

  list.innerHTML = '';

  if (Object.keys(shortcuts).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Kisayol yok.';
    list.appendChild(li);
    return;
  }

  for (const [key, value] of Object.entries(shortcuts)) {
    const li = document.createElement('li');
    li.textContent = `${triggerCharacter}${key} -> ${value}`;

    const del = document.createElement('button');
    del.textContent = 'X';
    del.className = 'remove-btn';
    del.onclick = () => {
      delete shortcuts[key];
      chrome.storage.sync.set({ shortcuts }, () => renderShortcuts(shortcuts));
    };

    li.appendChild(del);
    list.appendChild(li);
  }
}

addAllowedBtn.addEventListener('click', () => {
  const newSite = normalizeDomain(allowedInput.value);
  if (!newSite) return;

  chrome.storage.sync.get(['allowedSites'], (result) => {
    const sites = result.allowedSites || [];

    if (sites.some(site => normalizeDomain(site) === newSite)) {
      alert('Bu site zaten listede.');
      allowedInput.value = '';
      return;
    }

    sites.push(newSite);
    chrome.storage.sync.set({ allowedSites: sites }, () => {
      renderAllowedSites(sites);
      allowedInput.value = '';
    });
  });
});

allowedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addAllowedBtn.click();
  }
});

document.getElementById('addShortcutBtn').onclick = () => {
  const keyInput = document.getElementById('shortcutKey');
  const valueInput = document.getElementById('shortcutValue');
  const triggerCharacter = getTriggerCharacter();
  const key = normalizeShortcutKey(keyInput.value, triggerCharacter);
  const value = valueInput.value.trim();

  if (!key || !value) return;

  chrome.storage.sync.get(['shortcuts'], (result) => {
    const shortcuts = normalizeShortcutMap(result.shortcuts || {}, triggerCharacter);

    if (shortcuts[key]) {
      alert('Bu kisayol zaten var.');
      return;
    }

    shortcuts[key] = value;
    chrome.storage.sync.set({ shortcuts }, () => {
      renderShortcuts(shortcuts);
      keyInput.value = '';
      valueInput.value = '';
    });
  });
};

document.getElementById('clearDataBtn').onclick = () => {
  chrome.storage.sync.clear(() => {
    triggerInput.value = '#';
    renderAllowedSites([]);
    renderShortcuts({});
  });
};

triggerInput.addEventListener('input', (event) => {
  const triggerCharacter = getTriggerCharacter(event.target.value);
  event.target.value = triggerCharacter;

  chrome.storage.sync.set({ triggerCharacter }, () => {
    chrome.storage.sync.get(['shortcuts'], (result) => {
      renderShortcuts(normalizeShortcutMap(result.shortcuts || {}, triggerCharacter));
    });
  });
});

chrome.storage.sync.get(['allowedSites', 'shortcuts', 'triggerCharacter'], (result) => {
  const triggerCharacter = getTriggerCharacter(result.triggerCharacter);
  const shortcuts = normalizeShortcutMap(result.shortcuts || {}, triggerCharacter);

  triggerInput.value = triggerCharacter;
  renderAllowedSites(result.allowedSites || []);
  renderShortcuts(shortcuts);

  if (JSON.stringify(shortcuts) !== JSON.stringify(result.shortcuts || {})) {
    chrome.storage.sync.set({ shortcuts });
  }
});
