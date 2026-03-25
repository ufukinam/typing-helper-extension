let suggestion = '';
let suggestionMatches = [];
let suggestionIndex = 0;
let suggestionTarget = null;
let sentences = [];
let shortcuts = {};
let allowedSites = [];
let triggerCharacter = '#';

const hostname = window.location.hostname.toLowerCase();
const wiredInputs = new WeakSet();
const wiredEditables = new WeakSet();
const inputHistoryState = new WeakMap();

const normalize = str => (str || '').toLocaleLowerCase();

function normalizeDomain(input) {
  const trimmed = (input || '').trim().toLowerCase();
  if (!trimmed) return '';

  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function applySettings(result) {
  if (Object.prototype.hasOwnProperty.call(result, 'sentences')) {
    sentences = Array.isArray(result.sentences) ? result.sentences.filter(Boolean) : [];
  }

  if (Object.prototype.hasOwnProperty.call(result, 'allowedSites')) {
    allowedSites = Array.isArray(result.allowedSites)
      ? result.allowedSites.map(normalizeDomain).filter(Boolean)
      : [];
  }

  if (Object.prototype.hasOwnProperty.call(result, 'shortcuts')) {
    shortcuts = typeof result.shortcuts === 'object' && result.shortcuts !== null
      ? result.shortcuts
      : {};
  }

  if (Object.prototype.hasOwnProperty.call(result, 'triggerCharacter')) {
    const nextTrigger = typeof result.triggerCharacter === 'string' ? result.triggerCharacter.trim() : '';
    triggerCharacter = nextTrigger ? nextTrigger.charAt(0) : '#';
  }
}

function isSiteAllowed() {
  if (allowedSites.length === 0) {
    return true;
  }

  return allowedSites.some(site => hostname === site || hostname.endsWith(`.${site}`));
}

function isSupportedInput(input) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    return false;
  }

  if (input.readOnly || input.disabled) {
    return false;
  }

  if (input instanceof HTMLTextAreaElement) {
    return true;
  }

  return ['', 'text', 'search', 'url', 'tel', 'email'].includes((input.type || '').toLowerCase());
}

function clearSuggestionState(target = null) {
  suggestion = '';
  suggestionMatches = [];
  suggestionIndex = 0;
  suggestionTarget = target;
}

function getSentenceMatches(value) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) {
    return [];
  }

  return sentences.filter(sentence => normalize(sentence).startsWith(normalizedValue));
}

function setSuggestionMatches(target, matches) {
  suggestionTarget = target;
  suggestionMatches = matches;
  suggestionIndex = 0;
  suggestion = matches[0] || '';
}

function cycleSuggestion(target, direction) {
  if (suggestionTarget !== target || suggestionMatches.length === 0) {
    return '';
  }

  suggestionIndex = (suggestionIndex + direction + suggestionMatches.length) % suggestionMatches.length;
  suggestion = suggestionMatches[suggestionIndex] || '';
  return suggestion;
}

function hasMultipleSuggestions(target) {
  return suggestionTarget === target && suggestionMatches.length > 1;
}

function isUndoShortcut(event) {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
}

function setInputValue(input, value) {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
}

function getInputSnapshot(input) {
  const value = input.value || '';
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;

  return { value, start, end };
}

function snapshotsEqual(left, right) {
  return Boolean(left) &&
    Boolean(right) &&
    left.value === right.value &&
    left.start === right.start &&
    left.end === right.end;
}

function getInputHistory(input) {
  let history = inputHistoryState.get(input);
  if (!history) {
    history = {
      snapshots: [],
      pointer: -1,
      isRestoring: false
    };
    inputHistoryState.set(input, history);
  }

  return history;
}

