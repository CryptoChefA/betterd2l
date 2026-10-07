// Shared by the content script and the popup.
var BD_THEMES = {
  midnight:  { name: 'Midnight',      bg: '#16181c', surface: '#1e2127', surface2: '#272b33', border: '#3a3f4a', text: '#e6e8eb', accent: '#6cb4ff' },
  langara:   { name: 'Langara Night', bg: '#1a1612', surface: '#231e19', surface2: '#2e2721', border: '#453b31', text: '#f1e9e0', accent: '#f58025' },
  amoled:    { name: 'AMOLED',        bg: '#000000', surface: '#0b0b0c', surface2: '#161618', border: '#2a2a2e', text: '#ececec', accent: '#4fa3ff' },
  graphite:  { name: 'Graphite',      bg: '#202124', surface: '#292a2d', surface2: '#35363a', border: '#4a4b50', text: '#e8eaed', accent: '#8ab4f8' },
  nord:      { name: 'Nord',          bg: '#2e3440', surface: '#3b4252', surface2: '#434c5e', border: '#4c566a', text: '#eceff4', accent: '#88c0d0' },
  dracula:   { name: 'Dracula',       bg: '#21222c', surface: '#282a36', surface2: '#343746', border: '#44475a', text: '#f8f8f2', accent: '#bd93f9' },
  solarized: { name: 'Solarized',     bg: '#002b36', surface: '#073642', surface2: '#0d4250', border: '#1d5563', text: '#eee8d5', accent: '#2aa198' },
  forest:    { name: 'Forest',        bg: '#141a16', surface: '#1b231e', surface2: '#243029', border: '#34453a', text: '#e3ece5', accent: '#6fd08c' },
  rose:      { name: 'Rosé',          bg: '#1d1418', surface: '#27191f', surface2: '#33212a', border: '#4d3140', text: '#fbe7f0', accent: '#ff6fae' }
};

var BD_DEFAULTS = {
  enabled: true,
  mode: 'smart',          // smart | invert
  theme: 'midnight',
  accent: '',             // '' = use theme accent
  when: 'always',         // always | system | schedule
  from: '19:00',
  to: '07:00',
  brightness: 100,
  contrast: 100,
  font: 'default',        // default | system | rounded | mono | dyslexic
  rounded: true,
  hideCardImages: false,
  compact: false,
  darkPdf: false,
  smoothTransitions: true, // crossfade when the theme / mode changes

  // Courses: { [orgUnitId]: { nick, color } }  (images live in storage.local)
  courses: {},
  courseAccent: true,     // use the course colour as accent + top band inside a course
  // Custom themes: { [id]: { name, bg, surface, surface2, border, text, accent } }
  customThemes: {},
  hiddenWidgets: [],      // homepage widget headings to hide
  countdown: true,
  countdownAssignments: true
};

var BD_COURSE_COLORS = ['#f58025', '#4fa3ff', '#5ccf8b', '#bd93f9', '#ff6b8b', '#f2c94c', '#2ec4b6', '#ff8f6b', '#9b8cff', '#7ed957'];

// Resolve a theme key (preset or custom).
function bdGetTheme(s) {
  return (s.customThemes && s.customThemes[s.theme]) || BD_THEMES[s.theme] || BD_THEMES.midnight;
}

// Share codes for custom themes: "BD2L:" + base64(JSON)
var BD_THEME_FIELDS = ['bg', 'surface', 'surface2', 'border', 'text', 'accent'];
function bdEncodeTheme(t) {
  const o = { name: t.name };
  for (const k of BD_THEME_FIELDS) o[k] = t[k];
  return 'BD2L:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function bdDecodeTheme(code) {
  const raw = code.trim().replace(/^BD2L:/, '');
  const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
  const hex = /^#[0-9a-f]{6}$/i;
  for (const k of BD_THEME_FIELDS) if (!hex.test(o[k] || '')) throw new Error('Invalid colour: ' + k);
  return { name: String(o.name || 'Shared theme').slice(0, 30), ...Object.fromEntries(BD_THEME_FIELDS.map(k => [k, o[k]])) };
}

function bdHexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Mix colour a toward b by t (0..1).
function bdMix(a, b, t) {
  const A = bdHexToRgb(a), B = bdHexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Full palette for a theme, including the D2L design-token overrides.
function bdPalette(s, accentOverride) {
  const t = bdGetTheme(s);
  const accent = accentOverride || s.accent || t.accent;
  const m = (k) => bdMix(t.bg, t.text, k);
  return {
    '--bd-bg': t.bg, '--bd-surface': t.surface, '--bd-surface2': t.surface2,
    '--bd-border': t.border, '--bd-text': t.text, '--bd-muted': m(0.65),
    '--bd-accent': accent, '--bd-accent-hover': bdMix(accent, t.text, 0.25),
    '--bd-visited': bdMix(accent, '#c08cff', 0.5),

    '--d2l-color-ferrite': t.text,
    '--d2l-color-tungsten': m(0.85),
    '--d2l-color-galena': m(0.7),
    '--d2l-color-chromite': m(0.58),
    '--d2l-color-corundum': m(0.45),
    '--d2l-color-mica': m(0.3),
    '--d2l-color-gypsum': t.border,
    '--d2l-color-sylvite': t.surface2,
    '--d2l-color-regolith': t.surface,
    '--d2l-color-white': t.surface,
    '--d2l-color-celestine': accent,
    '--d2l-color-celestine-plus-1': bdMix(accent, t.text, 0.25),
    '--d2l-color-celestine-minus-1': bdMix(accent, t.bg, 0.2),
    '--d2l-color-cinnabar': '#ff7a6b',
    '--d2l-color-carnelian': '#ff8f6b',
    '--d2l-color-olivine': '#5ccf8b',
    '--d2l-theme-background-color-base': t.surface,
    '--d2l-theme-text-color-static-standard': t.text,
    '--d2l-theme-border-color-standard': t.border,
    '--d2l-loading-spinner-background-color': t.surface2
  };
}
