import { loadSettings, saveSettings, loadSecret, saveSecret } from './storage.js';
import { buildResults, engineOf, engineSearch } from './query.js';
import { parseCurrency, convert } from './currency.js';
import { suggest } from './suggest.js';
import { ask } from './ai.js';
import { h, siteIcon, renderMarkdown, hostname } from './dom.js';
import { openPanel } from './settings.js';
import { createWave } from './wave.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const stage = $('stage');
const chevron = $('chevron');
const query = $('query');
const input = $('q');
const hint = $('hint');
const chips = $('results');
const blob = $('blob');
const aiPanel = $('ai');
const aiBody = $('aiBody');
const aiQuestion = $('aiQuestion');
const menu = $('menu');
const menuBtn = $('menuBtn');
const viewport = $('viewport');
const track = $('track');
const prevBtn = $('prev');
const nextBtn = $('next');
const panel = $('panel');

let settings;
let secret;
let base = [];
let extras = { currency: null, suggestions: [] };
let results = [];
let selected = 0;
let seq = 0;
let fetchCtrl = null;
let aiCtrl = null;
let debounce = 0;
let menuOpen = false;
let page = 0;
let pages = 1;

const speed = () => settings.animationSpeed;
const aiReady = () => settings.ai.enabled && !!secret.apiKey;
const panelOpen = () => panel.classList.contains('open');

// ---------- appearance ----------

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyAppearance(s = settings) {
  const { mode, background } = s.theme;
  root.dataset.theme = mode === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : mode;
  if (background) root.style.setProperty('--bg', background);
  else root.style.removeProperty('--bg');
  root.style.setProperty('--speed', `${s.animationSpeed}ms`);
  root.style.setProperty('--chev-size', `${s.chevron.size}vh`);
  root.style.setProperty('--chev-thick', `${s.chevron.thickness}px`);
  root.style.setProperty('--rows', s.menu.rows);
  root.style.setProperty('--cols', s.menu.columns);
}

// ---------- query & results ----------
// `primary` is what Enter does with nothing selected; it drives the wave.
// The chips underneath are extras: suggestions, calculator, currency, AI.

let primary = null;

function update() {
  const value = input.value;
  const q = value.trim();
  const id = ++seq;
  query.classList.toggle('empty', !value);
  stage.classList.toggle('typing', !!value);
  base = buildResults(value, settings);
  extras = { currency: null, suggestions: [] };
  selected = -1;
  compose(true);

  fetchCtrl?.abort();
  clearTimeout(debounce);
  if (!q || q.startsWith('!')) return;

  fetchCtrl = new AbortController();
  const { signal } = fetchCtrl;
  debounce = setTimeout(() => {
    if (settings.currency) {
      const c = parseCurrency(q);
      if (c) convert(c).then((row) => { if (id === seq && row) { extras.currency = row; compose(); } }).catch(() => {});
    }
    if (settings.suggestions) {
      suggest(q, engineOf(settings).suggest, signal)
        .then((items) => { if (id === seq) { extras.suggestions = items; compose(); } })
        .catch(() => {});
    }
  }, 90);
}

function compose(animate = false) {
  const q = input.value.trim();
  primary = base[0] || null;
  const rows = [];
  if (extras.currency) rows.push(extras.currency);
  for (const r of base) if (r.type === 'calc' || (r.type === 'url' && r !== primary)) rows.push(r);
  const seen = new Set([q.toLowerCase()]);
  for (const s of extras.suggestions) {
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    rows.push({ type: 'suggestion', title: s, url: engineSearch(settings, s), complete: s });
  }
  if (q && !q.startsWith('!') && aiReady()) rows.push({ type: 'ai', title: '✦ ask ai', query: q });
  const prevCount = results.length;
  results = rows;
  if (selected >= rows.length) selected = -1;
  render(animate ? 0 : prevCount); // animate only chips that are new
}

const current = () => (selected >= 0 ? results[selected] : primary);

