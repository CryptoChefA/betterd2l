// BetterD2L page features (top frame only): course cards, nicknames + colour
// coding, exam/deadline countdown, and hiding homepage widgets.
(() => {
  if (window !== window.top) return;

  let s = BD_DEFAULTS;
  let local = { courseList: [], courseImages: {}, widgetNames: [] };

  // ---------------------------------------------------------------- utils
  const api = (() => {
    let versions = null;
    async function v(product, fallback) {
      if (!versions) {
        try {
          const list = await fetch('/d2l/api/versions/').then(r => r.json());
          versions = Object.fromEntries(list.map(x => [x.ProductCode, x.LatestVersion]));
        } catch { versions = {}; }
      }
      return versions[product] || fallback;
    }
    async function get(path) {
      const r = await fetch(path, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(r.status + ' ' + path);
      return r.json();
    }
    return {
      async enrollments() {
        const lp = await v('lp', '1.40');
        const out = [];
        let bookmark = '';
        for (let i = 0; i < 10; i++) {
          const page = await get(`/d2l/api/lp/${lp}/enrollments/myenrollments/?orgUnitTypeId=3&isActive=true${bookmark ? '&bookmark=' + bookmark : ''}`);
          for (const it of page.Items) {
            if (it.Access && it.Access.CanAccess) out.push({ id: String(it.OrgUnit.Id), name: it.OrgUnit.Name, code: it.OrgUnit.Code });
          }
          if (!page.PagingInfo || !page.PagingInfo.HasMoreItems) break;
          bookmark = page.PagingInfo.Bookmark;
        }
        return out;
      },
      async quizzes(ou) {
        const le = await v('le', '1.40');
        const out = [];
        let url = `/d2l/api/le/${le}/${ou}/quizzes/`;
        for (let i = 0; i < 5 && url; i++) {
          const page = await get(url);
          out.push(...(page.Objects || []));
          url = page.Next || null;
        }
        return out;
      },
      async folders(ou) {
        const le = await v('le', '1.40');
        return get(`/d2l/api/le/${le}/${ou}/dropbox/folders/`);
      }
    };
  })();

  const loadLocal = () => new Promise(r => chrome.storage.local.get({ courseList: [], courseImages: {}, widgetNames: [], courseListAt: 0 }, r));
  const loadSync = () => new Promise(r => chrome.storage.sync.get(BD_DEFAULTS, r));

  function courseById(id) { return local.courseList.find(c => c.id === String(id)); }
  function cfg(id) { return (s.courses && s.courses[id]) || {}; }
  function displayName(c) { return cfg(c.id).nick || c.name; }

  // Make sure every course has a colour (BetterCanvas-style auto colours).
  async function ensureColors() {
    const courses = { ...(s.courses || {}) };
    let changed = false;
    local.courseList.forEach((c, i) => {
      if (!courses[c.id]) courses[c.id] = {};
      if (!courses[c.id].color) { courses[c.id] = { ...courses[c.id], color: BD_COURSE_COLORS[i % BD_COURSE_COLORS.length] }; changed = true; }
    });
    if (changed) await chrome.storage.sync.set({ courses });
  }

  async function refreshCourses(force) {
    const fresh = Date.now() - (local.courseListAt || 0) < 6 * 3600e3;
    if (fresh && !force && local.courseList.length) return;
    try {
      const list = await api.enrollments();
      local.courseList = list;
      await chrome.storage.local.set({ courseList: list, courseListAt: Date.now() });
      await ensureColors();
    } catch (e) { /* offline / not logged in */ }
  }

  // ------------------------------------------------------ deep DOM watching
  const watched = new WeakSet();
  let timer = 0;
  function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; pass(); }, 60); }
  function watch(root) {
    if (watched.has(root)) return;
    watched.add(root);
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
  }
  // Calls fn(root) for document and every open shadow root.
  function eachRoot(fn) {
    (function walk(root) {
      watch(root);
      fn(root);
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
    })(document);
  }

  // Everything we change is recorded so settings changes can be undone cleanly.
  const textOrig = new Map();   // Text node -> original value
  const styleOrig = new Map();  // Element -> { prop: [value, priority] }
  function setStyle(el, prop, value) {
    if (!styleOrig.has(el)) styleOrig.set(el, {});
    const rec = styleOrig.get(el);
    if (!(prop in rec)) rec[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    el.style.setProperty(prop, value, 'important');
  }
  function revertAll() {
    for (const [n, v] of textOrig) if (n.isConnected) n.nodeValue = v;
    textOrig.clear();
    for (const [el, rec] of styleOrig) for (const [p, [v, pr]] of Object.entries(rec)) {
      if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p);
    }
    styleOrig.clear();
    for (const [img, o] of imgOrig) {
      if (!img.isConnected) continue;
      if (o.srcset) img.setAttribute('srcset', o.srcset);
      img.src = o.src;
    }
    imgOrig.clear();
  }

  // ------------------------------------------------------------ course cards
  const CARD_CSS = `
    d2l-card { border-top: 5px solid var(--bd-cc, transparent); }
    .d2l-organization-name { color: var(--bd-cc-text, inherit); font-weight: 700; }
    .d2l-enrollment-card-image-container { position: relative; }
    .d2l-enrollment-card-image-container::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background: var(--bd-cc-tint, transparent);
    }`;
  const imgOrig = new Map();

  function fixCard(card) {
    const id = card.id.replace('enrollment-card-', '');
    const c = courseById(id);
    const conf = cfg(id);
    const sr = card.shadowRoot;
    if (!sr) return;
    if (!sr.getElementById('bd-card-style')) {
      const st = document.createElement('style');
      st.id = 'bd-card-style';
      st.textContent = CARD_CSS;
      sr.appendChild(st);
    }
    if (conf.color) {
      card.style.setProperty('--bd-cc', conf.color);
      card.style.setProperty('--bd-cc-text', conf.color);
      card.style.setProperty('--bd-cc-tint', conf.color + '22');
    } else {
      ['--bd-cc', '--bd-cc-text', '--bd-cc-tint'].forEach(p => card.style.removeProperty(p));
    }
    const nameEl = sr.querySelector('.d2l-organization-name');
    if (nameEl && c) {
      const want = displayName(c);
      const tn = [...nameEl.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
      if (tn && tn.nodeValue.trim() !== want) {
        if (!textOrig.has(tn)) textOrig.set(tn, tn.nodeValue);
        tn.nodeValue = want;
      }
      nameEl.title = c.name;
    }
    swapImage(sr.querySelector('img.d2l-organization-image-main'), local.courseImages[id]);
  }

  function swapImage(img, custom) {
    if (!img || !custom || img.getAttribute('src') === custom) return;
    if (!imgOrig.has(img)) imgOrig.set(img, { src: img.getAttribute('src') || '', srcset: img.getAttribute('srcset') });
    img.removeAttribute('srcset');
    img.src = custom;
  }

  // Course homepage banner uses the course's custom image too.
  function currentCourse() {
    const m = location.href.match(/[?&]ou=(\d+)/) || location.pathname.match(/\/d2l\/home\/(\d+)/);
    return m ? m[1] : null;
  }
  function fixBanner() {
    const ou = currentCourse();
    if (!ou) return;
    for (const img of document.querySelectorAll('img.d2l-course-banner-image')) swapImage(img, local.courseImages[ou]);
  }

  // ------------------------------------------- nicknames + colours in text
  const SKIP_PARENT = /^(SCRIPT|STYLE|TEXTAREA|INPUT|TITLE|OPTION)$/;
  function courseMatchers() {
    return local.courseList.map(c => {
      const esc = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const code = (c.code || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { c, re: new RegExp(esc + (code ? `(\\s+${code})?` : ''), 'g'), name: c.name };
    }).sort((a, b) => b.name.length - a.name.length);
  }

  function hostOf(node) {
    const r = node.getRootNode();
    return r && r.host ? r.host : null;
  }

  function tagText(root, matchers) {
    if (!root.querySelectorAll) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = n.parentElement;
      if (!p || SKIP_PARENT.test(p.tagName)) continue;
      const v = n.nodeValue;
      if (v.length < 6) continue;
      for (const m of matchers) if (v.includes(m.name)) { hits.push([n, m]); break; }
    }
    for (const [n, m] of hits) {
      const p = n.parentElement;
      if (p.closest('.d2l-offscreen, d2l-tooltip')) continue;
      const host = hostOf(n);
      if (host && /^D2L-MY-COURSES-ENROLLMENT-CARD$/.test(host.tagName)) continue;
      const conf = cfg(m.c.id);
      if (conf.nick) {
        if (!textOrig.has(n)) textOrig.set(n, n.nodeValue);
        m.re.lastIndex = 0;
        n.nodeValue = n.nodeValue.replace(m.re, conf.nick);
      }
      if (!conf.color) continue;
      // Navigation bar titles: rename only, keep them neutral.
      if (p.closest('.d2l-navigation-s-title-container, .d2l-navigation-s-link')) continue;
      setStyle(p, 'color', conf.color);
      setStyle(p, 'font-weight', '700');
      // Work To Do items get a coloured edge.
      if (host && /^D2L-W2D-LIST-ITEM/.test(host.tagName)) {
        setStyle(host, 'border-left', `4px solid ${conf.color}`);
        setStyle(host, 'padding-left', '8px');
      }
      // Calendar list rows (dot + course name) get a coloured edge too.
      const calRow = p.closest('.d2l-le-calendar-dot-info');
      if (calRow) setStyle(calRow, 'border-left', `4px solid ${conf.color}`);
    }
  }

  function renameTitle() {
    for (const c of local.courseList) {
      const nick = cfg(c.id).nick;
      if (nick && document.title.includes(c.name)) document.title = document.title.replace(c.name, nick);
    }
  }

  // ----------------------------------------------------------- widgets
  function widgetName(w) {
    const h = w.querySelector('h2, h3, .d2l-heading');
    return h ? h.textContent.trim() : '';
  }
  let widgetNamesDirty = false;
  function handleWidgets() {
    const hidden = new Set(s.hiddenWidgets || []);
    for (const w of document.querySelectorAll('.d2l-widget')) {
      const name = widgetName(w);
      if (!name) continue;
      if (!local.widgetNames.includes(name)) { local.widgetNames.push(name); widgetNamesDirty = true; }
      if (hidden.has(name)) setStyle(w, 'display', 'none');
    }
    if (widgetNamesDirty) {
      widgetNamesDirty = false;
      chrome.storage.local.set({ widgetNames: local.widgetNames.slice(0, 60) });
    }
  }

  // ---------------------------------------------------------- countdown
  const isHome = /^\/d2l\/home\/?(\d+)?\/?$/.exec(location.pathname);
  let deadlines = null;  // [{ou, kind, name, start, end, url}]

  async function loadDeadlines() {
    const ous = isHome[1] ? [isHome[1]] : local.courseList.map(c => c.id);
    const cacheKey = 'deadlines:' + ous.join(',');
    const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
    if (cached && Date.now() - cached.at < 15 * 60e3) return cached.items;

    const items = [];
    await Promise.all(ous.map(async (ou) => {
      try {
        for (const q of await api.quizzes(ou)) {
          if (q.IsActive === false) continue;
          const end = q.EndDate || q.DueDate;
          if (!end && !q.StartDate) continue;
          items.push({
            ou, kind: /exam|midterm|final|test/i.test(q.Name) ? 'Exam' : 'Quiz', name: q.Name,
            start: q.StartDate, end,
            url: `/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${ou}&qi=${q.QuizId}`
          });
        }
      } catch {}
      try {
        for (const f of await api.folders(ou)) {
          if (f.IsHidden || !f.DueDate) continue;
          items.push({
            ou, kind: 'Assignment', name: f.Name, start: null, end: f.DueDate,
            url: `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${f.Id}&ou=${ou}`
          });
        }
      } catch {}
    }));
    await chrome.storage.local.set({ [cacheKey]: { at: Date.now(), items } });
    return items;
  }

  function rel(ms) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} hr${h === 1 ? '' : 's'}`;
    const d = Math.round(h / 24);
    return `${d} days`;
  }
  const fmt = (d) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const esc = (t) => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function renderCountdown() {
    const anchor = document.querySelector('.d2l-homepage');
    let box = document.getElementById('bd-countdown');
    const items = (deadlines || [])
      .filter(i => s.countdownAssignments || i.kind !== 'Assignment')
      .filter(i => new Date(i.end || i.start) > new Date())
      .sort((a, b) => new Date(a.start || a.end) - new Date(b.start || b.end))
      .slice(0, isHome[1] ? 6 : 8);

    if (!s.countdown || !anchor || !items.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('section');
      box.id = 'bd-countdown';
      anchor.parentNode.insertBefore(box, anchor);
    }
    const now = Date.now();
    const rows = items.map(i => {
      const start = i.start ? new Date(i.start) : null, end = new Date(i.end || i.start);
      let when, ms;
      if (start && start > now) { ms = start - now; when = `${i.kind === 'Assignment' ? 'due' : 'opens'} in ${rel(ms)}`; }
      else if (start && start <= now) { ms = end - now; when = `open now · closes in ${rel(ms)}`; }
      else { ms = end - now; when = `due in ${rel(ms)}`; }
      const urgency = ms < 24 * 3600e3 ? 'urgent' : ms < 3 * 86400e3 ? 'soon' : '';
      const c = courseById(i.ou);
      const color = cfg(i.ou).color || 'var(--bd-accent, #4fa3ff)';
      return `<a class="bd-cd-row" href="${esc(i.url)}" style="--bd-cd-color:${esc(color)}">
        <span class="bd-cd-kind bd-cd-${i.kind.toLowerCase()}">${i.kind}</span>
        <span class="bd-cd-main"><b>${esc(i.name)}</b>
          <small>${!isHome[1] && c ? esc(displayName(c)) + ' · ' : ''}${esc(fmt(start && start > now ? start : end))}</small></span>
        <span class="bd-cd-when ${urgency}">${esc(when)}</span></a>`;
    }).join('');
    box.innerHTML = `<header><span>⏳ Upcoming ${s.countdownAssignments ? 'exams &amp; deadlines' : 'exams &amp; quizzes'}</span></header>${rows}`;
  }

  // -------------------------------------------------------------- main pass
  function pass() {
    const matchers = courseMatchers();
    eachRoot((root) => {
      for (const card of root.querySelectorAll('d2l-my-courses-enrollment-card')) fixCard(card);
      if (matchers.length) tagText(root, matchers);
    });
    fixBanner();
    renameTitle();
    handleWidgets();
  }

  function rerun() { revertAll(); pass(); renderCountdown(); }

  async function init() {
    [s, local] = await Promise.all([loadSync(), loadLocal()]);
    await refreshCourses(false);
    pass();
    if (isHome) {
      deadlines = await loadDeadlines();
      renderCountdown();
      setInterval(renderCountdown, 60e3);
    }
    // Late-rendering components: a few extra sweeps.
    for (const ms of [1000, 3000, 6000]) setTimeout(schedule, ms);
  }

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync') s = await loadSync();
    if (area === 'local') {
      if (!('courseList' in changes || 'courseImages' in changes)) return; // ignore our own caches
      local = await loadLocal();
    }
    rerun();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
