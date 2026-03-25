# Text Completer

Chrome extension for inserting saved texts and shortcut snippets while typing.

## Features

- Saved text suggestions while typing
- Arrow Up and Arrow Down to switch suggestions
- Configurable accept key: `Tab`, `Enter`, or `ArrowRight`
- Shortcut snippets with a trigger character such as `#login`
- Right-click action to save selected text
- Per-site enablement with optional Chrome site access
- English and Turkish UI with browser-default language support

## Project Files

- `manifest.json`: MV3 manifest
- `background.js`: context menu, optional host permission flow, runtime injection
- `content.js`: in-page suggestion, shortcut, and editor logic
- `shared.js`: shared settings, matching, localization, and helpers
- `popup.html` / `popup.js`: popup UI
- `settings.html` / `settings.js`: options page UI
- `tests.js`: Node-based regression tests for shared logic

## Local Development

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select this folder

After code changes, click `Reload` on the extension card.

## Site Access Model

The extension does not run on all sites by default.

Enable a site from:

- the popup current-site section
- the settings page allowed-sites list

Chrome will ask for site access when a site is enabled.

## Testing

Run the shared logic tests with:

```powershell
node tests.js
```

You can also syntax-check the main scripts with:

```powershell
node --check shared.js
node --check background.js
node --check content.js
node --check popup.js
node --check settings.js
```

## Notes

- Saved data is stored in `chrome.storage.sync`
- The extension currently supports both normal form controls and many `contenteditable` editors, but rich editors should still be tested manually before release
