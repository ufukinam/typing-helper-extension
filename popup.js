const sentenceInput = document.getElementById('sentence');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('list');
let sentences = [];

function render() {
  list.innerHTML = '';
  if (sentences.length === 0) {
    list.textContent = 'Eklenen cümle yok.';
    return;
  }

  sentences.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'sentence';

    const textSpan = document.createElement('span');
    textSpan.textContent = s;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => {
      sentences.splice(i, 1);
      chrome.storage.sync.set({ sentences });
      render();
    };

    div.appendChild(textSpan);
    div.appendChild(deleteBtn);
    list.appendChild(div);
  });
}

chrome.storage.sync.get(['sentences'], (result) => {
  if (result.sentences) {
    sentences = result.sentences;
    render();
  }
});

addBtn.onclick = () => {
  const text = sentenceInput.value.trim();
  if (text && !sentences.includes(text)) {
    sentences.push(text);
    chrome.storage.sync.set({ sentences });
    render();
    sentenceInput.value = '';
  }
};
