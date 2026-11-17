import { h, siteIcon } from './dom.js';
import { ENGINES, DEFAULT_SETTINGS, AI_DEFAULT_MODELS } from './defaults.js';
import { ICONS } from './icons.js';
import { normalize } from './storage.js';

const TABS = { general: 'General', sites: 'Sites', ai: 'AI', data: 'Data' };

/** Opens the settings dialog on a draft copy; calls onSave(settings, secret) on Save. */
export function openSettings(dialog, settings, secret, onSave, startTab = 'general') {
  let draft = structuredClone(settings);
  const sec = { apiKey: secret.apiKey || '' };
  let tab = startTab;
  let openSiteId = null;

  const status = h('span', { class: 'status', role: 'status' });
  const body = h('div', { class: 'set-body' });
  const nav = h('nav', { class: 'set-tabs' },
    Object.entries(TABS).map(([id, label]) =>
      h('button', { type: 'button', class: 'tab', 'data-tab': id, onclick: () => { tab = id; draw(); } }, label)));

  const setStatus = (msg, isError = false) => { status.textContent = msg; status.classList.toggle('error', isError); };

  // ---- field helpers (bind directly to the draft objects) ----
  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', null, label), input, hint && h('small', null, hint));
  const text = (obj, key, attrs = {}) => h('input', { type: 'text', value: obj[key] ?? '', oninput: (e) => { obj[key] = e.target.value; }, ...attrs });
  const check = (obj, key, label) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !!obj[key], onchange: (e) => { obj[key] = e.target.checked; } }), label);
  const select = (obj, key, options, onchange) => h('select', {
    onchange: (e) => { obj[key] = e.target.value; onchange?.(e.target.value); },
  }, options.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l)));
  const button = (label, onclick, attrs = {}) => h('button', { type: 'button', onclick, ...attrs }, label);

  // ---- views ----
  const views = {
    general: () => h('div', { class: 'stack' },
      field('Search engine', select(draft, 'engine', Object.entries(ENGINES).map(([k, e]) => [k, e.name]))),
      h('div', { class: 'grid' },
        field('Theme', select(draft.theme, 'mode', [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']])),
        field('Accent', h('input', { type: 'color', value: toHex(draft.theme.accent), oninput: (e) => { draft.theme.accent = e.target.value; } }))),
      check(draft, 'showClock', 'Show clock'),
      check(draft, 'showTiles', 'Show pinned site tiles'),
      check(draft, 'suggestions', 'Search suggestions while typing'),
      check(draft, 'calculator', 'Calculator (e.g. 2^10 / 4)'),
      check(draft, 'currency', 'Currency conversion (e.g. 100 usd to inr)'),
      check(draft, 'stealFocus', 'Put the cursor in the search box on open (the address bar then shows the extension URL)'),
    ),

    sites: () => {
      const list = h('div', { class: 'site-list' });
      const redraw = () => list.replaceChildren(...draft.sites.map((s, i) => siteEditor(s, i, redraw)));
      redraw();
      return h('div', { class: 'stack' },
        h('p', { class: 'muted' },
          'Type a trigger and press Enter to open the site. ', h('code', null, 'trigger?term'), ' uses the Search template, ',
          h('code', null, 'trigger/path'), ' uses the Go template. In templates, ', h('code', null, '{base}'),
          ' is the site URL and ', h('code', null, '{q}'), ' is what you typed.'),
        list,
        button('+ Add site', () => {
          const s = { id: crypto.randomUUID(), name: '', url: 'https://', triggers: [], key: '', search: '', go: '', goLabel: '', icon: '', bg: '#444444', fg: '#ffffff', pinned: true };
          draft.sites.push(s);
          openSiteId = s.id;
          redraw();
        }, { class: 'add' }),
        h('datalist', { id: 'icon-names' }, Object.keys(ICONS).map((k) => h('option', { value: k }))),
      );
    },

    ai: () => {
      const modelInput = text(draft.ai, 'model');
      return h('div', { class: 'stack' },
        check(draft.ai, 'enabled', 'Enable quick answers (Shift+Enter, or start the query with !)'),
        h('div', { class: 'grid' },
          field('Provider', select(draft.ai, 'provider', [['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI']], (p) => {
            draft.ai.model = AI_DEFAULT_MODELS[p];
            modelInput.value = draft.ai.model;
          })),
          field('Model', modelInput)),
        field('API key', h('input', {
          type: 'password', value: sec.apiKey, autocomplete: 'off', placeholder: 'Paste your key',
          oninput: (e) => { sec.apiKey = e.target.value.trim(); },
        }), 'Stored only in this browser’s extension storage, sent only to the provider, never exported.'),
        field('Answer language', text(draft.ai, 'language', { placeholder: 'Same as the question' })),
      );
    },

    data: () => {
      const file = h('input', {
        type: 'file', accept: 'application/json,.json', hidden: true,
        onchange: async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            const parsed = JSON.parse(await f.text());
            if (!parsed || !Array.isArray(parsed.sites)) throw new Error('No "sites" list found.');
            draft = normalize(parsed);
            setStatus('Imported. Press Save to keep it.');
          } catch (err) {
            setStatus(`Import failed: ${err.message}`, true);
          }
        },
      });
      return h('div', { class: 'stack' },
        h('p', { class: 'muted' }, 'Export your settings and sites as JSON to back them up or move them to another browser. The API key is not included.'),
        h('div', { class: 'row-buttons' },
          button('Export JSON', () => {
            const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'newtab-settings.json' });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }),
          button('Import JSON', () => file.click()),
          button('Reset to defaults', () => {
            if (!confirm('Replace all settings and sites with the defaults?')) return;
            draft = structuredClone(DEFAULT_SETTINGS);
            setStatus('Defaults restored. Press Save to keep them.');
          }, { class: 'danger' })),
        file,
      );
    },
  };

  function siteEditor(s, i, redraw) {
    const swatch = h('span', { class: 'swatch' });
    const name = h('span', { class: 'site-name' });
    const meta = h('span', { class: 'muted site-meta' });
    const refresh = () => {
      swatch.replaceChildren(siteIcon(s));
      swatch.style.background = s.bg;
      swatch.style.color = s.fg;
      name.textContent = s.name || '(untitled)';
      meta.textContent = [s.triggers?.join(', '), s.key && `key ${s.key}`].filter(Boolean).join(' · ');
    };
    refresh();

    const act = (label, title, fn) => h('button', {
      type: 'button', class: 'icon-btn', title, 'aria-label': title,
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); fn(); },
    }, label);
    const move = (d) => {
      const j = i + d;
      if (j < 0 || j >= draft.sites.length) return;
      [draft.sites[i], draft.sites[j]] = [draft.sites[j], draft.sites[i]];
      redraw();
    };

    const det = h('details', { class: 'site', open: s.id === openSiteId, oninput: refresh, onchange: refresh },
      h('summary', null, swatch, name, meta,
        h('span', { class: 'row-actions' },
          act('↑', 'Move up', () => move(-1)),
          act('↓', 'Move down', () => move(1)),
          act('✕', 'Remove', () => { if (confirm(`Remove ${s.name || 'this site'}?`)) { draft.sites.splice(i, 1); redraw(); } }))),
      h('div', { class: 'grid' },
        field('Name', text(s, 'name')),
        field('URL', text(s, 'url', { type: 'url', placeholder: 'https://…' })),
        field('Triggers', h('input', {
          type: 'text', value: (s.triggers || []).join(', '),
          oninput: (e) => { s.triggers = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); },
        }), 'Comma separated, e.g. y, yt'),
        field('Key', text(s, 'key', { maxlength: 1 }), 'Opens the site while the search box is unfocused'),
        field('Search template', text(s, 'search', { placeholder: '{base}/search?q={q}' })),
        field('Go template', text(s, 'go', { placeholder: '{base}/{q}' })),
        field('Tile background', text(s, 'bg'), 'Any CSS: #hex or a gradient'),
        field('Tile text color', h('input', { type: 'color', value: toHex(s.fg), oninput: (e) => { s.fg = e.target.value; } })),
        field('Icon', text(s, 'icon', { list: 'icon-names', placeholder: 'favicon' }), 'Built-in name, https image URL, or empty for favicon'),
        h('div', { class: 'field' }, check(s, 'pinned', 'Show as tile'))),
    );
    det.addEventListener('toggle', () => { if (det.open) openSiteId = s.id; });
    return det;
  }

  function draw() {
    nav.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    body.replaceChildren(views[tab]());
  }

  function validate() {
    for (const s of draft.sites) {
      const label = s.name || '(untitled site)';
      if (!s.name?.trim()) return 'Every site needs a name.';
      if (!/^https?:\/\/[^\s/]+/i.test(s.url || '')) return `${label}: URL must start with http:// or https://`;
      if (s.key && !/^[a-z0-9]$/i.test(s.key)) return `${label}: key must be a single letter or digit.`;
      s.key = (s.key || '').toLowerCase();
    }
    if (draft.ai.enabled && !sec.apiKey) return 'AI is enabled but has no API key.';
    return null;
  }

  dialog.replaceChildren(h('form', {
    class: 'set', method: 'dialog',
    onsubmit: (e) => {
      e.preventDefault();
      const err = validate();
      if (err) return setStatus(err, true);
      onSave(normalize(draft), sec);
      dialog.close();
    },
  },
  h('header', null, h('h2', null, 'Settings'), nav),
  body,
  h('footer', null, status, button('Cancel', () => dialog.close()), h('button', { type: 'submit', class: 'primary' }, 'Save'))));

  draw();
  dialog.showModal();
}

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c || '')) return c;
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c || '');
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : '#ffffff';
}
