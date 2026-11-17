// Streaming quick answers. Raw fetch (no SDK) because this extension has no build step.

const system = (language) =>
  'You are the quick-answer box on a browser new-tab page. Answer directly and briefly: ' +
  'a few sentences or a short list. Use Markdown only for code, bold text and short lists.' +
  (language ? ` Answer in ${language}.` : '') +
  ` Today is ${new Date().toDateString()}.`;

export async function ask(cfg, question, onText, signal) {
  if (!cfg.apiKey) throw new Error('Add an API key in Settings → AI.');
  if (!cfg.model) throw new Error('Set a model in Settings → AI.');
  return cfg.provider === 'openai'
    ? askOpenAI(cfg, question, onText, signal)
    : askAnthropic(cfg, question, onText, signal);
}

async function askAnthropic({ model, apiKey, language }, question, onText, signal) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2026-10-21',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    system: system(language),
    messages: [{ role: 'user', content: question }],
  };
  // Quick answers: keep thinking light. Older models don't accept `effort`.
  if (!/haiku-4|claude-3/.test(model)) body.output_config = { effort: 'low' };
  // Models that support server-side fallback on refusals.
  if (/^claude-(opus-5|fable-5|sonnet-5-5|mythos-5)/.test(model)) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok) throw new Error(await errorText(res));

  await readSSE(res, (data) => {
    if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') onText(data.delta.text);
    else if (data.type === 'message_delta' && data.delta?.stop_reason === 'refusal') onText('\n\n*The model declined to answer this.*');
    else if (data.type === 'error') throw new Error(data.error?.message || 'Stream error');
  });
}

async function askOpenAI({ model, apiKey, language }, question, onText, signal) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: system(language) },
        { role: 'user', content: question },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  await readSSE(res, (data) => {
    const text = data.choices?.[0]?.delta?.content;
    if (text) onText(text);
  });
}

async function readSSE(res, onData) {
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value.replace(/\r/g, '');
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const event = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let data;
        try { data = JSON.parse(payload); } catch { continue; }
        onData(data);
      }
    }
  }
}

async function errorText(res) {
  try {
    const j = await res.json();
    return `${res.status}: ${j.error?.message || res.statusText}`;
  } catch {
    return `${res.status}: ${res.statusText}`;
  }
}
