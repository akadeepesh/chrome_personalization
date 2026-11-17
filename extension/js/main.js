import { loadSettings, saveSettings, loadSecret, saveSecret } from './storage.js';
import { buildResults, engineOf, engineSearch } from './query.js';
import { parseCurrency, convert } from './currency.js';
import { suggest } from './suggest.js';
import { ask } from './ai.js';
import { h, glyph, siteIcon, renderMarkdown } from './dom.js';
import { openSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const input = $('q');
const list = $('results');
const barIcon = $('barIcon');
const tiles = $('tiles');
const clock = $('clock');
const aiPanel = $('ai');
const aiBody = $('aiBody');
const aiQuestion = $('aiQuestion');
const dialog = $('settings');

let settings;
let secret;
let base = [];          // synchronous rows for the current input
let extras = { currency: null, suggestions: [] };
let results = [];
let selected = 0;
let seq = 0;            // guards against stale async results
let fetchCtrl = null;
let aiCtrl = null;
let debounce = 0;

const aiReady = () => settings.ai.enabled && !!secret.apiKey;

// ---------- results ----------

function update() {
  const value = input.value;
  const q = value.trim();
  const id = ++seq;
  base = buildResults(value, settings);
  extras = { currency: null, suggestions: [] };
  selected = 0;
  compose();

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
    // Suggestion endpoints only allow cross-origin calls via extension host permissions.
    if (settings.suggestions && globalThis.chrome?.runtime?.id) {
      suggest(q, engineOf(settings).suggest, signal)
        .then((items) => { if (id === seq) { extras.suggestions = items; compose(); } })
        .catch(() => {});
    }
  }, 120);
}

function compose() {
  const q = input.value.trim();
  const rows = [...base];
  if (extras.currency) {
    const i = rows.findIndex((r) => r.type === 'search');
    rows.splice(i < 0 ? rows.length : i, 0, extras.currency);
  }
  const seen = new Set([q.toLowerCase()]);
  for (const s of extras.suggestions) {
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    rows.push({ type: 'suggestion', title: s, url: engineSearch(settings, s), complete: s });
  }
  if (q && !q.startsWith('!') && aiReady()) rows.push({ type: 'ai', title: q, sub: 'Ask AI · Shift+Enter', query: q });
  results = rows;
  if (selected >= rows.length) selected = 0;
  render();
}

function rowIcon(r) {
  if (r.site) return siteIcon(r.site);
  return glyph({ url: 'globe', calc: 'calc', currency: 'currency', ai: 'ai' }[r.type] || 'search');
}

function render() {
  list.replaceChildren(...results.map((r, i) => h('li', {
    id: `r${i}`, role: 'option', class: i === selected ? 'row sel' : 'row', 'aria-selected': String(i === selected),
    onmousemove: () => { if (selected !== i) select(i); },
    onmousedown: (e) => { e.preventDefault(); activate(r, e.button === 1 || e.ctrlKey || e.metaKey); },
  },
  rowIcon(r),
  h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, r.title), r.sub && h('span', { class: 'row-sub' }, r.sub)),
  i === selected && h('kbd', null, '↵'))));

  list.hidden = results.length === 0;
  input.setAttribute('aria-expanded', String(results.length > 0));
  if (results.length) input.setAttribute('aria-activedescendant', `r${selected}`);
  else input.removeAttribute('aria-activedescendant');

  const cur = results[selected];
  barIcon.replaceChildren(...(cur ? rowIcon(cur).childNodes : glyph('search').childNodes));
}

function select(i) {
  if (!results.length) return;
  selected = (i + results.length) % results.length;
  render();
  $(`r${selected}`)?.scrollIntoView({ block: 'nearest' });
}

async function activate(r, newTab = false) {
  if (!r) return;
  if (r.type === 'ai') return runAi(r.query);
  if (r.value !== undefined && !r.url) {
    try {
      await navigator.clipboard.writeText(r.value);
      r.sub = 'Copied to clipboard';
    } catch {
      r.sub = 'Could not copy';
    }
    return render();
  }
  go(r.url, newTab);
}