function pushInputSnapshot(input) {
  const history = getInputHistory(input);
  if (history.isRestoring) {
    return;
  }

  const snapshot = getInputSnapshot(input);
  const current = history.snapshots[history.pointer];
  if (snapshotsEqual(current, snapshot)) {
    return;
  }

  history.snapshots = history.snapshots.slice(0, history.pointer + 1);
  history.snapshots.push(snapshot);

  if (history.snapshots.length > 100) {
    history.snapshots.shift();
  }

  history.pointer = history.snapshots.length - 1;
}

function restoreInputSnapshot(input, snapshot) {
  const history = getInputHistory(input);
  history.isRestoring = true;

  setInputValue(input, snapshot.value);
  input.setSelectionRange(snapshot.start, snapshot.end);
  input.dispatchEvent(new Event('input', { bubbles: true }));

  history.isRestoring = false;
}

function undoInputHistory(input) {
  const history = getInputHistory(input);
  if (history.pointer <= 0) {
    return false;
  }

  history.pointer -= 1;
  restoreInputSnapshot(input, history.snapshots[history.pointer]);
  return true;
}

function findShortcutExpansion(lastWord) {
  const normalizedWord = normalize(lastWord);
  if (!normalizedWord) {
    return '';
  }

  const normalizedTrigger = normalize(triggerCharacter);
  if (!normalizedTrigger || !normalizedWord.startsWith(normalizedTrigger)) {
    return '';
  }

  const normalizedShortcutKey = normalizedWord.slice(normalizedTrigger.length);
  if (!normalizedShortcutKey) {
    return '';
  }

  for (const [key, value] of Object.entries(shortcuts)) {
    const normalizedKey = normalize(key);
    if (normalizedShortcutKey === normalizedKey) {
      return value;
    }
  }

  return '';
}

function triggerActiveElementRefresh() {
  const activeElement = document.activeElement;
  if (!activeElement || !isSiteAllowed()) {
    clearSuggestionState();
    return;
  }

  activeElement.dispatchEvent(new Event('input', { bubbles: true }));
}

