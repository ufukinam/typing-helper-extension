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

    // Create ghost overlay as a sibling, not by wrapping
    const ghost = document.createElement(isTextarea ? 'textarea' : 'input');
    ghost.disabled = true;
    ghost.className = 'autocomplete-ghost';
    ghost.style.position = 'absolute';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.color = '#aaa';
    ghost.style.background = 'transparent';
    ghost.style.borderColor = 'transparent';
    ghost.style.resize = 'none';
    ghost.style.overflow = 'hidden';

    cloneInputStyles(input, ghost);

    // Make ghost text semi-transparent
    const originalColor = getComputedStyle(input).color;
    const rgb = originalColor.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    // Insert ghost as sibling, before input
    input.parentNode.insertBefore(ghost, input);
    input.style.position = 'relative';
    input.style.zIndex = '10000';
    input.style.backgroundColor = 'transparent';
    input.style.background = 'transparent';

    // Positioning: ensure parent is relative
    const parent = input.parentNode;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    function updateGhostPosition() {
      const rect = input.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      ghost.style.top = (rect.top - parentRect.top + parent.scrollTop) + 'px';
      ghost.style.left = (rect.left - parentRect.left + parent.scrollLeft) + 'px';
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
    }
    updateGhostPosition();
    window.addEventListener('scroll', updateGhostPosition, true);
    window.addEventListener('resize', updateGhostPosition);

    // Remove ghost on blur or DOM removal
    function cleanupGhost() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      window.removeEventListener('scroll', updateGhostPosition, true);
      window.removeEventListener('resize', updateGhostPosition);
      suggestion = '';
    }

    input.addEventListener('input', () => {
      updateGhostPosition();
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

    input.addEventListener('blur', cleanupGhost);
  }

  function removeOverlay(input) {
    input.dataset.hasHintOverlay = '';
    // The cleanupGhost function inside createOverlay will handle removing the ghost
  }

  // Attach overlay on focus, remove on blur
  function attachOverlayEvents(input) {
    input.addEventListener('focus', () => {
      createOverlay(input);
      // On focus, trigger input event to update suggestion
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('blur', () => {
      removeOverlay(input);
    });
  }

  function createOverlayForEditable(el) {
    if (el.dataset.hasHintOverlay) return;
    el.dataset.hasHintOverlay = 'true';
  
    const ghost = document.createElement('div');
    ghost.className = 'autocomplete-ghost';
    ghost.style.position = 'absolute';
    ghost.style.zIndex = '9999';
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
  
    // Make ghost text semi-transparent
    const originalColor = style.color;
    const rgb = originalColor.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    el.parentNode.insertBefore(ghost, el);
    el.style.position = 'relative';
    el.style.zIndex = '10000';
    el.style.backgroundColor = 'transparent';
    el.style.background = 'transparent';
  
    // Positioning: ensure parent is relative
    const parent = el.parentNode;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    function updateGhostPosition() {
      const rect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      ghost.style.top = (rect.top - parentRect.top + parent.scrollTop) + 'px';
      ghost.style.left = (rect.left - parentRect.left + parent.scrollLeft) + 'px';
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
    }
    updateGhostPosition();
    window.addEventListener('scroll', updateGhostPosition, true);
    window.addEventListener('resize', updateGhostPosition);

    function cleanupGhost() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      window.removeEventListener('scroll', updateGhostPosition, true);
      window.removeEventListener('resize', updateGhostPosition);
      suggestion = '';
    }
  
    el.addEventListener('input', () => {
      updateGhostPosition();
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
  
    el.addEventListener('blur', cleanupGhost);
  }
  
  function removeOverlayForEditable(el) {
    el.dataset.hasHintOverlay = '';
    // The cleanupGhost function inside createOverlayForEditable will handle removing the ghost
  }

  function attachOverlayEventsForEditable(el) {
    el.addEventListener('focus', () => {
      createOverlayForEditable(el);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    el.addEventListener('blur', () => {
      removeOverlayForEditable(el);
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
        attachOverlayEvents(el);
        // If already focused, ensure overlay is present
        if (document.activeElement === el) {
          createOverlay(el);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } else if (el.isContentEditable) {
      attachOverlayEventsForEditable(el);
      if (document.activeElement === el) {
        createOverlayForEditable(el);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
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
