# How BetterD2L works

BetterD2L is a Manifest V3 Chrome extension with no build step: plain JavaScript and CSS, loaded unpacked.

## Scripts

| File | Runs in | Job |
|---|---|---|
| `themes.js` | content scripts, popup, settings | Theme presets, defaults, palette → D2L token mapping, theme share codes |
| `content.js` | **every frame** of a D2L page, at `document_start` | Dark mode engine |
| `features.js` | **top frame only** | Course cards, nicknames/colours, countdown, widget hiding |
| `betterd2l.css` | every frame | Static styles keyed off `html[data-bd-*]` attributes |
| `background.js` | service worker | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> toggle |
| `popup.*` / `options.*` | extension pages | UI. They only read and write `chrome.storage` |

Everything communicates through `chrome.storage`. The UI writes settings, and the content scripts listen with `storage.onChanged` and re-apply live, with no page reload.

## Dark mode (Smart), in three layers

1. **Design tokens.** Brightspace's web components read colours from CSS custom properties such as `--d2l-color-ferrite` and `--d2l-color-sylvite`. `bdPalette()` maps each theme onto those tokens and `content.js` sets them on `<html>`. Custom properties inherit through shadow DOM, so this re-themes most components for free.
2. **Static CSS** (`betterd2l.css`) covers legacy pages and known hard-coded white areas: the navbar, the mobile menu, tables and inputs.
3. **The colour fixer** (in `content.js`) catches the rest. It walks the light DOM and every open shadow root, and for each element:
   - darkens **light backgrounds**, keeping any hue tint (a pale yellow callout becomes a dark yellow one),
   - lightens **low-contrast text** (WCAG contrast < 3.2), keeping its hue so an instructor's red text stays red,
   - swaps **bright borders** for the theme border.

   Every change is recorded in a `Map` and can be fully reverted. A `MutationObserver` on the document and on each shadow root re-runs it on new content. A full pass on a D2L page takes about 20 ms.

PDF pages in D2L's built-in viewer are left alone unless **Dark PDF pages** is on.

**Invert mode** applies `filter: invert(1) hue-rotate(180deg)` to the top frame only and un-inverts media. Child frames skip it so they aren't inverted twice.

## Features (`features.js`)

- **Data**: D2L's REST API (Valence), called from the page with the user's own session. The API version is discovered from `/d2l/api/versions/`.
  - `lp/{v}/enrollments/myenrollments/` gives the course list (cached for 6 h in `storage.local`)
  - `le/{v}/{ou}/quizzes/` gives quiz and exam windows
  - `le/{v}/{ou}/dropbox/folders/` gives assignment due dates (cached for 15 min)
- **Course cards** (`d2l-my-courses-enrollment-card`, id `enrollment-card-{orgUnitId}`): a `<style>` is injected into each card's shadow root for the colour bar and tint. The name text node and the image `src` are swapped, with the originals recorded.
- **Nicknames and colour coding**: a TreeWalker scans text in every root for a known full course name. It renames the text and colours its element, adding a coloured edge for Work To Do items and calendar rows.
- **Inside a course**, `content.js` sets `--d2l-branding-primary-color` (the top band) and, in Smart mode, the accent to that course's colour. The course is detected from the URL (`/d2l/home/{ou}`, `?ou=`, etc.).
- **Widgets**: `.d2l-widget` headings are collected into `storage.local.widgetNames`, and widgets listed in `hiddenWidgets` get `display: none`.

## Storage

| Key | Area | Contents |
|---|---|---|
| theme, mode, schedule, tweaks… | `sync` | See `BD_DEFAULTS` in `themes.js` |
| `courses` | `sync` | `{ [orgUnitId]: { nick, color } }` |
| `customThemes` | `sync` | `{ [id]: { name, bg, surface, surface2, border, text, accent } }` |
| `hiddenWidgets` | `sync` | Widget headings to hide |
| `courseImages` | `local` | `{ [orgUnitId]: dataURL or https URL }`. Images are kept out of sync because of its size quota |
| `courseList`, `widgetNames`, `deadlines:*` | `local` | Caches |

## Debugging a page that's still bright

Paste this into DevTools on the page. It lists text that's hard to read and big light boxes, including inside shadow roots:

```js
(() => {
  const P = c => (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number);
  const L = ([r, g, b]) => [r, g, b].map(v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
  const out = [];
  (function walk(root) {
    for (const el of root.querySelectorAll('*')) {
      const cs = getComputedStyle(el), bg = P(cs.backgroundColor), r = el.getBoundingClientRect();
      if ((bg[3] ?? 1) > .5 && L(bg) > .5 && r.width > 60 && r.height > 16) out.push(['light bg', el]);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  })(document);
  console.table(out.map(([why, el]) => ({ why, tag: el.tagName, cls: el.className })));
})();
```

Then add a rule to `betterd2l.css`, or improve the fixer, and reload the extension.