function go(url, newTab) {
  if (!url) return;
  if (newTab) window.open(url, '_blank', 'noopener');
  else location.assign(url);
}

// ---------- AI ----------

async function runAi(question) {
  aiCtrl?.abort();
  aiPanel.hidden = false;
  aiQuestion.textContent = question;
  results = [];
  render();
  if (!aiReady()) {
    aiBody.replaceChildren('Quick answers are off. ',
      h('button', { type: 'button', class: 'link', onclick: () => showSettings('ai') }, 'Set them up in Settings → AI.'));
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

// ---------- tiles, clock, theme ----------

function renderTiles() {
  tiles.hidden = !settings.showTiles;
  tiles.replaceChildren(...settings.sites.filter((s) => s.pinned).map((s) => h('a', {
    class: 'tile', href: s.url, title: s.triggers?.length ? `${s.name} — type ${s.triggers[0]}` : s.name,
    style: { background: s.bg, color: s.fg },
  }, siteIcon(s), h('span', { class: 'tile-name' }, s.name), s.key && h('span', { class: 'key' }, s.key))));
}

function renderClock() {
  clock.hidden = !settings.showClock;
  if (!settings.showClock) return;
  const now = new Date();
  clock.replaceChildren(
    h('div', { class: 'time' }, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    h('div', { class: 'date' }, now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })),
  );
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const { mode, accent } = settings.theme;
  document.documentElement.dataset.theme = mode === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : mode;
  document.documentElement.style.setProperty('--accent', accent);
}

function refreshAll() {
  applyTheme();
  renderTiles();
  renderClock();
  update();
}

function showSettings(tab) {
  openSettings(dialog, settings, secret, async (next, nextSecret) => {
    settings = next;
    secret = nextSecret;
    await Promise.all([saveSettings(settings), saveSecret(secret)]);
    refreshAll();
  }, tab);
}

// ---------- keyboard ----------

input.addEventListener('input', update);

input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); select(selected + 1); break;
    case 'ArrowUp': e.preventDefault(); select(selected - 1); break;
    case 'Tab': {
      const c = results[selected]?.complete;
      if (c && c !== input.value) { e.preventDefault(); input.value = c; update(); }
      break;
    }
    case 'Enter': {
      e.preventDefault();
      if (e.shiftKey) {
        const q = input.value.trim().replace(/^!\s*/, '');
        if (q) runAi(q);
      } else {
        activate(results[selected], e.ctrlKey || e.metaKey);
      }
      break;
    }
    case 'Escape':
      if (!aiPanel.hidden) closeAi();
      else if (input.value) { input.value = ''; update(); }
      else input.blur();
      break;
  }
});

input.addEventListener('blur', () => { list.hidden = true; });
input.addEventListener('focus', () => { list.hidden = results.length === 0; });

// Single-key site shortcuts while the search box is unfocused (Shift = new tab).
document.addEventListener('keydown', (e) => {
  if (dialog.open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'Escape') return closeAi();
  if (e.key === '/') { e.preventDefault(); input.focus(); return; }
  if (e.key.length !== 1) return;
  const site = settings.sites.find((s) => s.key && s.key === e.key.toLowerCase());
  if (site) {
    e.preventDefault();
    go(site.url, e.shiftKey);
  } else {
    input.focus(); // the keystroke lands in the search box
  }
});

$('aiClose').addEventListener('click', closeAi);
$('openSettings').addEventListener('click', () => showSettings());
darkQuery.addEventListener('change', () => settings.theme.mode === 'auto' && applyTheme());

// Settings changed in another tab.
globalThis.chrome?.storage?.onChanged?.addListener(async (changes, area) => {
  if (area !== 'local' || !(changes.settings || changes.secret) || dialog.open) return;
  [settings, secret] = await Promise.all([loadSettings(), loadSecret()]);
  refreshAll();
});

// ---------- start ----------

[settings, secret] = await Promise.all([loadSettings(), loadSecret()]);
refreshAll();
setInterval(renderClock, 10_000);
input.focus();
