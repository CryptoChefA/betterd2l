(() => {
  const root = document.documentElement;
  const isTop = window === window.top;
  const isPdfViewer = location.pathname.includes('/pdfjs');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  let settings = BD_DEFAULTS;
  let appliedVars = [];
  let currentMode = 'off';

  // Org unit id of the course this page belongs to, if any.
  function bdCurrentCourse() {
    const m = location.href.match(/[?&]ou=(\d+)/) ||
      location.pathname.match(/\/d2l\/(?:home|le\/content|le\/calendar|le|lms\/[a-z_]+\/[a-z_]+)\/(\d+)/);
    return m ? m[1] : null;
  }

  function inSchedule(from, to) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const f = fh * 60 + fm, t = th * 60 + tm;
    return f <= t ? mins >= f && mins < t : mins >= f || mins < t; // handles overnight
  }

  function shouldBeDark(s) {
    if (!s.enabled) return false;
    if (s.when === 'system') return systemDark.matches;
    if (s.when === 'schedule') return inSchedule(s.from, s.to);
    return true;
  }

  function setAttr(name, on, value = '') {
    if (on) root.setAttribute(name, value); else root.removeAttribute(name);
  }

  function apply(s) {
    settings = s;
    let mode = shouldBeDark(s) ? s.mode : 'off';
    // Invert is a filter on the top page, which already flips every child frame.
    if (mode === 'invert' && !isTop) mode = 'off';

    setAttr('data-bd-dark', mode !== 'off', mode);
    setAttr('data-bd-filter', s.brightness !== 100 || s.contrast !== 100);
    setAttr('data-bd-font', s.font !== 'default', s.font);
    setAttr('data-bd-rounded', s.rounded);
    setAttr('data-bd-hide-card-images', s.hideCardImages);
    setAttr('data-bd-compact', s.compact);
    setAttr('data-bd-dark-pdf', mode === 'smart' && s.darkPdf);
    setAttr('data-bd-widget-frame', !isTop && location.pathname.includes('/homepage/LegacyWidgetViewer'));

    // Inside a course, its colour tints the top band and (in Smart mode) the accent.
    const course = s.courseAccent && bdCurrentCourse() && s.courses[bdCurrentCourse()];
    const courseColor = course && course.color;

    for (const k of appliedVars) root.style.removeProperty(k);
    appliedVars = [];
    const vars = mode === 'smart' ? bdPalette(s, courseColor) : {};
    if (courseColor) vars['--d2l-branding-primary-color'] = courseColor;
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
      appliedVars.push(k);
    }
    root.style.setProperty('--bd-brightness', s.brightness + '%');
    root.style.setProperty('--bd-contrast', s.contrast + '%');

    const t = bdGetTheme(s);
    const themeKey = s.theme + JSON.stringify(t);
    const themeChanged = mode !== currentMode || fixer.theme !== themeKey;
    currentMode = mode;
    if (mode === 'smart') {
      if (themeChanged) fixer.reset();
      fixer.start(t, themeKey);
    } else {
      fixer.stop();
    }
  }

  /* ------------------------------------------------------------------
   * Colour fixer. A lot of D2L lives in shadow DOM (media player, html
   * blocks, menus) or uses hard-coded colours that page CSS can't reach.
   * This walks the light + shadow DOM and repairs, per element:
   *   - light backgrounds  -> dark (keeping any hue tint)
   *   - low-contrast text  -> lightened (keeping hue)
   *   - bright borders     -> theme border
   * Every change is recorded so it can be reverted when dark mode is off.
   * ------------------------------------------------------------------ */
  const fixer = (() => {
    const SKIP = new Set(['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'svg', 'SVG', 'path', 'SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'BR', 'SOURCE', 'OBJECT', 'EMBED']);
    const changed = new Map();          // element -> { prop: [value, priority] }
    const observers = new Map();        // root -> MutationObserver
    const pending = new Set();
    let theme = null, running = false, timer = 0;

    const parse = (c) => {
      const m = c && c.match(/[\d.]+/g);
      if (!m) return null;
      return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
    };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

    function toHsl([r, g, b]) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      if (max === min) return [0, 0, l];
      const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [h * 60, s, l];
    }
    const hsl = (h, s, l) => `hsl(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%)`;

    function set(el, prop, value) {
      if (!changed.has(el)) changed.set(el, {});
      const rec = changed.get(el);
      if (!(prop in rec)) rec[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
      el.style.setProperty(prop, value, 'important');
    }

    const parentOf = (el) => el.parentElement || (el.parentNode && el.parentNode.host) || null;
    function effectiveBg(el) {
      for (let e = el; e; e = parentOf(e)) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c[3] > 0.5) return c;
      }
      return bdHexToRgb(theme.bg);
    }

    function skipEl(el) {
      if (SKIP.has(el.tagName) || el instanceof SVGElement) return true;
      if (isPdfViewer && el.closest('.pdfViewer')) return true; // leave PDF pages alone
      return false;
    }

    function fixEl(el) {
      if (skipEl(el)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;

      // 1. Light backgrounds
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0.5 && lum(bg) > 0.45 && cs.backgroundImage === 'none') {
        const [h, s] = toHsl(bg);
        set(el, 'background-color', s < 0.15 ? theme.surface : hsl(h, Math.min(s, 0.45), 0.2));
      }

      // 2. Bright borders
      if (parseFloat(cs.borderTopWidth) || parseFloat(cs.borderBottomWidth) || parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderRightWidth)) {
        const bc = parse(cs.borderTopColor) || parse(cs.borderBottomColor);
        if (bc && bc[3] > 0.5 && lum(bc) > 0.6 && cs.borderTopColor !== cs.color) set(el, 'border-color', theme.border);
      }

      // 3. Low-contrast text (only elements that directly hold text)
      let hasText = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
      if (hasText) {
        const fg = parse(cs.color);
        if (fg && fg[3] > 0.5) {
          const back = effectiveBg(el);
          if (contrast(fg, back) < 3.2) {
            const [h, s, l] = toHsl(fg);
            if (lum(back) < 0.2) set(el, 'color', s < 0.15 ? theme.text : hsl(h, Math.max(s, 0.6), Math.max(0.72, 1 - l)));
            else set(el, 'color', theme.bg);
          }
        }
      }
    }

    function observe(r) {
      if (observers.has(r)) return;
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes') pending.add(m.target);
          else for (const n of m.addedNodes) if (n.nodeType === 1) pending.add(n);
        }
        schedule();
      });
      mo.observe(r, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      observers.set(r, mo);
    }

    // Walk an element/root: fix it, its descendants, and any shadow roots (parents before children).
    function walk(node) {
      if (node.nodeType === 1) {
        fixEl(node);
        if (node.shadowRoot) { observe(node.shadowRoot); walk(node.shadowRoot); }
      }
      const all = node.querySelectorAll ? node.querySelectorAll('*') : [];
      for (const el of all) {
        fixEl(el);
        if (el.shadowRoot) { observe(el.shadowRoot); walk(el.shadowRoot); }
      }
    }

    function flush() {
      timer = 0;
      if (!running) return;
      const nodes = [...pending]; pending.clear();
      for (const n of nodes) if (n.isConnected) walk(n);
    }
    function schedule() { if (running && !timer) timer = setTimeout(flush, 120); }

    function fullScan() { if (running && document.documentElement) { pending.add(document.documentElement); schedule(); } }

    return {
      get theme() { return theme && theme.key; },
      start(t, key) {
        theme = { ...t, key };
        if (running) return;
        running = true;
        observe(document);
        fullScan();
        // Custom elements upgrade and render late; sweep a few more times.
        for (const ms of [800, 2000, 4500, 9000]) setTimeout(fullScan, ms);
        document.addEventListener('DOMContentLoaded', fullScan, { once: true });
        window.addEventListener('load', fullScan, { once: true });
      },
      stop() {
        running = false;
        for (const mo of observers.values()) mo.disconnect();
        observers.clear(); pending.clear();
        this.reset();
      },
      reset() {
        for (const [el, rec] of changed) {
          for (const [prop, [v, p]] of Object.entries(rec)) {
            if (v) el.style.setProperty(prop, v, p); else el.style.removeProperty(prop);
          }
        }
        changed.clear();
        if (running) fullScan();
      }
    };
  })();

  const load = () => chrome.storage.sync.get(BD_DEFAULTS, apply);

  apply(BD_DEFAULTS); // paint dark immediately to avoid a white flash
  load();
  chrome.storage.onChanged.addListener(load);
  systemDark.addEventListener('change', () => apply(settings));
  setInterval(() => { if (settings.when === 'schedule') apply(settings); }, 60 * 1000);
})();
