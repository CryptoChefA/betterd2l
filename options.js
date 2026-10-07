const $ = (id) => document.getElementById(id);
const hasChrome = typeof chrome !== 'undefined' && chrome.storage;
const sync = hasChrome ? chrome.storage.sync : null;
const localStore = hasChrome ? chrome.storage.local : null;

let s = { ...BD_DEFAULTS };
let local = { courseList: [], courseImages: {}, widgetNames: [] };
let editingId = null;

const esc = (t) => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

function save(patch) {
  Object.assign(s, patch);
  if (sync) sync.set(patch);
  paintPage();
}

function paintPage() {
  for (const [k, v] of Object.entries(bdPalette(s))) document.documentElement.style.setProperty(k, v);
}

// ------------------------------------------------------------------ tabs
for (const b of document.querySelectorAll('.tabs button')) {
  b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-' + b.dataset.tab));
    history.replaceState(null, '', '#' + b.dataset.tab);
  };
}
const startTab = location.hash.slice(1);
if (startTab) document.querySelector(`.tabs button[data-tab="${startTab}"]`)?.click();

// --------------------------------------------------------------- courses
function setCourse(id, patch) {
  const courses = { ...s.courses, [id]: { ...(s.courses[id] || {}), ...patch } };
  save({ courses });
}

// Resize an uploaded image to a small JPEG data URL so it fits in storage.
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(800, img.width), h = Math.round(img.height * (w / img.width));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function setImage(id, value) {
  const courseImages = { ...local.courseImages };
  if (value) courseImages[id] = value; else delete courseImages[id];
  local.courseImages = courseImages;
  if (localStore) await localStore.set({ courseImages });
  renderCourses();
}

function renderCourses() {
  const list = $('courseList');
  list.innerHTML = '';
  $('noCourses').hidden = local.courseList.length > 0;
  for (const c of local.courseList) {
    const conf = s.courses[c.id] || {};
    const color = conf.color || BD_COURSE_COLORS[0];
    const img = local.courseImages[c.id];
    const el = document.createElement('div');
    el.className = 'course';
    el.style.setProperty('--cc', color);
    el.innerHTML = `
      <div class="thumb" style="${img ? `background-image:url('${esc(img)}')` : ''}"></div>
      <div>
        <div class="orig">${esc(c.name)} · ${esc(c.code || '')}</div>
        <div class="controls">
          <input class="nick" placeholder="Nickname (e.g. Business Law)" maxlength="40" value="${esc(conf.nick || '')}">
          <input type="color" class="color" value="${esc(color)}" title="Course colour">
          <button class="upload">Upload image</button>
          <button class="url">Image URL</button>
          ${img ? '<button class="clear danger">Remove image</button>' : ''}
          <input type="file" accept="image/*" hidden>
        </div>
        <div class="swatches">${BD_COURSE_COLORS.map(k => `<button style="background:${k}" data-c="${k}" class="${k === color ? 'on' : ''}" title="${k}"></button>`).join('')}</div>
      </div>`;
    const q = (sel) => el.querySelector(sel);
    q('.nick').onchange = (e) => { setCourse(c.id, { nick: e.target.value.trim() }); toast('Saved'); };
    q('.color').oninput = (e) => { el.style.setProperty('--cc', e.target.value); };
    q('.color').onchange = (e) => { setCourse(c.id, { color: e.target.value }); renderCourses(); };
    el.querySelectorAll('.swatches button').forEach(b => b.onclick = () => { setCourse(c.id, { color: b.dataset.c }); renderCourses(); });
    q('.upload').onclick = () => q('input[type=file]').click();
    q('input[type=file]').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await setImage(c.id, await resizeImage(f)); toast('Image saved'); }
      catch { toast('Could not read that image'); }
    };
    q('.url').onclick = () => {
      const u = prompt('Image URL (https://…)', img && !img.startsWith('data:') ? img : '');
      if (u === null) return;
      if (u && !/^https:\/\//i.test(u)) return toast('Use an https:// link');
      setImage(c.id, u.trim());
    };
    if (q('.clear')) q('.clear').onclick = () => setImage(c.id, '');
    list.appendChild(el);
  }
}

$('courseAccent').onchange = (e) => save({ courseAccent: e.target.checked });

// ---------------------------------------------------------------- themes
function builderTheme() {
  const t = { name: $('tbName').value.trim() || 'My theme' };
  for (const k of BD_THEME_FIELDS) t[k] = $('tb-' + k).value;
  return t;
}

function paintPreview() {
  const t = builderTheme(), p = $('preview');
  for (const k of BD_THEME_FIELDS) p.style.setProperty('--pv-' + k, t[k]);
}

function loadIntoBuilder(t, id) {
  editingId = id || null;
  $('tbName').value = id ? t.name : '';
  for (const k of BD_THEME_FIELDS) $('tb-' + k).value = t[k];
  $('tbEditing').hidden = !id;
  $('tbEditing').textContent = id ? `Editing “${t.name}” — saving updates it.` : '';
  paintPreview();
}

function renderBase() {
  const sel = $('tbBase');
  const opts = Object.entries(BD_THEMES).map(([k, t]) => `<option value="p:${k}">${esc(t.name)}</option>`);
  const custom = Object.entries(s.customThemes || {}).map(([k, t]) => `<option value="c:${k}">${esc(t.name)} (yours)</option>`);
  sel.innerHTML = opts.join('') + custom.join('');
}

