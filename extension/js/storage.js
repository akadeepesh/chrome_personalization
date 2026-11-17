import { DEFAULT_SETTINGS } from './defaults.js';

// chrome.storage.local inside the extension; localStorage when the page is opened directly (dev).
const area = globalThis.chrome?.storage?.local;

export async function loadValue(key) {
  if (area) return (await area.get(key))[key];
  const raw = localStorage.getItem('nt:' + key);
  return raw ? JSON.parse(raw) : undefined;
}

export async function saveValue(key, value) {
  if (area) return area.set({ [key]: value });
  localStorage.setItem('nt:' + key, JSON.stringify(value));
}

/** Fill in any fields missing from stored/imported settings. */
export function normalize(s = {}) {
  const d = structuredClone(DEFAULT_SETTINGS);
  return {
    ...d,
    ...s,
    theme: { ...d.theme, ...s.theme },
    ai: { ...d.ai, ...s.ai },
    sites: Array.isArray(s.sites) ? s.sites : d.sites,
    version: d.version,
  };
}

export async function loadSettings() {
  const s = normalize(await loadValue('settings'));
  cacheBoot(s);
  return s;
}

export async function saveSettings(s) {
  await saveValue('settings', s);
  cacheBoot(s);
}

// The API key lives apart from settings so exports never include it.
export async function loadSecret() {
  return (await loadValue('secret')) || { apiKey: '' };
}

export function saveSecret(secret) {
  return saveValue('secret', secret);
}

// Small synchronous copy read by boot.js before first paint.
function cacheBoot(s) {
  localStorage.setItem('nt:boot', JSON.stringify({ mode: s.theme.mode, accent: s.theme.accent, stealFocus: s.stealFocus }));
}
