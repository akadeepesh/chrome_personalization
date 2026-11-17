import { ICONS } from './icons.js';

const PROPS = new Set(['value', 'checked', 'selected', 'hidden', 'disabled', 'open', 'textContent']);

/** Tiny element builder. Strings become text nodes, so user data is never parsed as HTML. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export const GLYPHS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
  currency: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
};

export function glyph(name, cls = 'icon') {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = GLYPHS[name] || GLYPHS.search;
  return el;
}

/** Built-in SVG > image URL > browser favicon > first letter. */
export function siteIcon(site, cls = 'icon') {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  const icon = (site.icon || '').trim();
  if (icon && Object.hasOwn(ICONS, icon)) {
    el.innerHTML = ICONS[icon]; // bundled, trusted markup
  } else if (/^(https:|data:image\/)/i.test(icon)) {
    el.append(h('img', { src: icon, alt: '' }));
  } else if (globalThis.chrome?.runtime?.id && /^https?:/i.test(site.url || '')) {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', site.url);
    u.searchParams.set('size', '64');
    el.append(h('img', { src: u.href, alt: '' }));
  } else {
    el.textContent = (site.name || '?').charAt(0).toUpperCase();
  }
  return el;
}

export function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Minimal, safe Markdown: escape everything first, then add a few tags. */
export function renderMarkdown(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (s) => s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const html = src.split('```').map((part, i) =>
    i % 2 ? `<pre><code>${esc(part.replace(/^[^\n]*\n/, ''))}</code></pre>` : inline(esc(part)),
  ).join('');
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
}
