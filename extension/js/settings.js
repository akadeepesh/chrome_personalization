import { h, siteIcon } from './dom.js';
import { ENGINES, DEFAULT_SETTINGS, AI_DEFAULT_MODELS } from './defaults.js';
import { ICONS } from './icons.js';
import { normalize } from './storage.js';

const CHECK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CARET = '<svg class="caret" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

const svg = (markup) => { const s = h('span', { class: 'icon' }); s.innerHTML = markup; return s; };

/**
 * Slide-in settings panel working on a draft copy.
 * hooks.preview(draft) runs on every change, hooks.save(settings, secret) on ✓, hooks.cancel() on ✕ / Esc.
 */
export function openPanel(panel, settings, secret, hooks) {
  let draft = structuredClone(settings);
  const sec = { apiKey: secret.apiKey || '' };
  const expanded = new Set();

  const status = h('div', { class: 'status', role: 'status' });
  const body = h('div', { class: 'p-body' });
  const setStatus = (msg, isError = false) => { status.textContent = msg; status.classList.toggle('error', isError); };

  // ---------- controls (bound straight to the draft) ----------
  const prow = (label, control) => h('div', { class: 'prow' }, h('span', null, label), control);
  const toggle = (obj, key) => h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked: !!obj[key], onchange: (e) => { obj[key] = e.target.checked; } }), h('span'));
  const num = (obj, key, unit, min, max) => h('label', { class: 'num' },
    h('input', {
      type: 'number', value: obj[key], min, max,
      oninput: (e) => {
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v)) obj[key] = Math.min(max, Math.max(min, v));
      },
    }),
    unit && h('small', null, unit));
  const select = (obj, key, options, onchange) => h('select', {
    class: 'ctl', onchange: (e) => { obj[key] = e.target.value; onchange?.(e.target.value); },
  }, options.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l)));
  const text = (obj, key, attrs = {}) => h('input', {
    type: 'text', class: 'ctl', value: obj[key] ?? '', oninput: (e) => { obj[key] = e.target.value; }, ...attrs,
  });
  const field = (label, control, note) => h('label', { class: 'field' }, h('span', null, label), control, note && h('small', null, note));

  function expand(id, title, build, { headClass = '', headExtra = null } = {}) {
    const wrap = h('div', { class: expanded.has(id) ? 'exp open' : 'exp' });
    const bodyEl = h('div', { class: 'exp-body', hidden: !expanded.has(id) });
    if (expanded.has(id)) bodyEl.append(...[build()].flat());
    const head = h('div', {
      class: `exp-head ${headClass}`, role: 'button', tabindex: '0', 'aria-expanded': String(expanded.has(id)),
      onclick: () => flip(),
      onkeydown: (e) => { if (e.target === head && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flip(); } },
    }, title, headExtra, svg(CARET));
    function flip() {
      const open = !expanded.has(id);
      if (open) { expanded.add(id); bodyEl.replaceChildren(...[build()].flat()); } else expanded.delete(id);
      wrap.classList.toggle('open', open);
      bodyEl.hidden = !open;
      head.setAttribute('aria-expanded', String(open));
    }
    wrap.append(head, bodyEl);
    return wrap;
  }

  // ---------- sections ----------
  const section = (title, ...rows) => [h('div', { class: 'p-sec' }, title), h('div', { class: 'group' }, rows)];

  function aiRows() {
    const model = text(draft.ai, 'model');
    return [
      prow('Quick answers', toggle(draft.ai, 'enabled')),
      h('p', { class: 'note' }, 'Shift + Enter, or start with !, asks the model. Your key stays in this browser and goes only to the provider.'),
      prow('Provider', select(draft.ai, 'provider', [['anthropic', 'Anthropic'], ['openai', 'OpenAI']], (p) => {
        draft.ai.model = AI_DEFAULT_MODELS[p];
        model.value = draft.ai.model;
      })),
      prow('Model', model),
      prow('API key', h('input', {
        type: 'password', class: 'ctl', value: sec.apiKey, autocomplete: 'off', placeholder: 'paste key',
        oninput: (e) => { sec.apiKey = e.target.value.trim(); },
      })),
      prow('Language', text(draft.ai, 'language', { placeholder: 'auto' })),
    ];
  }

  function siteItem(s, i, redraw) {
    const swatch = h('span', { class: 'swatch' });
    const name = h('b');
    const refresh = () => {
      swatch.replaceChildren(siteIcon(s));
      swatch.style.background = s.bg;
      swatch.style.color = s.fg;
      name.textContent = s.name || 'untitled';
    };
    refresh();
    const mini = (label, title, fn) => h('button', {
      type: 'button', class: 'mini', title, 'aria-label': title,
      onclick: (e) => { e.stopPropagation(); fn(); },
    }, label);
    const move = (d) => {
      const j = i + d;
      if (j < 0 || j >= draft.sites.length) return;
      [draft.sites[i], draft.sites[j]] = [draft.sites[j], draft.sites[i]];
      redraw();
    };
    const label = h('span', { class: 'label' }, swatch, name);
    const actions = [
      mini('↑', 'Move up', () => move(-1)),
      mini('↓', 'Move down', () => move(1)),
      mini('✕', 'Remove', () => { if (confirm(`Remove ${s.name || 'this site'}?`)) { draft.sites.splice(i, 1); redraw(); } }),
    ];
    const item = expand(`site:${s.id}`, label, () => [
      field('Name', text(s, 'name')),
      field('URL', text(s, 'url', { type: 'url', placeholder: 'https://…' })),
      field('Triggers', h('input', {
        type: 'text', class: 'ctl', value: (s.triggers || []).join(', '),
        oninput: (e) => { s.triggers = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); },
      }), 'Comma separated. Type one and press Enter.'),
      field('Key', text(s, 'key', { maxlength: 1 }), 'Opens it from the menu, or with the search box unfocused.'),
      field('Search template', text(s, 'search', { placeholder: '{base}/search?q={q}' }), 'Used by trigger?term'),
      field('Go template', text(s, 'go', { placeholder: '{base}/{q}' }), 'Used by trigger/path'),
      field('Color', text(s, 'bg'), 'Any CSS background: #hex or a gradient'),
      field('Text color', h('input', { type: 'color', class: 'ctl', value: toHex(s.fg), oninput: (e) => { s.fg = e.target.value; } })),
      field('Icon', text(s, 'icon', { list: 'icon-names', placeholder: 'favicon' }), 'Built-in name, https image URL, or empty for favicon'),
      prow('Show in menu', toggle(s, 'pinned')),
    ], { headClass: 'site-head', headExtra: actions });
    item.addEventListener('input', refresh);
    item.addEventListener('change', refresh);
    return item;
  }

  function sitesBody() {
    const list = h('div');
    const redraw = () => list.replaceChildren(...draft.sites.map((s, i) => siteItem(s, i, redraw)));
    redraw();
    return [
      h('p', { class: 'note' }, 'In templates, {base} is the site URL and {q} is what you typed.'),
      list,
      h('button', {
        type: 'button', class: 'add',
        onclick: () => {
          const s = { id: crypto.randomUUID(), name: '', url: 'https://', triggers: [], key: '', search: '', go: '', goLabel: '', icon: '', bg: '#444444', fg: '#ffffff', pinned: true };
          draft.sites.push(s);
          expanded.add(`site:${s.id}`);
          redraw();
        },
      }, '+ Add site'),
      h('datalist', { id: 'icon-names' }, Object.keys(ICONS).map((k) => h('option', { value: k }))),
    ];
  }

  function draw() {
    body.replaceChildren(...[
      section('General',
        prow('Search engine', select(draft, 'engine', Object.entries(ENGINES).map(([k, e]) => [k, e.name]))),
        prow('Focus on open', toggle(draft, 'stealFocus')),
        prow('Animation speed', num(draft, 'animationSpeed', 'ms', 0, 2000))),
      section('Appearance',
        prow('Color scheme', select(draft.theme, 'mode', [['auto', 'auto'], ['dark', 'dark'], ['light', 'light']])),
        prow('Background', h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
          h('input', { type: 'color', class: 'ctl', value: toHex(draft.theme.background || '#212220'), oninput: (e) => { draft.theme.background = e.target.value; } }),
          h('button', { type: 'button', class: 'mini', title: 'Use theme default', onclick: () => { draft.theme.background = ''; hooks.preview(draft); } }, '↺')))),
      section('Chevron',
        prow('Thickness', num(draft.chevron, 'thickness', 'px', 1, 60)),
        prow('Size', num(draft.chevron, 'size', '%', 5, 60))),
      section('Query',
        prow('Suggestions', toggle(draft, 'suggestions')),
        prow('Calculator', toggle(draft, 'calculator')),
        prow('Currency', toggle(draft, 'currency')),
        expand('ai', 'AI', aiRows)),
      section('Menu',
        prow('Rows', num(draft.menu, 'rows', '', 1, 6)),
        prow('Columns', num(draft.menu, 'columns', '', 1, 10)),
        prow('24-hour clock', toggle(draft.menu, 'clock24'))),
      section('Sites', expand('sites', `Sites (${draft.sites.length})`, sitesBody)),
    ].flat());
  }

  // ---------- data ----------
  const file = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const parsed = JSON.parse(await f.text());
        if (!parsed || !Array.isArray(parsed.sites)) throw new Error('no "sites" list found');
        draft = normalize(parsed);
        draw();
        hooks.preview(draft);
        setStatus('Imported. Press ✓ to keep it.');
      } catch (err) {
        setStatus(`Import failed: ${err.message}`, true);
      }
    },
  });

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'newtab-settings.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('Exported (without the API key).');
  }

  function reset() {
    if (!confirm('Replace all settings and sites with the defaults?')) return;
    draft = structuredClone(DEFAULT_SETTINGS);
    draw();
    hooks.preview(draft);
    setStatus('Defaults restored. Press ✓ to keep them.');
  }

  // ---------- save / close ----------
  function validate() {
    for (const s of draft.sites) {
      const label = s.name || 'A site';
      if (!s.name?.trim()) return 'Every site needs a name.';
      if (!/^https?:\/\/[^\s/]+/i.test(s.url || '')) return `${label}: URL must start with http:// or https://`;
      if (s.key && !/^[a-z0-9]$/i.test(s.key)) return `${label}: key must be one letter or digit.`;
      s.key = (s.key || '').toLowerCase();
    }
    if (draft.ai.enabled && !sec.apiKey) return 'AI is on but has no API key.';
    return null;
  }

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.onkeydown = null;
  }

  function cancel() {
    close();
    hooks.cancel();
  }

  function save() {
    const err = validate();
    if (err) return setStatus(err, true);
    close();
    hooks.save(normalize(draft), sec);
  }

  const ok = h('button', { type: 'button', class: 'sq ok', 'aria-label': 'Save', title: 'Save', onclick: save });
  ok.innerHTML = CHECK;
  const no = h('button', { type: 'button', class: 'sq no', 'aria-label': 'Close without saving', title: 'Cancel', onclick: cancel });
  no.innerHTML = CROSS;

  panel.replaceChildren(
    h('header', { class: 'p-head' }, ok, h('h2', null, 'Settings'), no),
    body,
    h('footer', { class: 'p-foot' }, status,
      h('div', { class: 'p-actions' },
        h('button', { type: 'button', onclick: exportJson }, 'Export'),
        h('button', { type: 'button', onclick: () => file.click() }, 'Import'),
        h('button', { type: 'button', class: 'danger', onclick: reset }, 'Reset settings')),
      file),
  );

  const onChange = () => hooks.preview(draft);
  body.oninput = onChange;
  body.onchange = onChange;
  panel.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  };

  draw();
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('open');
  ok.focus({ preventScroll: true });
}

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c || '')) return c;
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c || '');
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : '#ffffff';
}