function activateAutocomplete() {
  function cloneInputStyles(source, target) {
    const style = getComputedStyle(source);
    for (const prop of [
      'font',
      'fontSize',
      'padding',
      'margin',
      'border',
      'outline',
      'boxSizing',
      'width',
      'height',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'borderRadius',
      'boxShadow',
      'backgroundColor',
      'color',
      'whiteSpace'
    ]) {
      target.style[prop] = style[prop];
    }
  }

  function clearGhostValue(ghost) {
    if (ghost instanceof HTMLInputElement || ghost instanceof HTMLTextAreaElement) {
      ghost.value = '';
    } else {
      ghost.textContent = '';
    }
  }

  function createOverlay(input) {
    if (input.dataset.hasHintOverlay === 'true' || !isSiteAllowed()) return;
    input.dataset.hasHintOverlay = 'true';

    const ghost = document.createElement(input.tagName === 'TEXTAREA' ? 'textarea' : 'input');
    ghost.disabled = true;
    ghost.tabIndex = -1;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.className = 'autocomplete-ghost';
    ghost.style.position = 'absolute';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.background = 'transparent';
    ghost.style.borderColor = 'transparent';
    ghost.style.resize = 'none';
    ghost.style.overflow = 'hidden';

    cloneInputStyles(input, ghost);

    const originalColor = getComputedStyle(input).color;
    const rgb = originalColor.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    const parent = input.parentNode;
    if (!parent) return;

    parent.insertBefore(ghost, input);

    const originalStyles = {
      inputPosition: input.style.position,
      inputZIndex: input.style.zIndex,
      inputBackground: input.style.background,
      inputBackgroundColor: input.style.backgroundColor,
      parentPosition: parent.style.position
    };

    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    if (getComputedStyle(input).position === 'static') {
      input.style.position = 'relative';
    }

    input.style.zIndex = '10000';
    input.style.background = 'transparent';
    input.style.backgroundColor = 'transparent';

    function updateGhostPosition() {
      if (!ghost.isConnected || !input.isConnected) return;

      const rect = input.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      ghost.style.top = `${rect.top - parentRect.top + parent.scrollTop}px`;
      ghost.style.left = `${rect.left - parentRect.left + parent.scrollLeft}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
    }

    function cleanupGhost() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      window.removeEventListener('scroll', updateGhostPosition, true);
      window.removeEventListener('resize', updateGhostPosition);
      input.removeEventListener('scroll', updateGhostPosition);

      input.style.position = originalStyles.inputPosition;
      input.style.zIndex = originalStyles.inputZIndex;
      input.style.background = originalStyles.inputBackground;
      input.style.backgroundColor = originalStyles.inputBackgroundColor;
      parent.style.position = originalStyles.parentPosition;

      input.dataset.hasHintOverlay = '';
      input._autocompleteGhost = null;
      input._autocompleteUpdateGhostPosition = null;
      clearSuggestionState();
    }

    input._autocompleteCleanup = cleanupGhost;
    input._autocompleteGhost = ghost;
    input._autocompleteUpdateGhostPosition = updateGhostPosition;

    updateGhostPosition();
    window.addEventListener('scroll', updateGhostPosition, true);
    window.addEventListener('resize', updateGhostPosition);
    input.addEventListener('scroll', updateGhostPosition);

    if (!input._autocompleteHandlersAttached) {
      input._autocompleteHandlersAttached = true;

      input.addEventListener('input', () => {
        const currentGhost = input._autocompleteGhost;
        if (!currentGhost) return;
        pushInputSnapshot(input);

        if (!isSiteAllowed()) {
          clearGhostValue(currentGhost);
          clearSuggestionState();
          return;
        }

        input._autocompleteUpdateGhostPosition?.();
        const value = input.value || '';

        if (!value.trim()) {
          clearGhostValue(currentGhost);
          clearSuggestionState(input);
          return;
        }

        const words = value.split(/\s+/);
        const lastWord = words[words.length - 1];
        const fullText = findShortcutExpansion(lastWord);

        if (fullText) {
          const start = input.selectionStart;
          const end = input.selectionEnd;
          if (start !== null && end !== null) {
            const replaceStart = start - lastWord.length;
            if (replaceStart >= 0) {
              input.focus();
              input.setSelectionRange(replaceStart, end);

              const inserted = typeof document.execCommand === 'function' &&
                document.execCommand('insertText', false, fullText);

              if (!inserted) {
                const before = input.value.slice(0, replaceStart);
                const after = input.value.slice(end);
                input.value = before + fullText + after;
                const cursorPos = before.length + fullText.length;
                input.setSelectionRange(cursorPos, cursorPos);
                input.dispatchEvent(new InputEvent('input', {
                  inputType: 'insertReplacementText',
                  data: fullText,
                  bubbles: true,
                  cancelable: true
                }));
              }

              clearGhostValue(currentGhost);
              clearSuggestionState(input);
              return;
            }
          }
        }

        const matches = getSentenceMatches(value).filter(match => normalize(match) !== normalize(value));
        if (matches.length > 0) {
          setSuggestionMatches(input, matches);
          currentGhost.value = suggestion;
        } else {
          clearGhostValue(currentGhost);
          clearSuggestionState(input);
        }
      });

      input.addEventListener('keydown', (event) => {
        const currentGhost = input._autocompleteGhost;
        if (!currentGhost) return;

        if (isUndoShortcut(event) && undoInputHistory(input)) {
          event.preventDefault();
          return;
        }

        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasMultipleSuggestions(input)) {
          event.preventDefault();
          currentGhost.value = cycleSuggestion(input, event.key === 'ArrowDown' ? 1 : -1);
          return;
        }

        if (event.key === 'Tab' && suggestionTarget === input && suggestion) {
          event.preventDefault();
          replaceInputValueWithSuggestion(input, suggestion);
          clearGhostValue(currentGhost);
          clearSuggestionState(input);
        }
      });
    }

    input.addEventListener('blur', cleanupGhost, { once: true });
  }

  function attachOverlayEvents(input) {
    if (wiredInputs.has(input)) return;
    wiredInputs.add(input);

    input.addEventListener('focus', () => {
      pushInputSnapshot(input);
      createOverlay(input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function getEditableText(element) {
    return (element.innerText || '').replace(/\u00a0/g, ' ');
  }

  function insertTextAtCursor(text) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;

    const inserted = typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, text);
    if (inserted) return true;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const editable = textNode.parentElement?.closest('[contenteditable=""], [contenteditable="true"]');
    if (editable) {
      editable.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true
      }));
    }

    return true;
  }

  function replaceInputValueWithSuggestion(input, nextValue) {
    input.focus();
    setInputValue(input, nextValue);
    const cursorPos = nextValue.length;
    input.setSelectionRange(cursorPos, cursorPos);
    input.dispatchEvent(new InputEvent('input', {
      inputType: 'insertReplacementText',
      data: nextValue,
      bubbles: true,
      cancelable: true
    }));
  }

  function replaceEditableValueWithSuggestion(element, nextValue) {
    const selection = window.getSelection();
    if (!selection) return;

    const replacementRange = document.createRange();
    replacementRange.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(replacementRange);
    element.focus();

    const inserted = typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, nextValue);

    if (inserted) return;

    element.textContent = nextValue;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new InputEvent('input', {
      inputType: 'insertReplacementText',
      data: nextValue,
      bubbles: true,
      cancelable: true
    }));
  }

  function createOverlayForEditable(element) {
    if (element.dataset.hasHintOverlay === 'true' || !isSiteAllowed()) return;
    element.dataset.hasHintOverlay = 'true';

    const ghost = document.createElement('div');
    ghost.className = 'autocomplete-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.position = 'absolute';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.whiteSpace = 'pre-wrap';
    ghost.style.wordBreak = 'break-word';

    const style = getComputedStyle(element);
    ghost.style.font = style.font;
    ghost.style.padding = style.padding;
    ghost.style.margin = style.margin;
    ghost.style.border = style.border;
    ghost.style.lineHeight = style.lineHeight;

    const rgb = style.color.match(/\d+/g);
    if (rgb) {
      ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
    }

    const parent = element.parentNode;
    if (!parent) return;

    parent.insertBefore(ghost, element);

    const originalStyles = {
      elementPosition: element.style.position,
      elementZIndex: element.style.zIndex,
      elementBackground: element.style.background,
      elementBackgroundColor: element.style.backgroundColor,
      parentPosition: parent.style.position
    };

    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }

    element.style.zIndex = '10000';
    element.style.background = 'transparent';
    element.style.backgroundColor = 'transparent';

    function updateGhostPosition() {
      if (!ghost.isConnected || !element.isConnected) return;

      const rect = element.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      ghost.style.top = `${rect.top - parentRect.top + parent.scrollTop}px`;
      ghost.style.left = `${rect.left - parentRect.left + parent.scrollLeft}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
    }

    function cleanupGhost() {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      window.removeEventListener('scroll', updateGhostPosition, true);
      window.removeEventListener('resize', updateGhostPosition);
      element.removeEventListener('scroll', updateGhostPosition);

      element.style.position = originalStyles.elementPosition;
      element.style.zIndex = originalStyles.elementZIndex;
      element.style.background = originalStyles.elementBackground;
      element.style.backgroundColor = originalStyles.elementBackgroundColor;
      parent.style.position = originalStyles.parentPosition;

      element.dataset.hasHintOverlay = '';
      element._autocompleteGhost = null;
      element._autocompleteUpdateGhostPosition = null;
      clearSuggestionState();
    }

    element._autocompleteCleanup = cleanupGhost;
    element._autocompleteGhost = ghost;
    element._autocompleteUpdateGhostPosition = updateGhostPosition;

    updateGhostPosition();
    window.addEventListener('scroll', updateGhostPosition, true);
    window.addEventListener('resize', updateGhostPosition);
    element.addEventListener('scroll', updateGhostPosition);

    if (!element._autocompleteHandlersAttached) {
      element._autocompleteHandlersAttached = true;

      element.addEventListener('input', () => {
        const currentGhost = element._autocompleteGhost;
        if (!currentGhost) return;

        if (!isSiteAllowed()) {
          clearGhostValue(currentGhost);
          clearSuggestionState();
          return;
        }

        element._autocompleteUpdateGhostPosition?.();
        const value = getEditableText(element);

        if (!value.trim()) {
          clearGhostValue(currentGhost);
          clearSuggestionState(element);
          return;
        }

        const words = value.split(/\s+/);
        const lastWord = words[words.length - 1];
        const fullText = findShortcutExpansion(lastWord);

        if (fullText) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0);

            if (range.endContainer.nodeType === Node.TEXT_NODE) {
              const startOffset = range.endOffset - lastWord.length;
              if (startOffset >= 0) {
                const replacementRange = document.createRange();
                replacementRange.setStart(range.endContainer, startOffset);
                replacementRange.setEnd(range.endContainer, range.endOffset);
                selection.removeAllRanges();
                selection.addRange(replacementRange);
                element.focus();

                const inserted = typeof document.execCommand === 'function' &&
                  document.execCommand('insertText', false, fullText);

                if (!inserted) {
                  replacementRange.deleteContents();
                  const textNode = document.createTextNode(fullText);
                  replacementRange.insertNode(textNode);
                  replacementRange.setStartAfter(textNode);
                  replacementRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(replacementRange);
                  element.dispatchEvent(new InputEvent('input', {
                    inputType: 'insertReplacementText',
                    data: fullText,
                    bubbles: true,
                    cancelable: true
                  }));
                }

                clearGhostValue(currentGhost);
                clearSuggestionState(element);
                return;
              }
            }
          }
        }

        const matches = getSentenceMatches(value).filter(match => normalize(match) !== normalize(value));
        if (matches.length > 0) {
          setSuggestionMatches(element, matches);
          currentGhost.textContent = suggestion;
        } else {
          clearGhostValue(currentGhost);
          clearSuggestionState(element);
        }
      });

      element.addEventListener('keydown', (event) => {
        const currentGhost = element._autocompleteGhost;
        if (!currentGhost) return;

        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasMultipleSuggestions(element)) {
          event.preventDefault();
          currentGhost.textContent = cycleSuggestion(element, event.key === 'ArrowDown' ? 1 : -1);
          return;
        }

        if (event.key === 'Tab' && suggestionTarget === element && suggestion) {
          event.preventDefault();
          replaceEditableValueWithSuggestion(element, suggestion);
          clearGhostValue(currentGhost);
          clearSuggestionState(element);
        }
      });
    }

    element.addEventListener('blur', cleanupGhost, { once: true });
  }

  function attachOverlayEventsForEditable(element) {
    if (wiredEditables.has(element)) return;
    wiredEditables.add(element);

    element.addEventListener('focus', () => {
      createOverlayForEditable(element);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  document.addEventListener('focusin', (event) => {
    const element = event.target;

    if (!isSiteAllowed()) {
      clearSuggestionState();
      return;
    }

    if (isSupportedInput(element)) {
      attachOverlayEvents(element);
      if (document.activeElement === element) {
        createOverlay(element);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    if (element?.isContentEditable) {
      attachOverlayEventsForEditable(element);
      if (document.activeElement === element) {
        createOverlayForEditable(element);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
}

chrome.storage.sync.get(['sentences', 'allowedSites', 'shortcuts', 'triggerCharacter'], (result) => {
  applySettings(result);
  activateAutocomplete();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }

  const nextSettings = {};
  for (const [key, change] of Object.entries(changes)) {
    nextSettings[key] = change.newValue;
  }

  applySettings(nextSettings);
  triggerActiveElementRefresh();
});
