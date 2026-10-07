# Changelog

All notable changes to BetterD2L are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [2.5.0] - 2026-10-06

### Added
- 🖌️ **+ Create** tile in the popup's theme grid that opens the theme builder directly.
- 🎨 **Theme maker on the website**: pick six colours, preview them live on the page, and copy a `BD2L:` code to import into BetterD2L.

### Changed
- Website SEO: a keyword-targeted title and description, canonical URL, structured data (app details, FAQ and website info, eligible for Google rich results), a sitemap, a 1200×630 link-preview image, search-focused FAQ entries, and descriptive alt text.
- Website speed: the hero demo is now a 222 KB looping video (the 4 MB GIF is the fallback), and images have fixed dimensions so the page doesn't shift while loading.

## [2.4.0] - 2026-10-06

### Added
- 🌸 **Rosé** theme: deep plum backgrounds with a bubblegum-pink accent. That makes 9 built-in themes.

### Changed
- Tightened the website and README copy.

## [2.3.0] - 2026-10-06

### Added
- ✨ **Smooth theme transitions**: switching themes, Smart/Invert mode or dark mode on/off now crossfades the whole page, including D2L's shadow-DOM components, using the View Transitions API. You can switch it off in the popup (*Tweaks → Smooth theme transitions*), and it turns off automatically when your system's *Reduce motion* setting is on. Sliders and colour pickers stay instant.
- 🌐 **Website** at [cryptochefa.github.io/betterd2l](https://cryptochefa.github.io/betterd2l/): a one-page site with a download button, install steps, screenshots and an interactive theme picker.
- 🎞️ **Demo GIF** at the top of the README.
- Releases now include a stable **`betterd2l.zip`** download that always points to the latest version.

## [2.2.1] - 2026-10-06

### Added
- Custom course images now also replace the banner at the top of the course homepage, not just the course card. The original banner is restored exactly when you remove the image.

### Fixed
- The popup's **🎨 Courses, themes & homepage** button could fail with *"Could not create an options page"*. It now falls back to opening the settings page in a normal tab.
- Nicknames and custom card images apply faster after D2L finishes rendering, so the original name and image flash much more briefly.

## [2.2.0] - 2026-10-06

### Added
- ⏳ **Exam and deadline countdown** banner on the homepage and course homepages. It pulls quizzes, exams and assignment due dates from D2L and turns orange under 3 days and red under 24 hours.
- 🎨 **Custom course cards**: nicknames, colours and your own images (upload or URL).
- 🌈 **Course colour coding** across course cards, Work To Do, the Calendar and the countdown, plus a course-coloured top band and accent inside each course.
- 🖌️ **Theme builder** with live preview and `BD2L:` share codes for importing and exporting themes.
- 🧹 **Hide clutter**: switch individual homepage widgets on or off.
- New full **settings page** (Courses, Themes, Homepage), opened from the popup.
- README with screenshots, plus architecture, privacy and contributing docs.

### Fixed
- Grade item names on the Grades page sat in darker boxes.
- The *Updates* widget frame now blends with its widget instead of showing as a separate box.

## [2.1.0] - 2026-10-06

### Added
- **Colour fixer**: repairs hard-coded light backgrounds, low-contrast text and bright borders, including inside shadow DOM (audio player, instructor announcements, calendar, menus).
- Optional **Dark PDF pages** for D2L's built-in PDF viewer.

### Changed
- Brightness and contrast filters only apply when moved off 100%.

### Fixed
- Mobile navigation menu showed light text on white.
- *Updates* widget text was invisible on the course homepage.
- White loading spinners, calendar view buttons, hour labels and borders.
- Extension didn't run on `d2l.langara.bc.ca`.

## [2.0.0] - 2026-10-06

### Added
- Renamed to **BetterD2L**.
- 8 themes, custom accent colour, schedule and follow-system modes, font choices, tweaks, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> shortcut and icons.

## [1.0.0] - 2026-10-06

### Added
- First release: Smart and Invert dark mode for Langara D2L.

[2.5.0]: https://github.com/CryptoChefA/betterd2l/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/CryptoChefA/betterd2l/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/CryptoChefA/betterd2l/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/CryptoChefA/betterd2l/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/CryptoChefA/betterd2l/releases/tag/v2.2.0
[2.1.0]: https://github.com/CryptoChefA/betterd2l/blob/main/CHANGELOG.md#210---2026-10-06
[2.0.0]: https://github.com/CryptoChefA/betterd2l/blob/main/CHANGELOG.md#200---2026-10-06
[1.0.0]: https://github.com/CryptoChefA/betterd2l/blob/main/CHANGELOG.md#100---2026-10-06
