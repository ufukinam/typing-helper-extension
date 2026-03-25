const assert = require('node:assert/strict');
const Shared = require('./shared.js');

function testNormalizeSettings() {
  const settings = Shared.normalizeSettings({
    sentences: [' Hello ', 'hello', 'World'],
    allowedSites: ['https://www.google.com/test', 'google.com', 'example.com'],
    shortcuts: {
      '#Login': 'A',
      'login': 'B',
      '#': '',
      ' ': 'noop'
    },
    triggerCharacter: '#',
    acceptKey: 'Enter',
    language: 'tr'
  });

  assert.deepEqual(settings.sentences, ['Hello', 'World']);
  assert.deepEqual(settings.allowedSites, ['google.com', 'example.com']);
  assert.equal(settings.shortcuts.login, 'B');
  assert.equal(settings.acceptKey, 'Enter');
  assert.equal(settings.language, 'tr');
}

function testSiteMatching() {
  assert.equal(Shared.isSiteAllowed('mail.google.com', ['google.com']), true);
  assert.equal(Shared.isSiteAllowed('notgoogle.com', ['google.com']), false);
  assert.equal(Shared.isSiteAllowed('example.com', []), true);
}

function testShortcutMatching() {
  const shortcuts = { login: 'payload' };

  assert.equal(Shared.findShortcutExpansion(shortcuts, '#login', '#'), 'payload');
  assert.equal(Shared.findShortcutExpansion(shortcuts, 'login', '#'), '');
  assert.equal(Shared.findShortcutExpansion(shortcuts, '@login', '#'), '');
}

function testSentenceMatches() {
  const matches = Shared.getSentenceMatches(
    ['Hello world', 'Help desk', 'Goodbye'],
    'he'
  );

  assert.deepEqual(matches, ['Hello world', 'Help desk']);
}

function testEnglishCapitalIMatching() {
  const matches = Shared.getSentenceMatches(
    ['Invoice sent'],
    'invoice'
  );

  assert.deepEqual(matches, ['Invoice sent']);
}

function testTurkishNormalization() {
  const matches = Shared.getSentenceMatches(
    ['\u0130ade i\u015flemi ger\u00e7ekle\u015ftirildi, kontrol sa\u011flanabilir.'],
    'iade'
  );

  assert.deepEqual(matches, ['\u0130ade i\u015flemi ger\u00e7ekle\u015ftirildi, kontrol sa\u011flanabilir.']);
}

function testAllowedSiteMatch() {
  assert.equal(Shared.findAllowedSiteMatch('mail.google.com', ['google.com']), 'google.com');
  assert.equal(Shared.findAllowedSiteMatch('docs.mail.google.com', ['google.com', 'mail.google.com']), 'mail.google.com');
  assert.equal(Shared.findAllowedSiteMatch('example.com', ['google.com']), '');
}

function testHostPermissionPatterns() {
  assert.deepEqual(Shared.getHostPermissionPatterns('google.com'), [
    'http://google.com/*',
    'https://google.com/*',
    'http://*.google.com/*',
    'https://*.google.com/*'
  ]);

  assert.deepEqual(Shared.getHostPermissionPatterns('localhost'), [
    'http://localhost/*',
    'https://localhost/*'
  ]);
}

function testLanguagePreference() {
  assert.equal(Shared.getEffectiveLanguage('tr'), 'tr');
  assert.equal(Shared.getEffectiveLanguage('en'), 'en');
  assert.equal(['en', 'tr'].includes(Shared.getEffectiveLanguage('browser')), true);
}

function testSettingsStoreWatchReturnsFullState() {
  const originalChrome = global.chrome;
  const listeners = [];
  const storageArea = {
    data: {
      ...Shared.DEFAULT_SETTINGS,
      sentences: ['Hello'],
      language: 'tr'
    },
    get(_keys, callback) {
      callback({ ...this.data });
    }
  };

  global.chrome = {
    storage: {
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
        removeListener(listener) {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        }
      }
    }
  };

  try {
    const store = Shared.createSettingsStore(storageArea);
    let observed = null;
    const unwatch = store.watch((nextSettings) => {
      observed = nextSettings;
    });

    storageArea.data = {
      ...storageArea.data,
      acceptKey: 'Enter'
    };
    listeners[0]({
      acceptKey: { newValue: 'Enter' }
    }, 'sync');

    assert.deepEqual(observed.sentences, ['Hello']);
    assert.equal(observed.language, 'tr');
    assert.equal(observed.acceptKey, 'Enter');

    unwatch();
  } finally {
    global.chrome = originalChrome;
  }
}

function testHistoryStack() {
  const history = new Shared.SnapshotHistory(3);
  history.push({ value: 'a', start: 1, end: 1 });
  history.push({ value: 'ab', start: 2, end: 2 });
  history.push({ value: 'abc', start: 3, end: 3 });

  assert.equal(history.undo().value, 'ab');
  assert.equal(history.undo().value, 'a');
  assert.equal(history.undo(), null);
}

testNormalizeSettings();
testSiteMatching();
testShortcutMatching();
testSentenceMatches();
testEnglishCapitalIMatching();
testTurkishNormalization();
testAllowedSiteMatch();
testHostPermissionPatterns();
testLanguagePreference();
testSettingsStoreWatchReturnsFullState();
testHistoryStack();

console.log('All tests passed.');
