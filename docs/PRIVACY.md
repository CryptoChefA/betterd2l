# Privacy

**Short version:** BetterD2L has no servers, no analytics and no tracking. Your data never leaves your browser.

## What it accesses
- **D2L pages** at `d2l.langara.bc.ca` and `brightspace.langara.ca`. The extension runs nowhere else.
- **D2L's API**, read-only and from inside your logged-in D2L tab, to get your course list, quiz and exam dates, and assignment due dates. These are the same requests D2L's own pages make, using your existing session. BetterD2L never sees or stores your password.

## What it stores
Everything is stored in Chrome's extension storage, on your device:
- **Settings, course nicknames and colours, custom themes and hidden widgets** go in `chrome.storage.sync`. If you're signed in to Chrome with sync on, Google syncs them between *your own* browsers.
- **Course card images** you upload, plus caches of your course list and deadlines, go in `chrome.storage.local`. These never sync.

## What it never does
- It never sends data to the developer or to any third party.
- It never makes changes in D2L. It doesn't submit anything, post anything or edit your account.
- It never loads remote code. Everything it runs ships in this repository.

**Theme share codes** contain only a theme name and six colours. You can check by base64-decoding one.

To remove everything, uninstall the extension from `chrome://extensions`.
