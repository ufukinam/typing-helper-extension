(function initTypingHelperShared(global) {
  const ACCEPT_KEYS = ['Tab', 'Enter', 'ArrowRight'];
  const DEFAULT_SETTINGS = {
    sentences: [],
    allowedSites: [],
    shortcuts: {},
    triggerCharacter: '#',
    acceptKey: 'Tab'
  };

  function normalize(value) {
    return (value || '').toLocaleLowerCase('tr-TR');
  }

  function normalizeDomain(input) {
    const trimmed = (input || '').trim().toLowerCase();
    if (!trimmed) return '';

    try {
      let value = trimmed;
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        value = `https://${value}`;
      }

      return new URL(value).hostname.replace(/^www\./, '');
    } catch (error) {
      return trimmed
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
    }
  }

  function getTriggerCharacter(value) {
    const trimmed = (value || '').trim();
    return trimmed ? trimmed.charAt(0) : DEFAULT_SETTINGS.triggerCharacter;
  }

  function sanitizeAcceptKey(value) {
    return ACCEPT_KEYS.includes(value) ? value : DEFAULT_SETTINGS.acceptKey;
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
      const key = normalizeShortcutKey(rawKey, triggerCharacter);
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';

      if (key && value) {
        normalizedShortcuts[key] = value;
      }
    }

    return normalizedShortcuts;
  }

  function normalizeSentences(sentences) {
    const seen = new Set();
    const normalizedSentences = [];

    for (const sentence of Array.isArray(sentences) ? sentences : []) {
      const value = typeof sentence === 'string' ? sentence.trim() : '';
      const key = normalize(value);

      if (value && !seen.has(key)) {
        normalizedSentences.push(value);
        seen.add(key);
      }
    }

    return normalizedSentences;
  }

  function normalizeAllowedSites(allowedSites) {
    const seen = new Set();
    const normalizedSites = [];

    for (const site of Array.isArray(allowedSites) ? allowedSites : []) {
      const normalizedSite = normalizeDomain(site);
      if (normalizedSite && !seen.has(normalizedSite)) {
        normalizedSites.push(normalizedSite);
        seen.add(normalizedSite);
      }
    }

    return normalizedSites;
  }

  function normalizeSettings(settings) {
    const nextTriggerCharacter = getTriggerCharacter(settings?.triggerCharacter);

    return {
      sentences: normalizeSentences(settings?.sentences),
      allowedSites: normalizeAllowedSites(settings?.allowedSites),
      shortcuts: normalizeShortcutMap(settings?.shortcuts, nextTriggerCharacter),
      triggerCharacter: nextTriggerCharacter,
      acceptKey: sanitizeAcceptKey(settings?.acceptKey)
    };
  }

  function isSiteAllowed(hostname, allowedSites) {
    const normalizedHostname = normalizeDomain(hostname);
    if (!normalizedHostname) return false;
    if (!allowedSites.length) return true;

    return allowedSites.some((site) => {
      return normalizedHostname === site || normalizedHostname.endsWith(`.${site}`);
    });
  }

  function getSentenceMatches(sentences, value) {
    const normalizedValue = normalize(value);
    if (!normalizedValue) return [];

    return sentences.filter((sentence) => normalize(sentence).startsWith(normalizedValue));
  }

  function findShortcutExpansion(shortcuts, lastWord, triggerCharacter) {
    const normalizedWord = normalize(lastWord);
    const normalizedTrigger = normalize(triggerCharacter);

    if (!normalizedWord || !normalizedTrigger || !normalizedWord.startsWith(normalizedTrigger)) {
      return '';
    }

    const shortcutKey = normalizedWord.slice(normalizedTrigger.length);
    if (!shortcutKey) {
      return '';
    }

    for (const [key, value] of Object.entries(shortcuts || {})) {
      if (normalize(key) === shortcutKey) {
        return value;
      }
    }

    return '';
  }

  function getMessage(key, substitutions) {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }

    return key;
  }

  function localizeDocument(root) {
    const target = root || document;

    target.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = getMessage(element.dataset.i18n);
    });

    target.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', getMessage(element.dataset.i18nPlaceholder));
    });

    target.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.setAttribute('title', getMessage(element.dataset.i18nTitle));
    });
  }

  class SnapshotHistory {
    constructor(limit = 100) {
      this.limit = limit;
      this.snapshots = [];
      this.pointer = -1;
    }

    current() {
      return this.pointer >= 0 ? this.snapshots[this.pointer] : null;
    }

    push(snapshot) {
      const current = this.current();
      if (current && SnapshotHistory.equals(current, snapshot)) {
        return;
      }

      this.snapshots = this.snapshots.slice(0, this.pointer + 1);
      this.snapshots.push(snapshot);

      if (this.snapshots.length > this.limit) {
        this.snapshots.shift();
      }

      this.pointer = this.snapshots.length - 1;
    }

    canUndo() {
      return this.pointer > 0;
    }

    undo() {
      if (!this.canUndo()) {
        return null;
      }

      this.pointer -= 1;
      return this.snapshots[this.pointer];
    }

    static equals(left, right) {
      return Boolean(left) &&
        Boolean(right) &&
        left.value === right.value &&
        left.start === right.start &&
        left.end === right.end;
    }
  }

  function createSettingsStore(storageArea) {
    const settingsKeys = Object.keys(DEFAULT_SETTINGS);
    const storage = storageArea;

    return {
      keys: settingsKeys,
      get(callback) {
        storage.get(settingsKeys, (result) => {
          callback(normalizeSettings(result));
        });
      },
      set(patch, callback) {
        storage.get(settingsKeys, (current) => {
          const merged = normalizeSettings({ ...current, ...patch });
          storage.set(merged, () => callback?.(merged));
        });
      },
      clear(callback) {
        storage.clear(() => callback?.(normalizeSettings({})));
      },
      watch(listener) {
        const handler = (changes, areaName) => {
          if (areaName !== 'sync') {
            return;
          }

          const patch = {};
          for (const key of settingsKeys) {
            if (changes[key]) {
              patch[key] = changes[key].newValue;
            }
          }

          if (Object.keys(patch).length > 0) {
            listener(normalizeSettings({ ...DEFAULT_SETTINGS, ...patch }));
          }
        };

        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
      }
    };
  }

  const api = {
    ACCEPT_KEYS,
    DEFAULT_SETTINGS,
    SnapshotHistory,
    createSettingsStore,
    findShortcutExpansion,
    getMessage,
    getSentenceMatches,
    getTriggerCharacter,
    isSiteAllowed,
    localizeDocument,
    normalize,
    normalizeDomain,
    normalizeSettings,
    normalizeShortcutKey,
    normalizeShortcutMap,
    sanitizeAcceptKey
  };

  global.TypingHelperShared = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
