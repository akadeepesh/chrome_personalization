// Search engines. {q} = URL-encoded query. `suggest` picks the suggestion provider.
export const ENGINES = {
  google: { name: 'Google', search: 'https://www.google.com/search?q={q}', suggest: 'google', bg: '#aaaaaa', fg: '#ffffff' },
  duckduckgo: { name: 'DuckDuckGo', search: 'https://duckduckgo.com/?q={q}', suggest: 'duckduckgo', bg: '#e37151', fg: '#e8e8e8' },
  bing: { name: 'Bing', search: 'https://www.bing.com/search?q={q}', suggest: 'google', bg: 'linear-gradient(#3ab0f1, #2351dd, #40d1da)', fg: '#e8e8e8' },
  brave: { name: 'Brave', search: 'https://search.brave.com/search?q={q}', suggest: 'google', bg: 'linear-gradient(#fb542b, #343546)', fg: '#e8e8e8' },
  ecosia: { name: 'Ecosia', search: 'https://www.ecosia.org/search?q={q}', suggest: 'google', bg: '#2e8b57', fg: '#ffffff' },
  perplexity: { name: 'Perplexity', search: 'https://www.perplexity.ai/search?q={q}', suggest: 'google', bg: '#20808d', fg: '#ffffff' },
  yandex: { name: 'Yandex', search: 'https://ya.ru/search/?text={q}', suggest: 'google', bg: '#fc3f1d', fg: '#000000' },
};

export const AI_DEFAULT_MODELS = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5-mini',
};

/*
 Site fields:
   triggers  words that open the site when typed exactly
   key       single key that opens it while the search box is unfocused
   search    template used by "trigger?term"
   go        template used by "trigger/path"
   {base} = site URL without trailing slash, {q} = your text
   bg / fg   any CSS background / text color for the tile
   icon      built-in icon name (js/icons.js), an image URL, or empty for the site's favicon
*/
const site = (s) => ({ key: '', search: '', go: '', goLabel: '', icon: '', bg: '#444', fg: '#fff', pinned: true, ...s });

export const DEFAULT_SITES = [
  site({ id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com', triggers: ['y', 'yt', 'youtube'], key: 'y', icon: 'youtube',
    search: '{base}/results?search_query={q}', go: 'https://youtu.be/{q}', goLabel: 'video', bg: '#f30002', fg: '#212121' }),
  site({ id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org', triggers: ['t', 'tg', 'telegram'], key: 't', icon: 'telegram',
    go: 'https://t.me/{q}', bg: 'radial-gradient(#29aaed 40%, #25a4e2)' }),
  site({ id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com', triggers: ['w', 'wa', 'whatsapp'], key: 'w', icon: 'whatsApp',
    bg: 'linear-gradient(45deg, #26d347, #58f879)' }),
  site({ id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com', triggers: ['r', 'rd', 'reddit'], key: 'r', icon: 'reddit',
    search: '{base}/search?q={q}', go: '{base}/r/{q}', goLabel: 'subreddit', bg: 'linear-gradient(#f07e23, #f74300)' }),
  site({ id: 'github', name: 'GitHub', url: 'https://github.com', triggers: ['g', 'gh', 'git', 'github'], key: 'g', icon: 'github',
    search: '{base}/search?q={q}', go: '{base}/{q}', goLabel: 'repo or user', bg: '#171515', fg: '#e8e8e8' }),
  site({ id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com', triggers: ['so', 'stack', 'stackoverflow'], icon: 'stackoverflow',
    search: '{base}/search?q={q}', go: '{base}/questions/{q}', goLabel: 'question', bg: 'linear-gradient(#e87922, #ffbe25)', fg: '#212121' }),
  site({ id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', triggers: ['c', 'gpt', 'chatgpt'], key: 'c', icon: 'chatGPT',
    search: '{base}/?q={q}', bg: '#10a37f' }),
  site({ id: 'claude', name: 'Claude', url: 'https://claude.ai', triggers: ['cl', 'claude'],
    search: '{base}/new?q={q}', bg: '#d97757' }),
  site({ id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', triggers: ['gem', 'gemini'], icon: 'bard',
    bg: 'linear-gradient(135deg, #4285f4, #9b72cb, #d96570)' }),
  site({ id: 'translate', name: 'Translate', url: 'https://translate.google.com', triggers: ['tr', 'translate'], icon: 'translate',
    search: '{base}/?text={q}', bg: 'linear-gradient(45deg, #508bed, #4654b4)' }),
  site({ id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com', triggers: ['i', 'ig', 'insta'], key: 'i', icon: 'instagram',
    go: '{base}/{q}', goLabel: 'user', bg: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)' }),
  site({ id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com', triggers: ['s', 'sp', 'spotify'], key: 's', icon: 'spotify',
    search: '{base}/search/{q}', go: '{base}/track/{q}', goLabel: 'track', bg: '#1ccc5b', fg: '#000' }),
  site({ id: 'discord', name: 'Discord', url: 'https://discord.com/app', triggers: ['d', 'dc', 'discord'], key: 'd', icon: 'discord', bg: '#5460e6' }),
  site({ id: 'x', name: 'X', url: 'https://x.com', triggers: ['x', 'tw', 'twitter'], key: 'x',
    search: '{base}/search?q={q}', go: '{base}/{q}', goLabel: 'user', bg: '#000' }),
  site({ id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com', triggers: ['l', 'li', 'linkedin'], key: 'l', icon: 'linkedin',
    search: '{base}/search/results/all/?keywords={q}', bg: '#0077b7' }),
  site({ id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', triggers: ['m', 'gm', 'mail', 'gmail'], key: 'm', icon: 'gmail',
    search: '{base}/mail/u/0/#search/{q}', bg: 'linear-gradient(45deg, #df493b 50%, #e8e8e8)' }),
  site({ id: 'drive', name: 'Drive', url: 'https://drive.google.com', triggers: ['gd', 'drive'], icon: 'gdrive',
    search: '{base}/drive/search?q={q}', bg: 'linear-gradient(70deg, #2684fc, #00ac47, #ffba00)' }),
  site({ id: 'amazon', name: 'Amazon', url: 'https://www.amazon.in', triggers: ['a', 'amz', 'amazon'], key: 'a', icon: 'amazon',
    search: '{base}/s?k={q}', bg: 'linear-gradient(#f29100, #fff 80%)', fg: '#000' }),
  site({ id: 'groww', name: 'Groww', url: 'https://groww.in', triggers: ['gr', 'groww'],
    bg: 'linear-gradient(#5076ee 60%, #86b0bc)' }),
  site({ id: 'classroom', name: 'Classroom', url: 'https://classroom.google.com', triggers: ['gc', 'class'], icon: 'classroom',
    bg: '#d6be09', fg: '#000', pinned: false }),
  site({ id: 'slack', name: 'Slack', url: 'https://app.slack.com', triggers: ['sl', 'slack'], icon: 'slack', bg: '#4a154b', pinned: false }),
];

export const DEFAULT_SETTINGS = {
  version: 2,
  theme: { mode: 'auto', background: '' },
  engine: 'google',
  stealFocus: true,
  animationSpeed: 400,
  chevron: { thickness: 15, size: 20 },
  menu: { rows: 2, columns: 4, clock24: false },
  suggestions: true,
  calculator: true,
  currency: true,
  ai: { enabled: false, provider: 'anthropic', model: AI_DEFAULT_MODELS.anthropic, language: '' },
  sites: DEFAULT_SITES,
};
