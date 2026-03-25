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
    acceptKey: 'Enter'
  });

  assert.deepEqual(settings.sentences, ['Hello', 'World']);
  assert.deepEqual(settings.allowedSites, ['google.com', 'example.com']);
  assert.equal(settings.shortcuts.login, 'B');
  assert.equal(settings.acceptKey, 'Enter');
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

function testTurkishNormalization() {
  const matches = Shared.getSentenceMatches(
    ['İade işlemi gerçekleştirildi, kontrol sağlanabilir.'],
    'iade'
  );

  assert.deepEqual(matches, ['İade işlemi gerçekleştirildi, kontrol sağlanabilir.']);
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
testTurkishNormalization();
testHistoryStack();

console.log('All tests passed.');