function render(animateFrom = Infinity) {
  chips.replaceChildren(...results.map((r, i) => h('li', {
    id: `r${i}`,
    role: 'option',
    class: ['chip', i >= animateFrom && 'new', i === selected && 'sel', r.type !== 'calc' && r.type !== 'currency' && 'lower', r.type === 'ai' && 'dim'].filter(Boolean).join(' '),
    'aria-selected': String(i === selected),
    style: { '--i': Math.min(Math.max(0, i - animateFrom), 12) },
    title: r.url || '',
    onmouseenter: () => select(i),
    onmouseleave: () => select(-1),
    onmousedown: (e) => { e.preventDefault(); activate(r, e.button === 1 || e.ctrlKey || e.metaKey); },
  }, r.title)));

  input.setAttribute('aria-expanded', String(results.length > 0));
  if (selected >= 0) input.setAttribute('aria-activedescendant', `r${selected}`);
  else input.removeAttribute('aria-activedescendant');

  hint.textContent = '';
  setTarget(targetFor(current()));
}

function select(i) {
  const n = results.length;
  if (i < -1) i = n - 1;
  if (i >= n) i = -1;
  if (i === selected) return;
  selected = i;
  render();
}

// ---------- wave ----------

const wave = createWave({
  root: blob, canvas: $('waveCanvas'), label: $('waveLabel'),
}, () => speed(), () => settings.chevron.thickness, () => getComputedStyle(root).getPropertyValue('--fg').trim() || '#f2f2f0');

/** What the wave shows for a result: colour, watermark word and an action label. */
function targetFor(r) {
  if (!r) return null;
  const eng = engineOf(settings);
  switch (r.type) {
    case 'site':
      return {
        id: `site:${r.site.id}:${r.kind}`, name: r.site.name, bg: r.site.bg, fg: r.site.fg,
        label: r.kind === 'search' ? 'search' : r.kind === 'go' ? 'go to' : '',
      };
    case 'search':
    case 'suggestion':
      return { id: `engine:${settings.engine}`, name: eng.name, bg: eng.bg, fg: eng.fg, label: 'search' };
    case 'url': {
      const host = hostname(r.url);
      return { id: `url:${host}`, name: host, bg: '#5d5d5b', fg: '#ffffff', label: 'go to' };
    }
    case 'calc':
    case 'currency':
      return { id: `copy:${r.type}`, name: r.type === 'calc' ? 'calculator' : 'currency', bg: '#3f7d5c', fg: '#ffffff', label: 'copy' };
    case 'ai':
      return { id: 'ai', name: 'ask ai', bg: '#d97757', fg: '#ffffff', label: 'ask' };
    default:
      return null;
  }
}

/** The chevron's on-screen geometry, where the wave morph starts and ends. */
function chevronGeometry() {
  const r = chevron.getBoundingClientRect();
  // Path points in the 50×100 viewBox: arms at x=6, tip at x=44, arms span y 6..94.
  return { tipX: r.left + r.width * 0.88, cy: r.top + r.height / 2, armX: r.left + r.width * 0.12, armDy: r.height * 0.44 };
}

let waveSeq = 0;

async function setTarget(target) {
  const id = ++waveSeq;
  const matched = stage.classList.contains('matched');
  if (target) {
    const geom = matched ? null : chevronGeometry();
    stage.classList.add('matched'); // the real chevron hides; the wave outline takes over
    wave.show(target, geom);
    return;
  }
  if (!matched) return;
  const done = await wave.show(null, chevronGeometry());
  if (done && id === waveSeq) stage.classList.remove('matched');
}

function nudge() {
  chevron.classList.remove('nudge');
  void chevron.getBoundingClientRect();
  chevron.classList.add('nudge');
}
chevron.addEventListener('animationend', () => chevron.classList.remove('nudge'));

// ---------- actions ----------

async function activate(r, newTab = false) {
  if (!r) return;
  if (r.type === 'ai') return runAi(r.query);
  if (r.value !== undefined && !r.url) {
    try {
      await navigator.clipboard.writeText(r.value);
      hint.textContent = 'copied to clipboard';
    } catch {
      hint.textContent = 'could not copy';
    }
    return;
  }
  go(r.url, newTab, targetFor(r));
}

let leaving = false;

