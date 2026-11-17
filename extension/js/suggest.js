// Search suggestions.
// Extension: plain fetch (host_permissions allow the cross-origin call).
// Web page: Google's JSONP endpoint via a <script> tag, as the original Chevron did,
// because the suggest endpoints don't send CORS headers.

const inExtension = !!globalThis.chrome?.runtime?.id;

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

export async function suggest(q, provider, signal, limit = 9) {
  let list;
  if (inExtension) {
    const p = PROVIDERS[provider] || PROVIDERS.google;
    const res = await fetch(p.url(q), { signal });
    if (!res.ok) return [];
    list = p.parse(await res.json());
  } else {
    const lang = (navigator.language || 'en').split('-')[0];
    const data = await jsonp(`https://www.google.com/complete/search?client=chrome-omni&hl=${lang}&q=${encodeURIComponent(q)}`, signal);
    list = data?.[1];
  }
  return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, limit) : [];
}

function jsonp(url, signal) {
  return new Promise((resolve, reject) => {
    const cb = `__suggest_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const script = document.createElement('script');
    let finished = false;
    const finish = () => {
      finished = true;
      clearTimeout(timer);
      script.remove();
      // Keep a no-op in place briefly in case the response still arrives.
      window[cb] = () => {};
      setTimeout(() => { delete window[cb]; }, 10000);
    };
    const timer = setTimeout(() => { if (!finished) { finish(); reject(new Error('timeout')); } }, 4000);
    window[cb] = (data) => { if (!finished) { finish(); resolve(data); } };
    script.onerror = () => { if (!finished) { finish(); reject(new Error('failed')); } };
    signal?.addEventListener('abort', () => { if (!finished) { finish(); reject(new DOMException('Aborted', 'AbortError')); } });
    script.src = `${url}&callback=${cb}`;
    document.head.append(script);
  });
}
