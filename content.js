(function initContentScript() {
  if (globalThis.__typingHelperContentScriptLoaded) {
    return;
  }

  globalThis.__typingHelperContentScriptLoaded = true;

  const Shared = globalThis.TypingHelperShared;
  const settingsStore = Shared.createSettingsStore(chrome.storage.sync);
  const hostname = window.location.hostname.toLowerCase();
  const controllers = new WeakMap();
  const textInputTypes = new Set(['', 'text', 'search', 'url', 'tel', 'email']);
  const MAX_VISIBLE_SUGGESTIONS = 5;

  let settings = Shared.normalizeSettings({});
  let activeController = null;

  function hasPageManagedAutocomplete(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.dataset.autoComplete === 'true') {
      return true;
    }

    if (element.hasAttribute('list')) {
      return true;
    }

    const ariaAutocomplete = (element.getAttribute('aria-autocomplete') || '').toLowerCase();
    if (ariaAutocomplete && ariaAutocomplete !== 'none') {
      return true;
    }

    if ((element.getAttribute('role') || '').toLowerCase() === 'combobox') {
      return true;
    }

    return false;
  }

  function isSupportedInput(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (element.readOnly || element.disabled) {
      return false;
    }

    if (element instanceof HTMLTextAreaElement) {
      return true;
    }

    if (hasPageManagedAutocomplete(element)) {
      return false;
    }

    return textInputTypes.has((element.type || '').toLowerCase());
  }

  function isSupportedEditable(element) {
    return Boolean(element?.isContentEditable);
  }

  function getController(element) {
    if (!controllers.has(element)) {
      const adapter = isSupportedInput(element)
        ? new InputAdapter(element)
        : new EditableAdapter(element);

      controllers.set(element, new FieldController(adapter));
    }

    return controllers.get(element);
  }

  function refreshActiveController() {
    if (activeController) {
      activeController.refresh();
    }
  }

  class BaseAdapter {
    constructor(element) {
      this.element = element;
    }

    isFocused() {
      return document.activeElement === this.element;
    }

    getParent() {
      return this.element.parentElement;
    }

    applyOverlayStyles() {
      const parent = this.getParent();
      const originalStyles = {
        elementPosition: this.element.style.position,
        elementZIndex: this.element.style.zIndex,
        elementBackground: this.element.style.background,
        elementBackgroundColor: this.element.style.backgroundColor,
        parentPosition: parent ? parent.style.position : ''
      };

      if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      if (getComputedStyle(this.element).position === 'static') {
        this.element.style.position = 'relative';
      }

      this.element.style.zIndex = '10000';
      this.element.style.background = 'transparent';
      this.element.style.backgroundColor = 'transparent';

      return originalStyles;
    }

    restoreOverlayStyles(originalStyles) {
      const parent = this.getParent();
      this.element.style.position = originalStyles.elementPosition;
      this.element.style.zIndex = originalStyles.elementZIndex;
      this.element.style.background = originalStyles.elementBackground;
      this.element.style.backgroundColor = originalStyles.elementBackgroundColor;

      if (parent) {
        parent.style.position = originalStyles.parentPosition;
      }
    }
  }

  class InputAdapter extends BaseAdapter {
    constructor(element) {
      super(element);
      this.history = new Shared.SnapshotHistory(100);
      this.isRestoringHistory = false;
    }

    getValue() {
      return this.element.value || '';
    }

    getLastWord() {
      const words = this.getValue().split(/\s+/);
      return words[words.length - 1] || '';
    }

    createGhost() {
      const ghost = document.createElement(this.element.tagName === 'TEXTAREA' ? 'textarea' : 'input');
      const style = getComputedStyle(this.element);

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
        ghost.style[prop] = style[prop];
      }

      const rgb = style.color.match(/\d+/g);
      if (rgb) {
        ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
      }

      return ghost;
    }

    setGhostValue(ghost, value) {
      ghost.value = value;
    }

    clearGhostValue(ghost) {
      ghost.value = '';
    }

    createSuggestionList() {
      return createSuggestionListElement();
    }

    getSnapshot() {
      const value = this.getValue();
      return {
        value,
        start: this.element.selectionStart ?? value.length,
        end: this.element.selectionEnd ?? value.length
      };
    }

    rememberSnapshot() {
      if (!this.isRestoringHistory) {
        this.history.push(this.getSnapshot());
      }
    }

    undo() {
      const snapshot = this.history.undo();
      if (!snapshot) {
        return false;
      }

      this.isRestoringHistory = true;
      setFormControlValue(this.element, snapshot.value);
      this.element.setSelectionRange(snapshot.start, snapshot.end);
      this.element.dispatchEvent(new Event('input', { bubbles: true }));
      this.isRestoringHistory = false;
      return true;
    }

    tryExpandShortcut(shortcutText) {
      const start = this.element.selectionStart;
      const end = this.element.selectionEnd;
      const lastWord = this.getLastWord();

      if (start === null || end === null || !lastWord) {
        return false;
      }

      const replaceStart = start - lastWord.length;
      if (replaceStart < 0) {
        return false;
      }

      this.element.focus();
      this.element.setSelectionRange(replaceStart, end);

      const inserted = typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, shortcutText);

      if (!inserted) {
        const before = this.getValue().slice(0, replaceStart);
        const after = this.getValue().slice(end);
        setFormControlValue(this.element, `${before}${shortcutText}${after}`);
        const cursorPos = before.length + shortcutText.length;
        this.element.setSelectionRange(cursorPos, cursorPos);
        this.element.dispatchEvent(new InputEvent('input', {
          inputType: 'insertReplacementText',
          data: shortcutText,
          bubbles: true,
          cancelable: true
        }));
      }

      return true;
    }

    acceptSuggestion(value) {
      this.element.focus();
      setFormControlValue(this.element, value);
      this.element.setSelectionRange(value.length, value.length);
      this.element.dispatchEvent(new InputEvent('input', {
        inputType: 'insertReplacementText',
        data: value,
        bubbles: true,
        cancelable: true
      }));
    }
  }

  class EditableAdapter extends BaseAdapter {
    getValue() {
      return (this.element.innerText || '').replace(/\u00a0/g, ' ');
    }

    getLastWord() {
      const words = this.getValue().split(/\s+/);
      return words[words.length - 1] || '';
    }

    createGhost() {
      const ghost = document.createElement('div');
      const style = getComputedStyle(this.element);

      ghost.className = 'autocomplete-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.position = 'absolute';
      ghost.style.zIndex = '9999';
      ghost.style.pointerEvents = 'none';
      ghost.style.whiteSpace = 'pre-wrap';
      ghost.style.wordBreak = 'break-word';
      ghost.style.font = style.font;
      ghost.style.padding = style.padding;
      ghost.style.margin = style.margin;
      ghost.style.border = style.border;
      ghost.style.lineHeight = style.lineHeight;

      const rgb = style.color.match(/\d+/g);
      if (rgb) {
        ghost.style.color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
      }

      return ghost;
    }

    setGhostValue(ghost, value) {
      ghost.textContent = value;
    }

    clearGhostValue(ghost) {
      ghost.textContent = '';
    }

    createSuggestionList() {
      return createSuggestionListElement();
    }

    tryExpandShortcut(shortcutText) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return false;
      }

      const range = selection.getRangeAt(0);
      const lastWord = this.getLastWord();
      const endpoint = resolveEditableEndpoint(this.element, range.endContainer, range.endOffset);
      if (!lastWord || !endpoint) {
        return false;
      }

      const startPosition = findTextPositionBefore(
        this.element,
        endpoint.node,
        endpoint.offset,
        lastWord.length
      );
      if (!startPosition) {
        return false;
      }

      const replacementRange = document.createRange();
      replacementRange.setStart(startPosition.node, startPosition.offset);
      replacementRange.setEnd(endpoint.node, endpoint.offset);
      selection.removeAllRanges();
      selection.addRange(replacementRange);
      this.element.focus();

      const inserted = typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, shortcutText);

      if (!inserted) {
        replacementRange.deleteContents();
        const textNode = document.createTextNode(shortcutText);
        replacementRange.insertNode(textNode);
        replacementRange.setStartAfter(textNode);
        replacementRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(replacementRange);
        this.element.dispatchEvent(new InputEvent('input', {
          inputType: 'insertReplacementText',
          data: shortcutText,
          bubbles: true,
          cancelable: true
        }));
      }

      return true;
    }

    acceptSuggestion(value) {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      const replacementRange = document.createRange();
      replacementRange.selectNodeContents(this.element);
      selection.removeAllRanges();
      selection.addRange(replacementRange);
      this.element.focus();

      const inserted = typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, value);

      if (!inserted) {
        this.element.textContent = value;
        const range = document.createRange();
        range.selectNodeContents(this.element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        this.element.dispatchEvent(new InputEvent('input', {
          inputType: 'insertReplacementText',
          data: value,
          bubbles: true,
          cancelable: true
        }));
      }
    }
  }

  class FieldController {
    constructor(adapter) {
      this.adapter = adapter;
      this.element = adapter.element;
      this.ghost = null;
      this.list = null;
      this.originalStyles = null;
      this.matches = [];
      this.selectedIndex = 0;
      this.handleInput = this.handleInput.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleBlur = this.handleBlur.bind(this);
      this.handleWindowChange = this.handleWindowChange.bind(this);
      this.bindPersistentHandlers();
    }

    bindPersistentHandlers() {
      this.element.addEventListener('focus', () => this.activate());
      this.element.addEventListener('input', this.handleInput);
      this.element.addEventListener('keydown', this.handleKeyDown);
      this.element.addEventListener('blur', this.handleBlur);
    }

    activate() {
      if (!Shared.isSiteAllowed(hostname, settings.allowedSites)) {
        this.deactivate();
        return;
      }

      activeController = this;
      this.ensureOverlay();
      if (this.adapter.rememberSnapshot) {
        this.adapter.rememberSnapshot();
      }
      this.handleInput();
    }

    deactivate() {
      if (activeController === this) {
        activeController = null;
      }

      if (!this.ghost || !this.list) {
        return;
      }

      window.removeEventListener('scroll', this.handleWindowChange, true);
      window.removeEventListener('resize', this.handleWindowChange);
      this.element.removeEventListener('scroll', this.handleWindowChange);

      if (this.ghost.parentNode) {
        this.ghost.parentNode.removeChild(this.ghost);
      }

      if (this.list.parentNode) {
        this.list.parentNode.removeChild(this.list);
      }

      this.adapter.restoreOverlayStyles(this.originalStyles);
      this.ghost = null;
      this.list = null;
      this.matches = [];
      this.selectedIndex = 0;
    }

    ensureOverlay() {
      if (this.ghost && this.list) {
        this.updatePosition();
        return;
      }

      const parent = this.adapter.getParent();
      if (!parent) {
        return;
      }

      this.originalStyles = this.adapter.applyOverlayStyles();
      this.ghost = this.adapter.createGhost();
      this.list = this.adapter.createSuggestionList();

      parent.insertBefore(this.ghost, this.element);
      parent.insertBefore(this.list, this.element.nextSibling);

      window.addEventListener('scroll', this.handleWindowChange, true);
      window.addEventListener('resize', this.handleWindowChange);
      this.element.addEventListener('scroll', this.handleWindowChange);
      this.updatePosition();
    }

    refresh() {
      if (!this.adapter.isFocused()) {
        return;
      }

      if (!Shared.isSiteAllowed(hostname, settings.allowedSites)) {
        this.deactivate();
        return;
      }

      this.ensureOverlay();
      this.handleInput();
    }

    handleWindowChange() {
      this.updatePosition();
    }

    updatePosition() {
      if (!this.ghost || !this.list) {
        return;
      }

      const parent = this.adapter.getParent();
      if (!parent) {
        return;
      }

      const rect = this.element.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const top = rect.top - parentRect.top + parent.scrollTop;
      const left = rect.left - parentRect.left + parent.scrollLeft;

      this.ghost.style.top = `${top}px`;
      this.ghost.style.left = `${left}px`;
      this.ghost.style.width = `${rect.width}px`;
      this.ghost.style.height = `${rect.height}px`;

      this.list.style.top = `${top + rect.height + 4}px`;
      this.list.style.left = `${left}px`;
      this.list.style.width = `${Math.max(rect.width, 220)}px`;
    }

    handleInput() {
      if (!this.ghost || !this.list) {
        return;
      }

      this.updatePosition();
      const value = this.adapter.getValue();
      const lastWord = this.adapter.getLastWord();
      const shortcutText = Shared.findShortcutExpansion(settings.shortcuts, lastWord, settings.triggerCharacter);

      if (shortcutText && this.adapter.tryExpandShortcut(shortcutText)) {
        this.clearSuggestions();
        return;
      }

      if (this.adapter.rememberSnapshot) {
        this.adapter.rememberSnapshot();
      }

      if (!value.trim()) {
        this.clearSuggestions();
        return;
      }

      const matches = Shared.getSentenceMatches(settings.sentences, value)
        .filter((match) => Shared.normalize(match) !== Shared.normalize(value));

      this.setMatches(matches);
    }

    handleKeyDown(event) {
      if (!this.ghost || !this.list) {
        return;
      }

      if (event.key === 'ArrowDown' && this.matches.length > 1) {
        event.preventDefault();
        this.selectOffset(1);
        return;
      }

      if (event.key === 'ArrowUp' && this.matches.length > 1) {
        event.preventDefault();
        this.selectOffset(-1);
        return;
      }

      if (this.adapter.undo && isUndoShortcut(event) && this.adapter.undo()) {
        event.preventDefault();
        return;
      }

      if (event.key === settings.acceptKey && this.getSelectedSuggestion()) {
        if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)) {
          return;
        }

        event.preventDefault();
        this.adapter.acceptSuggestion(this.getSelectedSuggestion());
        this.clearSuggestions();
      }
    }

    handleBlur() {
      window.setTimeout(() => {
        if (document.activeElement !== this.element) {
          this.deactivate();
        }
      }, 0);
    }

    setMatches(matches) {
      this.matches = matches;
      this.selectedIndex = 0;
      this.renderSuggestions();
    }

    clearSuggestions() {
      this.matches = [];
      this.selectedIndex = 0;
      this.renderSuggestions();
    }

    getSelectedSuggestion() {
      return this.matches[this.selectedIndex] || '';
    }

    selectOffset(direction) {
      if (!this.matches.length) {
        return;
      }

      this.selectedIndex = (this.selectedIndex + direction + this.matches.length) % this.matches.length;
      this.renderSuggestions();
    }

    renderSuggestions() {
      if (!this.ghost || !this.list) {
        return;
      }

      const selectedSuggestion = this.getSelectedSuggestion();
      if (selectedSuggestion) {
        this.adapter.setGhostValue(this.ghost, selectedSuggestion);
      } else {
        this.adapter.clearGhostValue(this.ghost);
      }

      this.list.innerHTML = '';
      if (!this.matches.length) {
        this.list.hidden = true;
        this.list.style.display = 'none';
        return;
      }

      const startIndex = Math.max(
        0,
        Math.min(
          this.selectedIndex,
          this.matches.length - MAX_VISIBLE_SUGGESTIONS
        )
      );
      const visibleMatches = this.matches.slice(startIndex, startIndex + MAX_VISIBLE_SUGGESTIONS);

      visibleMatches.forEach((match, visibleIndex) => {
        const actualIndex = startIndex + visibleIndex;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'autocomplete-item';
        button.textContent = match;
        button.dataset.selected = actualIndex === this.selectedIndex ? 'true' : 'false';
        button.style.padding = '8px 10px';
        button.style.border = '0';
        button.style.borderRadius = '8px';
        button.style.textAlign = 'left';
        button.style.whiteSpace = 'pre-wrap';
        button.style.wordBreak = 'break-word';
        button.style.cursor = 'pointer';
        button.style.background = actualIndex === this.selectedIndex
          ? 'rgba(15, 118, 110, 0.12)'
          : 'transparent';
        button.style.color = '#0f172a';
        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
          this.selectedIndex = actualIndex;
          this.adapter.acceptSuggestion(match);
          this.clearSuggestions();
        });
        this.list.appendChild(button);
      });

      this.list.hidden = false;
      this.list.style.display = 'flex';
    }
  }

  function createSuggestionListElement() {
    const list = document.createElement('div');
    list.className = 'autocomplete-list';
    list.hidden = true;
    list.style.position = 'absolute';
    list.style.zIndex = '10001';
    list.style.display = 'none';
    list.style.flexDirection = 'column';
    list.style.gap = '2px';
    list.style.padding = '4px';
    list.style.background = '#ffffff';
    list.style.border = '1px solid rgba(15, 23, 42, 0.15)';
    list.style.borderRadius = '10px';
    list.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.14)';
    list.style.maxHeight = '180px';
    list.style.overflowY = 'auto';

    return list;
  }

  function createTextNodeWalker(root) {
    return document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.textContent
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
  }

  function findLastTextNode(root) {
    if (!root) {
      return null;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      return root.textContent ? root : null;
    }

    const walker = createTextNodeWalker(root);
    let current = null;
    let last = null;

    while ((current = walker.nextNode())) {
      last = current;
    }

    return last;
  }

  function findPreviousTextPosition(root, referenceNode, referenceOffset) {
    const walker = createTextNodeWalker(root);
    const referenceRange = document.createRange();
    referenceRange.setStart(referenceNode, referenceOffset);
    referenceRange.collapse(true);

    let current = null;
    let previous = null;

    while ((current = walker.nextNode())) {
      const nodeEndRange = document.createRange();
      nodeEndRange.selectNodeContents(current);
      nodeEndRange.collapse(false);

      if (nodeEndRange.compareBoundaryPoints(Range.START_TO_START, referenceRange) >= 0) {
        break;
      }

      previous = current;
    }

    return previous
      ? { node: previous, offset: previous.textContent.length }
      : null;
  }

  function resolveEditableEndpoint(root, container, offset) {
    if (!root.contains(container)) {
      return null;
    }

    if (container.nodeType === Node.TEXT_NODE) {
      return {
        node: container,
        offset: Math.min(offset, container.textContent.length)
      };
    }

    if (container.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    if (offset > 0) {
      const previousChild = container.childNodes[offset - 1];
      const lastTextNode = findLastTextNode(previousChild);
      if (lastTextNode) {
        return {
          node: lastTextNode,
          offset: lastTextNode.textContent.length
        };
      }
    }

    return findPreviousTextPosition(root, container, offset);
  }

  function findTextPositionBefore(root, endNode, endOffset, characterCount) {
    let remaining = characterCount;
    let currentNode = endNode;
    let currentOffset = endOffset;

    while (currentNode && remaining > 0) {
      const available = currentOffset;
      if (available >= remaining) {
        return {
          node: currentNode,
          offset: currentOffset - remaining
        };
      }

      remaining -= available;
      const previous = findPreviousTextPosition(root, currentNode, 0);
      if (!previous) {
        return null;
      }

      currentNode = previous.node;
      currentOffset = previous.offset;
    }

    return remaining === 0
      ? { node: currentNode, offset: currentOffset }
      : null;
  }

  function setFormControlValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function isUndoShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z';
  }

  document.addEventListener('focusin', (event) => {
    const element = event.target;

    if (isSupportedInput(element) || isSupportedEditable(element)) {
      getController(element).activate();
    }
  });

  settingsStore.get((nextSettings) => {
    settings = nextSettings;
    refreshActiveController();
  });

  settingsStore.watch((nextSettings) => {
    settings = nextSettings;
    refreshActiveController();
  });
})();