async function go(url, newTab = false, target = null) {
  if (!url || leaving) return;
  if (newTab) { window.open(url, '_blank', 'noopener'); return; }
  leaving = true;
  if (target && wave.target?.id === target.id) {
    // The wave stretches into a ribbon and floods the screen, then we navigate.
    blob.classList.add('front');
    await wave.launch();
  } else {
    stage.classList.add('launch');
    await new Promise((r) => setTimeout(r, Math.min(speed(), 320)));
  }
  location.assign(url);
}

// Coming back via the Back button restores the page from cache: reset it.
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  leaving = false;
  stage.classList.remove('launch', 'matched');
  wave.reset();
  input.value = '';
  update();
  input.focus();
});

// ---------- AI ----------

async function runAi(question) {
  aiCtrl?.abort();
  aiPanel.hidden = false;
  aiQuestion.textContent = question;
  if (!aiReady()) {
    aiBody.replaceChildren('Quick answers are off. ',
      h('button', { type: 'button', class: 'link', onclick: () => showPanel() }, 'Turn them on in Settings → Query → AI.'));
    return;
  }
  aiCtrl = new AbortController();
  aiBody.textContent = 'Thinking…';
  let text = '';
  try {
    await ask({ ...settings.ai, apiKey: secret.apiKey }, question, (chunk) => {
      text += chunk;
      aiBody.replaceChildren(renderMarkdown(text));
    }, aiCtrl.signal);
    if (!text) aiBody.textContent = 'No answer returned.';
  } catch (e) {
    if (e.name !== 'AbortError') aiBody.textContent = `Error: ${e.message}`;
  }
}

function closeAi() {
  aiCtrl?.abort();
  aiPanel.hidden = true;
}

// ---------- menu ----------

function buildMenu() {
  const per = Math.max(1, settings.menu.rows * settings.menu.columns);
  const pinned = settings.sites.filter((s) => s.pinned);
  pages = Math.max(1, Math.ceil(pinned.length / per));
  const groups = Array.from({ length: pages }, (_, i) => pinned.slice(i * per, (i + 1) * per));
  track.replaceChildren(...groups.map((group) => h('div', { class: 'page' },
    group.map((s) => {
      const bubble = h('span', { class: 'bubble', style: { background: s.bg, color: s.fg } }, siteIcon(s));
      return h('a', {
        class: 'tile', href: s.url, draggable: 'false',
        title: s.triggers?.length ? `${s.name} · ${s.triggers[0]}` : s.name,
        'aria-label': s.name,
      }, bubble, s.key && h('span', { class: 'key' }, s.key));
    }))));
  setPage(Math.min(page, pages - 1));
}

function setPage(p) {
  page = Math.max(0, Math.min(pages - 1, p));
  track.style.transform = `translateX(${-page * 100}%)`;
  prevBtn.disabled = page === 0;
  nextBtn.disabled = page === pages - 1;
  prevBtn.hidden = nextBtn.hidden = pages < 2;
}

function tickClock() {
  const now = new Date();
  const opts = settings.menu.clock24
    ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' };
  const parts = new Intl.DateTimeFormat([], opts).formatToParts(now).filter((p) => p.type !== 'dayPeriod');
  $('clock').textContent = parts.map((p) => p.value).join('').trim();
  const dayFraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  $('progress').style.width = `${(dayFraction * 100).toFixed(2)}%`;
}

function setMenu(open) {
  menuOpen = open;
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open));
  stage.classList.toggle('away', open);
  blob.classList.toggle('off', open);
  if (open) {
    tickClock();
    closeAi();
    input.blur();
  } else {
    input.focus();
  }
}

// drag / swipe paging
let drag = null;
viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  drag = { x: e.clientX, dx: 0, moved: false };
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(drag.dx) > 6) {
    drag.moved = true;
    viewport.classList.add('dragging');
  }
  if (drag.moved) track.style.transform = `translateX(calc(${-page * 100}% + ${drag.dx}px))`;
});
addEventListener('pointerup', () => {
  if (!drag) return;
  const { dx, moved } = drag;
  drag = null;
  viewport.classList.remove('dragging');
  if (moved) {
    const swallowClick = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    viewport.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => viewport.removeEventListener('click', swallowClick, { capture: true }), 0);
  }
  setPage(Math.abs(dx) > 60 ? page + (dx < 0 ? 1 : -1) : page);
});