$('tbBase').onchange = (e) => {
  const [kind, key] = e.target.value.split(':');
  if (kind === 'p') loadIntoBuilder(BD_THEMES[key]);
  else loadIntoBuilder(s.customThemes[key], key);
};
for (const k of BD_THEME_FIELDS) $('tb-' + k).oninput = paintPreview;
$('tbReset').onclick = () => loadIntoBuilder(bdGetTheme(s));
$('tbSave').onclick = () => {
  const id = editingId || 'custom-' + Date.now().toString(36);
  const customThemes = { ...s.customThemes, [id]: builderTheme() };
  save({ customThemes, theme: id });
  loadIntoBuilder(customThemes[id], id);
  renderThemes();
  toast('Theme saved and applied');
};

function renderThemes() {
  const box = $('customThemes');
  const entries = Object.entries(s.customThemes || {});
  $('noThemes').hidden = entries.length > 0;
  box.innerHTML = '';
  for (const [id, t] of entries) {
    const row = document.createElement('div');
    row.className = 'theme-row';
    row.innerHTML = `
      <div class="sw"><i style="background:${t.bg}"></i><i style="background:${t.surface}"></i><i style="background:${t.surface2}"></i><i style="background:${t.accent}"></i></div>
      <b>${esc(t.name)}${s.theme === id ? ' · in use' : ''}</b>
      <div class="actions">
        <button class="use">Use</button><button class="edit">Edit</button>
        <button class="share">Copy share code</button><button class="del danger">Delete</button>
      </div>`;
    row.querySelector('.use').onclick = () => { save({ theme: id }); renderThemes(); toast('Theme applied'); };
    row.querySelector('.edit').onclick = () => { loadIntoBuilder(t, id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    row.querySelector('.share').onclick = async () => {
      const code = bdEncodeTheme(t);
      try { await navigator.clipboard.writeText(code); toast('Share code copied'); }
      catch { prompt('Copy this share code:', code); }
    };
    row.querySelector('.del').onclick = () => {
      if (!confirm(`Delete “${t.name}”?`)) return;
      const customThemes = { ...s.customThemes };
      delete customThemes[id];
      save({ customThemes, theme: s.theme === id ? 'midnight' : s.theme });
      if (editingId === id) loadIntoBuilder(bdGetTheme(s));
      renderThemes(); renderBase();
    };
    box.appendChild(row);
  }
  renderBase();
}

$('importBtn').onclick = () => {
  try {
    const t = bdDecodeTheme($('importCode').value);
    const id = 'custom-' + Date.now().toString(36);
    save({ customThemes: { ...s.customThemes, [id]: t }, theme: id });
    $('importCode').value = '';
    $('importMsg').textContent = `Imported “${t.name}” and applied it.`;
    renderThemes();
  } catch {
    $('importMsg').textContent = "That code doesn't look right — check you copied all of it.";
  }
};

// -------------------------------------------------------------- homepage
$('countdown').onchange = (e) => save({ countdown: e.target.checked });
$('countdownAssignments').onchange = (e) => save({ countdownAssignments: e.target.checked });

function renderWidgets() {
  const box = $('widgetList');
  box.innerHTML = '';
  const names = local.widgetNames || [];
  $('noWidgets').hidden = names.length > 0;
  const hidden = new Set(s.hiddenWidgets || []);
  for (const name of names) {
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<span>${esc(name)}</span><input type="checkbox" ${hidden.has(name) ? '' : 'checked'}>`;
    row.querySelector('input').onchange = (e) => {
      const set = new Set(s.hiddenWidgets || []);
      if (e.target.checked) set.delete(name); else set.add(name);
      save({ hiddenWidgets: [...set] });
    };
    box.appendChild(row);
  }
}

// ------------------------------------------------------------------ init
function renderAll() {
  $('courseAccent').checked = s.courseAccent;
  $('countdown').checked = s.countdown;
  $('countdownAssignments').checked = s.countdownAssignments;
  renderCourses();
  renderThemes();
  renderWidgets();
  paintPage();
}

(async () => {
  if (sync) {
    s = await new Promise(r => sync.get(BD_DEFAULTS, r));
    local = await new Promise(r => localStore.get({ courseList: [], courseImages: {}, widgetNames: [] }, r));
  } else {
    // Preview outside the extension: sample data.
    local.courseList = [
      { id: '1', name: 'BUSM-1285-001 - Business Law', code: '30253.202630' },
      { id: '2', name: 'HIST-2252-001 - Hist and Religion in Islam Art', code: '30083.202630' }
    ];
    s.courses = { 1: { color: '#f58025', nick: 'Business Law' }, 2: { color: '#4fa3ff' } };
    local.widgetNames = ['My Courses', 'Tech Essentials', 'Work To Do', 'Land Acknowledgment'];
  }
  renderAll();
  loadIntoBuilder(bdGetTheme(s), s.customThemes && s.customThemes[s.theme] ? s.theme : null);
  if (hasChrome) chrome.storage.onChanged.addListener(async (ch, area) => {
    if (area === 'local' && ('widgetNames' in ch || 'courseList' in ch)) {
      local = await new Promise(r => localStore.get({ courseList: [], courseImages: {}, widgetNames: [] }, r));
      renderCourses(); renderWidgets();
    }
  });
})();
