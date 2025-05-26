let suggestion = '';
let sentences = [];
let shortcuts = {};

const normalize = str => str.toLocaleLowerCase('tr-TR');

const hostname = window.location.hostname;

chrome.storage.sync.get(['sentences', 'allowedSites', 'shortcuts'], (result) => {
  sentences = result.sentences || [];
  const allowedSites = result.allowedSites || [];
  shortcuts = result.shortcuts || {};

  if (allowedSites.length > 0 && !allowedSites.some(site => hostname.includes(site))) {
    console.log('Site not explicitly allowed:', hostname);
    return;
  }

  console.log('Site allowed:', hostname);
  activateAutocomplete();
});

function activateAutocomplete () {
  function cloneInputStyles (source, target) {
    const style = getComputedStyle(source);
    for (const prop of [
      'font', 'fontSize', 'padding', 'margin', 'border', 'outline',
      'boxSizing', 'width', 'height', 'lineHeight', 'letterSpacing',
      'textAlign', 'borderRadius', 'boxShadow', 'backgroundColor',
      'color', 'whiteSpace'
    ]) {
      target.style[prop] = style[prop];
    }
  }

  function createOverlay (input) {
    if (input.dataset.hasHintOverlay) return;
    input.dataset.hasHintOverlay = 'true';

    const isTextarea = input.tagName === 'TEXTAREA';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = getComputedStyle(input).display === 'block' ? 'block' : 'inline-block';
    wrapper.style.width = input.offsetWidth + 'px';
    wrapper.style.height = input.offsetHeight + 'px';

    const ghost = document.createElement(isTextarea ? 'textarea' : 'input');
    ghost.disabled = true;
    ghost.className = 'autocomplete-ghost';
    ghost.style.position = 'absolute';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.zIndex = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.color = '#aaa';
    ghost.style.background = 'transparent';
    ghost.style.borderColor = 'transparent';
    ghost.style.resize = 'none';
    ghost.style.overflow = 'hidden';
    ghost.style.width = '100%';
    ghost.style.height = '100%';

    cloneInputStyles(input, ghost);

    // Make ghost text semi-transparent
    const originalColor = getComputedStyle(input).color;
    const rgb = originalColor.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    input.style.position = 'relative';
    input.style.zIndex = '1';
    input.style.backgroundColor = 'transparent';

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(ghost);
    wrapper.appendChild(input);

    input.addEventListener('input', () => {
      const value = input.value;
      if (!value.trim()) {
        ghost.value = '';
        suggestion = '';
        return;
      }

      // 🔍 Keyword detection
      const words = value.split(/\s+/);
      const lastWord = words[words.length - 1];
      const normalizedWord = normalize(lastWord);

      for (const [key, fullText] of Object.entries(shortcuts)) {
        if (normalize(key) === normalizedWord) {
          // Replace keyword with full sentence
          words[words.length - 1] = fullText;
          const newValue = words.join(' ');
          input.value = newValue;

          // Move cursor to end
          input.setSelectionRange(newValue.length, newValue.length);

          input.dispatchEvent(new InputEvent('input', {
            inputType: 'insertText',
            data: fullText,
            bubbles: true,
            cancelable: true
          }));

          return; // stop suggestion for now
        }
      }

      const match = sentences.find(s => normalize(s).startsWith(normalize(value)));
      if (match && normalize(match) !== normalize(value)) {
        ghost.value = match;
        suggestion = match;
      } else {
        ghost.value = '';
        suggestion = '';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && suggestion) {
        e.preventDefault();

        const value = input.value;
        const completion = suggestion.slice(value.length);

        // Try to insert like native typing
        const inserted = document.execCommand('insertText', false, completion);

        if (!inserted) {
          // Fallback if execCommand fails
          const start = input.selectionStart;
          const end = input.selectionEnd;
          const before = value.slice(0, start);
          const after = value.slice(end);
          input.value = before + completion + after;

          const cursorPos = before.length + completion.length;
          input.setSelectionRange(cursorPos, cursorPos);

          input.dispatchEvent(new InputEvent('input', {
            inputType: 'insertText',
            data: completion,
            bubbles: true,
            cancelable: true
          }));
        }

        ghost.value = '';
        suggestion = '';
      }
    });

    input.addEventListener('blur', () => {
      ghost.value = '';
      suggestion = '';
    });
  }

  function createOverlayForEditable(el) {
    if (el.dataset.hasHintOverlay) return;
    el.dataset.hasHintOverlay = 'true';
  
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = el.offsetWidth + 'px';
    wrapper.style.height = el.offsetHeight + 'px';
  
    const ghost = document.createElement('div');
    ghost.className = 'autocomplete-ghost';
    ghost.style.position = 'absolute';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.zIndex = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.color = 'rgba(0, 0, 0, 0.3)';
    ghost.style.whiteSpace = 'pre-wrap';
    ghost.style.wordBreak = 'break-word';
  
    const style = getComputedStyle(el);
    ghost.style.font = style.font;
    ghost.style.padding = style.padding;
    ghost.style.margin = style.margin;
    ghost.style.border = style.border;
    ghost.style.lineHeight = style.lineHeight;
    ghost.style.width = style.width;
    ghost.style.height = style.height;
  
    // Make ghost text semi-transparent
    const originalColor = style.color;
    const rgb = originalColor.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    el.style.position = 'relative';
    el.style.zIndex = '1';
    el.style.backgroundColor = 'transparent';
  
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(ghost);
    wrapper.appendChild(el);
  
    el.addEventListener('input', () => {
      const value = el.innerText;
      if (!value.trim()) {
        ghost.innerText = '';
        suggestion = '';
        return;
      }
  
      const words = value.split(/\s+/);
      const lastWord = words[words.length - 1];
      const normalizedWord = normalize(lastWord);

      //if (!lastWord.startsWith(triggerCharacter)) return;

      //const keyword = normalize(lastWord.slice(triggerCharacter.length));

      for (const [key, fullText] of Object.entries(shortcuts)) {
        if (normalize(key) === normalizedWord) {
          words[words.length - 1] = fullText;
          const newText = words.join(' ');
          el.innerText = newText;
          placeCaretAtEnd(el);
          ghost.innerText = '';
          suggestion = '';
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
          return;
        }
      }
  
      const match = sentences.find(s => normalize(s).startsWith(normalize(value)));
      if (match && normalize(match) !== normalize(value)) {
        ghost.innerText = match;
        suggestion = match;
      } else {
        ghost.innerText = '';
        suggestion = '';
      }
    });
  
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && suggestion) {
        e.preventDefault();
        const value = el.innerText;
        const completion = suggestion.slice(value.length);
        insertTextAtCursor(completion);
        suggestion = '';
        ghost.innerText = '';
      }
    });
  
    el.addEventListener('blur', () => {
      ghost.innerText = '';
      suggestion = '';
    });
  }
  
  // Helper: insert text at caret
  function insertTextAtCursor(text) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
  
    const range = sel.getRangeAt(0);
    range.deleteContents();
  
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
  
    // Move caret after inserted text
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  
    // Dispatch input event to notify changes
    const activeEl = sel.anchorNode?.parentElement;
    if (activeEl && activeEl.isContentEditable) {
      activeEl.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true
      }));
    }
  }
  
  // Helper: place caret at end of contenteditable
  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  
  document.addEventListener('focusin', (e) => {
    const el = e.target;
  
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.readOnly && !el.disabled) {
        createOverlay(el);
      }
    } else if (el.isContentEditable) {
      createOverlayForEditable(el);
  
      // Ensure keydown is directly attached
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && suggestion) {
          e.preventDefault();
          const value = el.innerText;
          const completion = suggestion.slice(value.length);
          insertTextAtCursor(completion);
          suggestion = '';
          const ghost = el.parentNode.querySelector('.autocomplete-ghost');
          if (ghost) ghost.innerText = '';
        }
      });
    }
  }); 
}
