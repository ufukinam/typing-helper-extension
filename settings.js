const allowedInput = document.getElementById('allowedInput');
const addAllowedBtn = document.getElementById('addAllowedBtn');
const allowedList = document.getElementById('allowedList');

const normalize = str => str.toLocaleLowerCase('tr-TR');

// Normalize domain: remove protocols, www, trailing slashes, paths, etc.
function normalizeDomain(input) {
  try {
    // If it doesn't include protocol, prepend for parsing
    if (!input.startsWith('http')) input = 'https://' + input;
    const url = new URL(input);
    return url.hostname.replace(/^www\./, '');
  } catch (e) {
    // fallback if URL parsing fails
    return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function renderAllowedSites(sites) {
  allowedList.innerHTML = '';
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
  list.innerHTML = '';
  for (const [key, value] of Object.entries(shortcuts)) {
    const li = document.createElement('li');
    li.textContent = `${key} → ${value}`;
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
  let newSite = normalizeDomain(allowedInput.value);
  if (!newSite) return;

  chrome.storage.sync.get(['allowedSites'], (result) => {
    let sites = result.allowedSites || [];

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

allowedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addAllowedBtn.click();
  }
});

document.getElementById('addShortcutBtn').onclick = () => {
  const keyInput = document.getElementById('shortcutKey');
  const valueInput = document.getElementById('shortcutValue');
  const key = normalize(keyInput.value);
  const value = valueInput.value.trim();
  if (!key.startsWith('#') || !value) return;

  chrome.storage.sync.get(['shortcuts'], (res) => {
    const shortcuts = res.shortcuts || {};
    if (!shortcuts[key]) {
      shortcuts[key] = value;
      chrome.storage.sync.set({ shortcuts }, () => renderShortcuts(shortcuts));
    }
    keyInput.value = '';
    valueInput.value = '';
  });
};

// Initial render
chrome.storage.sync.get(['allowedSites', 'shortcuts'], (result) => {
  renderAllowedSites(result.allowedSites || []);
  renderShortcuts(result.shortcuts || {});
});
