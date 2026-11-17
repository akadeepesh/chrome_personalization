import { loadValue, saveValue } from './storage.js';

// "100 usd to inr", "100usd inr", "2.5 eur in gbp"
const RE = /^\s*(\d+(?:[.,]\d+)?)\s*([a-z]{3})\s*(?:to|in|=|->|>)?\s*([a-z]{3})\s*$/i;
const RATES_URL = 'https://open.er-api.com/v6/latest/USD'; // free, no key, updates daily
const TTL = 12 * 60 * 60 * 1000;

export function parseCurrency(q) {
  const m = q.match(RE);
  if (!m) return null;
  return { amount: parseFloat(m[1].replace(',', '.')), from: m[2].toUpperCase(), to: m[3].toUpperCase() };
}

async function getRates() {
  const cached = await loadValue('rates');
  if (cached && Date.now() - cached.ts < TTL) return cached.rates;
  const res = await fetch(RATES_URL);
  const data = await res.json();
  if (data.result !== 'success') throw new Error('rates unavailable');
  await saveValue('rates', { ts: Date.now(), rates: data.rates });
  return data.rates;
}

/** Resolves to a result row, or null when the codes aren't currencies. */
export async function convert({ amount, from, to }) {
  const rates = await getRates();
  if (!rates[from] || !rates[to] || from === to) return null;
  const value = (amount / rates[from]) * rates[to];
  const rounded = value >= 1 ? value.toFixed(2) : value.toPrecision(3);
  return {
    type: 'currency',
    title: `${Number(rounded).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}`,
    sub: `${amount} ${from} → ${to} · Enter to copy`,
    value: rounded,
  };
}
