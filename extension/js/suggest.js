// Plain fetch; the extension's host_permissions make these cross-origin calls allowed.
const PROVIDERS = {
  google: {
    url: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`,
    parse: (d) => d[1],
  },
  duckduckgo: {
    url: (q) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(q)}`,
    parse: (d) => d[1],
  },
};

export async function suggest(q, provider, signal, limit = 6) {
  const p = PROVIDERS[provider] || PROVIDERS.google;
  const res = await fetch(p.url(q), { signal });
  if (!res.ok) return [];
  const list = p.parse(await res.json());
  return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, limit) : [];
}
