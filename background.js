importScripts('shared.js');

const Shared = globalThis.TypingHelperShared;
const settingsStore = Shared.createSettingsStore(chrome.storage.sync);
const SAVE_SELECTION_MENU_ID = 'save-selected-text';

function createContextMenu(languagePreference) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SAVE_SELECTION_MENU_ID,
      title: Shared.getMessage('saveSelectionContextMenu', undefined, languagePreference),
      contexts: ['selection']
    });
  });
}

function saveSelectedText(selectionText) {
  const value = (selectionText || '').trim();
  if (!value) {
    return;
  }

  settingsStore.get((settings) => {
    const nextSentences = Shared.normalizeSettings({
      ...settings,
      sentences: [...settings.sentences, value]
    }).sentences;

    settingsStore.set({ sentences: nextSentences });
  });
}

function syncContextMenu() {
  settingsStore.get((settings) => {
    Shared.setLanguagePreference(settings.language);
    createContextMenu(settings.language);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  syncContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  syncContextMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== SAVE_SELECTION_MENU_ID) {
    return;
  }

  saveSelectedText(info.selectionText);
});

settingsStore.watch((settings) => {
  Shared.setLanguagePreference(settings.language);
  createContextMenu(settings.language);
});

syncContextMenu();
