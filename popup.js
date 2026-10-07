const $ = (id) => document.getElementById(id);
const store = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : null;
let s = { ...BD_DEFAULTS };

function paintPopup() {
  const p = bdPalette(s);
  for (const [k, v] of Object.entries(p)) document.documentElement.style.setProperty(k, v);
}

function render() {
  if ($('themes').children.length !== Object.keys({ ...BD_THEMES, ...(s.customThemes || {}) }).length) buildThemes();
  $('enabled').checked = s.enabled;
  for (const b of $('themes').children) b.setAttribute('aria-pressed', b.dataset.v === s.theme);
  for (const b of $('mode').children) b.setAttribute('aria-pressed', b.dataset.v === s.mode);
  $('accent').value = s.accent || bdGetTheme(s).accent;
  $('when').value = s.when;
  $('scheduleRow').style.display = s.when === 'schedule' ? '' : 'none';
  $('from').value = s.from; $('to').value = s.to;
  $('brightness').value = s.brightness; $('bv').textContent = s.brightness + '%';
  $('contrast').value = s.contrast; $('cv').textContent = s.contrast + '%';
  $('font').value = s.font;
  $('rounded').checked = s.rounded;
  $('hideCardImages').checked = s.hideCardImages;
  $('compact').checked = s.compact;
  $('darkPdf').checked = s.darkPdf;
  paintPopup();
}

function set(patch) {
  Object.assign(s, patch);
  render();
  if (store) store.set(patch);
}

// Theme swatches (presets + your custom themes)
const escHtml = (t) => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function buildThemes() {
  $('themes').innerHTML = '';
  const all = { ...BD_THEMES, ...(s.customThemes || {}) };
  for (const [key, t] of Object.entries(all)) {
    const b = document.createElement('button');
    b.dataset.v = key;
    b.title = t.name;
    b.innerHTML = `<div class="swatch"><i style="background:${t.bg}"></i><i style="background:${t.surface2}"></i><i style="background:${t.accent}"></i></div><span style="background:${t.surface};color:${t.text}">${escHtml(t.name)}</span>`;
    b.onclick = () => set({ theme: key, accent: '' });
    $('themes').appendChild(b);
  }
}
$('openOptions').onclick = () => chrome.runtime.openOptionsPage();
for (const b of $('mode').children) b.onclick = () => set({ mode: b.dataset.v });

$('enabled').onchange = (e) => set({ enabled: e.target.checked });
$('accent').oninput = (e) => set({ accent: e.target.value });
$('resetAccent').onclick = () => set({ accent: '' });
$('when').onchange = (e) => set({ when: e.target.value });
$('from').onchange = (e) => set({ from: e.target.value });
$('to').onchange = (e) => set({ to: e.target.value });
$('brightness').oninput = (e) => set({ brightness: +e.target.value });
$('contrast').oninput = (e) => set({ contrast: +e.target.value });
$('font').onchange = (e) => set({ font: e.target.value });
for (const id of ['rounded', 'hideCardImages', 'compact', 'darkPdf']) $(id).onchange = (e) => set({ [id]: e.target.checked });

if (store) store.get(BD_DEFAULTS, (saved) => { s = saved; render(); });
else render();
