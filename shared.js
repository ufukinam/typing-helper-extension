(function initTypingHelperShared(global) {
  const ACCEPT_KEYS = ['Tab', 'Enter', 'ArrowRight'];
  const LANGUAGE_OPTIONS = ['browser', 'en', 'tr'];
  const DEFAULT_SETTINGS = {
    sentences: [],
    allowedSites: [],
    shortcuts: {},
    triggerCharacter: '#',
    acceptKey: 'Tab',
    language: 'browser'
  };
  const MESSAGE_CATALOGS = {
    en: {
      extensionName: 'FinishMyText',
      extensionDescription: 'Autocomplete saved texts and shortcut snippets while typing.',
      popupTitle: 'FinishMyText',
      savedTextsTitle: 'Saved Texts',
      sentencePlaceholder: 'Enter the text you want to save.',
      addTextButton: 'Add Text',
      deleteTextButton: 'Delete text',
      popupHelperText: 'Use Arrow Up/Down to switch suggestions and your accept key to insert the selected text.',
      noSentences: 'No saved texts yet.',
      saveSelectionContextMenu: 'Save selected text',
      openSettingsButton: 'Open Settings',
      currentSiteTitle: 'Current Site',
      currentSiteHelper: 'Enable only the sites where you want the extension to run.',
      currentSiteStatusGlobal: 'No sites are enabled yet.',
      currentSiteStatusAllowed: 'Autocomplete is enabled on this site.',
      currentSiteStatusInherited: 'Autocomplete is enabled on this site via $1.',
      currentSiteStatusBlocked: 'This site is not in the allowed list.',
      currentSiteActionRestrict: 'Enable This Site',
      currentSiteManagedByParentAction: 'Managed by Parent Rule',
      enableCurrentSiteButton: 'Enable Site',
      disableCurrentSiteButton: 'Disable Site',
      siteUnavailable: 'Unavailable',
      siteUnavailableDescription: 'This tab does not expose a website URL.',
      siteUnavailableAction: 'Unavailable',
      settingsPageTitle: 'Extension Settings',
      settingsHelperText: 'Use a trigger character for shortcuts. Suggestions can be switched with Arrow Up/Down and accepted with your selected key.',
      allowedSitesTitle: 'Allowed Sites',
      allowedSitesHelper: 'The extension runs only on the sites listed here.',
      allowedSiteLabel: 'Site domain',
      allowedSitePlaceholder: 'example.com',
      addButton: 'Add',
      removeButton: 'Remove',
      noAllowedSites: 'No allowed sites configured.',
      shortcutSettingsTitle: 'Shortcut Snippets',
      shortcutHelper: 'Type the trigger character and key in the page to expand the saved text.',
      shortcutKeyLabel: 'Shortcut key',
      shortcutValueLabel: 'Shortcut text',
      shortcutKeyPlaceholder: 'key',
      shortcutValuePlaceholder: 'Paste the text that should be inserted.',
      addShortcutButton: 'Add Shortcut',
      noShortcuts: 'No shortcuts configured.',
      typingBehaviorTitle: 'Typing Behavior',
      triggerCharacterLabel: 'Trigger character',
      acceptKeyLabel: 'Accept key',
      acceptKeyTab: 'Tab',
      acceptKeyEnter: 'Enter',
      acceptKeyArrowRight: 'Right Arrow',
      languageLabel: 'Language',
      languageBrowser: 'Browser Default',
      languageEnglish: 'English',
      languageTurkish: 'Turkish',
      dangerZoneTitle: 'Danger Zone',
      clearDataHelper: 'Remove all saved texts, allowed sites, shortcuts, and typing preferences.',
      clearDataButton: 'Clear Everything',
      duplicateSiteAlert: 'This site is already in the list.',
      duplicateShortcutAlert: 'This shortcut already exists.',
      sitePermissionDeniedAlert: 'Chrome site access was not granted for this site.'
    },
    tr: {
      extensionName: 'FinishMyText',
      extensionDescription: 'Kayıtlı metinleri ve kısayol metinlerini yazarken otomatik tamamlama ile kullanın.',
      popupTitle: 'FinishMyText',
      savedTextsTitle: 'Kayıtlı Metinler',
      sentencePlaceholder: 'Kaydetmek istediğiniz metni girin.',
      addTextButton: 'Metin Ekle',
      deleteTextButton: 'Metni sil',
      popupHelperText: 'Yukarı/Aşağı Ok ile öneriler arasında geçin ve seçili metni eklemek için kabul tuşunuzu kullanın.',
      noSentences: 'Henüz kayıtlı metin yok.',
      saveSelectionContextMenu: 'Seçili metni kaydet',
      openSettingsButton: 'Ayarları Aç',
      currentSiteTitle: 'Geçerli Site',
      currentSiteHelper: 'Uzantıyı yalnızca çalışmasını istediğiniz sitelerde etkinleştirin.',
      currentSiteStatusGlobal: 'Henüz etkinleştirilmiş site yok.',
      currentSiteStatusAllowed: 'Bu sitede otomatik tamamlama etkin.',
      currentSiteStatusInherited: 'Bu sitede otomatik tamamlama $1 kuralı ile etkin.',
      currentSiteStatusBlocked: 'Bu site izin verilenler listesinde değil.',
      currentSiteActionRestrict: 'Bu Siteyi Etkinleştir',
      currentSiteManagedByParentAction: 'Üst Alan Adı Kuralı',
      enableCurrentSiteButton: 'Sitede Etkinleştir',
      disableCurrentSiteButton: 'Sitede Kapat',
      siteUnavailable: 'Kullanılamıyor',
      siteUnavailableDescription: 'Bu sekmede erişilebilir bir web sitesi adresi yok.',
      siteUnavailableAction: 'Kullanılamıyor',
      settingsPageTitle: 'Uzantı Ayarları',
      settingsHelperText: 'Kısayollar için bir tetikleyici karakter kullanın. Öneriler arasında Yukarı/Aşağı Ok ile geçebilir ve seçtiğiniz tuş ile kabul edebilirsiniz.',
      allowedSitesTitle: 'İzin Verilen Siteler',
      allowedSitesHelper: 'Uzantı yalnızca burada listelenen sitelerde çalışır.',
      allowedSiteLabel: 'Site alan adı',
      allowedSitePlaceholder: 'örn. example.com',
      addButton: 'Ekle',
      removeButton: 'Sil',
      noAllowedSites: 'İzin verilen site ayarlanmamış.',
      shortcutSettingsTitle: 'Kısayol Metinleri',
      shortcutHelper: 'Sayfada tetikleyici karakteri ve anahtarı yazarak kayıtlı metni genişletin.',
      shortcutKeyLabel: 'Kısayol anahtarı',
      shortcutValueLabel: 'Kısayol metni',
      shortcutKeyPlaceholder: 'anahtar',
      shortcutValuePlaceholder: 'Eklenmesini istediğiniz metni girin.',
      addShortcutButton: 'Kısayol Ekle',
      noShortcuts: 'Kısayol ayarlanmamış.',
      typingBehaviorTitle: 'Yazma Davranışı',
      triggerCharacterLabel: 'Tetikleyici karakter',
      acceptKeyLabel: 'Kabul tuşu',
      acceptKeyTab: 'Tab',
      acceptKeyEnter: 'Enter',
      acceptKeyArrowRight: 'Sağ Ok',
      languageLabel: 'Dil',
      languageBrowser: 'Tarayıcı Varsayılanı',
      languageEnglish: 'İngilizce',
      languageTurkish: 'Türkçe',
      dangerZoneTitle: 'Tehlikeli Bölge',
      clearDataHelper: 'Tüm kayıtlı metinleri, izin verilen siteleri, kısayolları ve yazma tercihlerini silin.',
      clearDataButton: 'Her şeyi Temizle',
      duplicateSiteAlert: 'Bu site zaten listede.',
      duplicateShortcutAlert: 'Bu kısayol zaten var.',
      sitePermissionDeniedAlert: 'Chrome site erişimi bu site için verilmedi.'
    }
  };
  let currentLanguagePreference = DEFAULT_SETTINGS.language;

  function normalize(value) {
    return (value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0131/g, 'i')
      .toLowerCase();
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

  function getHostPermissionPatterns(input) {
    const domain = normalizeDomain(input);
    if (!domain) {
      return [];
    }

    const patterns = [
      `http://${domain}/*`,
      `https://${domain}/*`
    ];
    const supportsWildcardSubdomains =
      domain.includes('.') &&
      domain !== 'localhost' &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain);

    if (supportsWildcardSubdomains) {
      patterns.push(`http://*.${domain}/*`, `https://*.${domain}/*`);
    }

    return patterns;
  }

  function getTriggerCharacter(value) {
    const trimmed = (value || '').trim();
    return trimmed ? trimmed.charAt(0) : DEFAULT_SETTINGS.triggerCharacter;
  }

  function sanitizeAcceptKey(value) {
    return ACCEPT_KEYS.includes(value) ? value : DEFAULT_SETTINGS.acceptKey;
  }

  function sanitizeLanguage(value) {
    return LANGUAGE_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.language;
  }

  function detectBrowserLanguage() {
    const browserLanguage =
      (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      'en';

    return browserLanguage.toLocaleLowerCase().startsWith('tr') ? 'tr' : 'en';
  }

  function getEffectiveLanguage(languagePreference = currentLanguagePreference) {
    const normalizedLanguage = sanitizeLanguage(languagePreference);
    return normalizedLanguage === 'browser' ? detectBrowserLanguage() : normalizedLanguage;
  }

  function setLanguagePreference(languagePreference) {
    currentLanguagePreference = sanitizeLanguage(languagePreference);
    return getEffectiveLanguage(currentLanguagePreference);
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
      acceptKey: sanitizeAcceptKey(settings?.acceptKey),
      language: sanitizeLanguage(settings?.language)
    };
  }

  function findAllowedSiteMatch(hostname, allowedSites) {
    const normalizedHostname = normalizeDomain(hostname);
    if (!normalizedHostname || !allowedSites.length) return '';

    const matches = allowedSites.filter((site) => {
      return normalizedHostname === site || normalizedHostname.endsWith(`.${site}`);
    });

    if (!matches.length) {
      return '';
    }

    matches.sort((left, right) => right.length - left.length);
    return matches[0];
  }

  function isSiteAllowed(hostname, allowedSites) {
    const normalizedHostname = normalizeDomain(hostname);
    if (!normalizedHostname) return false;
    if (!allowedSites.length) return true;

    return Boolean(findAllowedSiteMatch(normalizedHostname, allowedSites));
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

  function getMessage(key, substitutions, languagePreference = currentLanguagePreference) {
    const language = getEffectiveLanguage(languagePreference);
    const template = MESSAGE_CATALOGS[language]?.[key] || MESSAGE_CATALOGS.en[key];

    if (!template) {
      return key;
    }

    if (Array.isArray(substitutions)) {
      return substitutions.reduce((message, value, index) => {
        return message.replace(new RegExp(`\\$${index + 1}`, 'g'), value);
      }, template);
    }

    return template;
  }

  function localizeDocument(root, languagePreference = currentLanguagePreference) {
    const target = root || document;
    const effectiveLanguage = getEffectiveLanguage(languagePreference);

    if (target.documentElement) {
      target.documentElement.lang = effectiveLanguage;
    }

    target.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = getMessage(element.dataset.i18n, undefined, languagePreference);
    });

    target.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', getMessage(element.dataset.i18nPlaceholder, undefined, languagePreference));
    });

    target.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.setAttribute('title', getMessage(element.dataset.i18nTitle, undefined, languagePreference));
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
            storage.get(settingsKeys, (current) => {
              listener(normalizeSettings(current));
            });
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
    findAllowedSiteMatch,
    getMessage,
    getHostPermissionPatterns,
    getSentenceMatches,
    getTriggerCharacter,
    isSiteAllowed,
    localizeDocument,
    normalize,
    normalizeDomain,
    normalizeSettings,
    normalizeShortcutKey,
    normalizeShortcutMap,
    sanitizeAcceptKey,
    sanitizeLanguage,
    detectBrowserLanguage,
    getEffectiveLanguage,
    setLanguagePreference
  };

  global.TypingHelperShared = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
