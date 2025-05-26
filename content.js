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

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.readOnly && !el.disabled) {
      createOverlay(el);
    }
  });
}
