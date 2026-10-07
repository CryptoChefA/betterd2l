# Contributing

Thanks for helping make D2L nicer! 🌙

## Dev setup
1. Clone the repo and load it with **Load unpacked** at `chrome://extensions` (Developer mode on).
2. Edit files. There's no build step.
3. Click **↻** on the extension card, then hard-refresh D2L (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>).

The popup and settings page also open as plain web pages (`python3 -m http.server` in the repo, then visit `/popup.html` or `/options.html`). Outside the extension they fall back to sample data, which is handy for UI work.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. It explains the three dark-mode layers and where each feature lives.

## Reporting a bright spot or bug
Open an issue with:
- the D2L page (e.g. *Quizzes → quiz summary*), with the URL path but **no personal info**,
- your theme and mode (Smart or Invert),
- a screenshot, **with your name, grades and instructor content blurred**.

## Pull requests
- Keep it dependency-free: plain JS and CSS, Manifest V3.
- Match the existing style (2-space indent, small functions, comments only where something isn't obvious).
- Never add analytics, remote code or network calls outside the user's own D2L origin.
- Test in both **Smart** and **Invert** modes, and with dark mode **off**.
