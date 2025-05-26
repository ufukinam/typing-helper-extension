const allowedInput = document.getElementById('allowedInput');
const addAllowedBtn = document.getElementById('addAllowedBtn');
const allowedList = document.getElementById('allowedList');

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

// Initial render
chrome.storage.sync.get(['allowedSites'], (result) => {
  renderAllowedSites(result.allowedSites || []);
});
