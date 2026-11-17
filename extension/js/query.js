import { ENGINES } from './defaults.js';
import { evaluate } from './calc.js';
import { hostname } from './dom.js';

const lower = (s) => String(s).toLowerCase();

export const engineOf = (settings) => ENGINES[settings.engine] || ENGINES.google;

export function engineSearch(settings, q) {
  return engineOf(settings).search.replace('{q}', encodeURIComponent(q));
}

export function fillTemplate(tpl, site, q, kind) {
  const base = site.url.replace(/\/+$/, '');
  // "go" keeps slashes so r/rust/top or user/repo work.
  const enc = kind === 'go' ? q.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(q);
  return tpl.replaceAll('{base}', base).replaceAll('{q}', enc);
}

export function findSite(sites, trigger) {
  const t = lower(trigger);
  return sites.find((s) => s.triggers?.some((x) => lower(x) === t));
}

export function looksLikeUrl(q) {
  if (/\s/.test(q)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(q)) return true;
  return /^(localhost|\d{1,3}(\.\d{1,3}){3}|(?:[a-z0-9-]+\.)+[a-z]{2,})(:\d+)?([/?#]\S*)?$/i.test(q);
}

export function toUrl(q) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) return q;
  return (/^(localhost|\d{1,3}(\.\d{1,3}){3})/i.test(q) ? 'http://' : 'https://') + q;
}

function siteRow(s) {
  const trigger = s.triggers?.[0];
  return {
    type: 'site', site: s, title: s.name, sub: hostname(s.url), url: s.url,
    // Tab turns "yt" into "yt?" so you can search the site straight away.
    complete: trigger && s.search ? `${trigger}?` : undefined,
  };
}

/** Synchronous results. Suggestions, currency and the AI row are added by main.js. */
export function buildResults(input, settings) {
  const q = input.trim();
  if (!q) return [];
  const out = [];

  if (q.startsWith('!')) {
    const question = q.slice(1).trim();
    if (question) out.push({ type: 'ai', title: question, sub: 'Ask AI', query: question });
    return out;
  }

  // trigger?term (site search) or trigger/path (site go)
  const m = q.match(/^([^\s?/]+)\s*([?/])\s*(.*)$/);
  const cmdSite = m && findSite(settings.sites, m[1]);
  if (cmdSite) {
    const kind = m[2] === '?' ? 'search' : 'go';
    const tpl = cmdSite[kind];
    const term = m[3].trim();
    if (tpl) {
      const label = kind === 'search' ? `Search ${cmdSite.name}` : `Go to ${cmdSite.name}${cmdSite.goLabel ? ' ' + cmdSite.goLabel : ''}`;
      out.push(term
        ? { type: 'site', site: cmdSite, title: term, sub: label, url: fillTemplate(tpl, cmdSite, term, kind) }
        : { type: 'site', site: cmdSite, title: cmdSite.name, sub: `${label}: start typing`, url: cmdSite.url });
    }
  }

  const exact = !cmdSite && findSite(settings.sites, q);
  if (exact) out.push(siteRow(exact));

  if (settings.calculator) {
    const r = evaluate(q);
    if (r !== null) out.push({ type: 'calc', title: `= ${r}`, sub: `${q} · Enter to copy`, value: r });
  }

  if (looksLikeUrl(q)) out.push({ type: 'url', title: q, sub: 'Open address', url: toUrl(q) });

  out.push({ type: 'search', title: q, sub: `Search ${engineOf(settings).name}`, url: engineSearch(settings, q), complete: q });

  const lq = lower(q);
  if (lq.length >= 2 && !cmdSite) {
    for (const s of settings.sites) {
      if (s !== exact && (lower(s.name).startsWith(lq) || s.triggers?.some((t) => t.length > 1 && lower(t).startsWith(lq)))) {
        out.push(siteRow(s));
      }
    }
  }
  return out;
}