let wheelLock = 0;
viewport.addEventListener('wheel', (e) => {
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(d) < 10 || Date.now() < wheelLock) return;
  e.preventDefault();
  wheelLock = Date.now() + speed();
  setPage(page + (d > 0 ? 1 : -1));
}, { passive: false });

prevBtn.addEventListener('click', () => setPage(page - 1));
nextBtn.addEventListener('click', () => setPage(page + 1));
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
menu.addEventListener('click', (e) => { if (e.target === menu) setMenu(false); });

// ---------- settings ----------

function showPanel() {
  if (menuOpen) setMenu(false);
  openPanel(panel, settings, secret, {
    preview: (draft) => applyAppearance(draft),
    cancel: () => { applyAppearance(); input.focus(); },
    save: async (next, nextSecret) => {
      settings = next;
      secret = nextSecret;
      await Promise.all([saveSettings(settings), saveSecret(secret)]);
      refreshAll();
      input.focus();
    },
  });
}

$('gearBtn').addEventListener('click', () => (panelOpen() ? null : showPanel()));

// ---------- keyboard ----------

input.addEventListener('input', () => { update(); nudge(); });

input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (!input.value) setMenu(true);
      else select(selected + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      select(selected - 1);
      break;
    case 'Tab': {
      const c = current()?.complete;
      if (c && c !== input.value) { e.preventDefault(); input.value = c; update(); }
      break;
    }
    case 'Enter':
      e.preventDefault();
      if (e.shiftKey) {
        const q = input.value.trim().replace(/^!\s*/, '');
        if (q) runAi(q);
      } else {
        activate(current(), e.ctrlKey || e.metaKey);
      }
      break;
    case 'Escape':
      if (!aiPanel.hidden) closeAi();
      else if (input.value) { input.value = ''; update(); }
      else input.blur();
      break;
  }
});

document.addEventListener('keydown', (e) => {
  if (panelOpen() || e.ctrlKey || e.metaKey || e.altKey) return;

  if (menuOpen) {
    if (e.key === 'Escape' || e.key === 'ArrowUp') { e.preventDefault(); setMenu(false); return; }
    if (e.key === 'ArrowLeft') { setPage(page - 1); return; }
    if (e.key === 'ArrowRight') { setPage(page + 1); return; }
    const site = e.key.length === 1 && settings.sites.find((s) => s.key && s.key === e.key.toLowerCase());
    if (site) { e.preventDefault(); go(site.url, e.shiftKey); }
    return;
  }

  if (e.target === input) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'Escape') { closeAi(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(true); return; }
  if (e.key === '/') { e.preventDefault(); input.focus(); return; }
  if (e.key.length !== 1) return;
  // With the search box unfocused (Esc), single keys open sites.
  const site = settings.sites.find((s) => s.key && s.key === e.key.toLowerCase());
  if (site) { e.preventDefault(); go(site.url, e.shiftKey); } else input.focus();
});

// Clicking empty space puts the cursor back in the search box.
stage.addEventListener('mousedown', (e) => {
  if (e.target === stage || e.target === query) { e.preventDefault(); input.focus(); }
});
$('aiClose').addEventListener('click', closeAi);
darkQuery.addEventListener('change', () => settings.theme.mode === 'auto' && applyAppearance());

globalThis.chrome?.storage?.onChanged?.addListener(async (changes, area) => {
  if (area !== 'local' || !(changes.settings || changes.secret) || panelOpen()) return;
  [settings, secret] = await Promise.all([loadSettings(), loadSecret()]);
  refreshAll();
});

function refreshAll() {
  applyAppearance();
  buildMenu();
  update();
}

// ---------- start ----------

[settings, secret] = await Promise.all([loadSettings(), loadSecret()]);
refreshAll();
setInterval(() => menuOpen && tickClock(), 1000);
input.focus();
