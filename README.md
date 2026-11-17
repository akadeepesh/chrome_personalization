# DC New Tab

A fast, keyboard-first new tab page for Chrome (and other Chromium browsers). Plain HTML, CSS and JavaScript, with no build step and no dependencies.

- **Site shortcuts:** type `yt` and press Enter to open YouTube, `r/rust` to go to a subreddit, `gh?vite` to search GitHub.
- **Search** with your engine of choice, with live suggestions.
- **Calculator:** `2^10 / 4`, `sqrt(2)*pi`. Press Enter to copy the result.
- **Currency:** `100 usd to inr`, using daily rates and no API key.
- **Quick AI answers:** press Shift+Enter, or start with `!`. Uses Claude or OpenAI with your own key.
- **Pinned tiles** with single-key shortcuts, light/dark themes and an accent color.
- **Settings UI:** add, edit and reorder sites, and import/export everything as JSON.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the [`extension/`](extension/) folder.
3. Open a new tab.

There's also a web preview at [akadeepesh.github.io/chrome_personalization](https://akadeepesh.github.io/chrome_personalization/). It keeps settings in `localStorage` and has no search suggestions or favicons, because those need the extension's permissions.

## Keys

| Input | Does |
| --- | --- |
| `yt` + Enter | Open the site with that trigger |
| `yt?lofi` | Search inside the site (its *Search template*) |
| `r/programming` | Go to a path on the site (its *Go template*) |
| `!question`, or Shift+Enter | Ask AI |
| ↑ / ↓, Tab | Move through results, complete the selected one |
| Ctrl/⌘ + Enter, middle-click | Open in a new tab |
| Esc | Close the answer, clear the input, then unfocus it |
| Single key (search box unfocused) | Open the pinned site with that key (Shift for a new tab) |
| `/` | Focus the search box |

## Default shortcuts

Each single-letter key is also a one-letter trigger. Press the key with the search box unfocused, or type the letter and press Enter.

| Key | Site | | Key | Site |
| --- | --- | --- | --- | --- |
| `y` | YouTube | | `i` | Instagram |
| `g` | GitHub | | `x` | X |
| `r` | Reddit | | `l` | LinkedIn |
| `w` | WhatsApp | | `d` | Discord |
| `t` | Telegram | | `s` | Spotify |
| `m` | Gmail | | `a` | Amazon |
| `c` | ChatGPT | | | |

Other sites only have word triggers: `cl` Claude, `gem` Gemini, `so` Stack Overflow, `tr` Translate, `gd` Drive, `gr` Groww, `gc` Classroom, `sl` Slack. You can change any of them in Settings → Sites.

## Customize

Open the ⚙ button in the bottom right. Templates use `{base}` for the site URL and `{q}` for what you typed. A tile icon can be a built-in name (see [`extension/js/icons.js`](extension/js/icons.js)), an `https` image URL, or blank to use the site's favicon. The default sites live in [`extension/js/defaults.js`](extension/js/defaults.js).

## Privacy

Everything is stored locally in `chrome.storage.local`. The page makes network requests only for features you have turned on:

| Feature | Request goes to |
| --- | --- |
| Suggestions | `suggestqueries.google.com` or `duckduckgo.com` |
| Currency | `open.er-api.com` (cached for 12 h) |
| AI | `api.anthropic.com` or `api.openai.com`, with your key |

The API key is never included in exports.

## Layout

```
extension/
  manifest.json      MV3 manifest (new tab override)
  newtab.html
  css/style.css
  js/boot.js         theme before first paint, address-bar focus fix
  js/main.js         search bar, results, keyboard, tiles
  js/query.js        trigger / URL / search parsing
  js/calc.js         safe expression evaluator (no eval)
  js/currency.js     currency conversion
  js/suggest.js      search suggestions
  js/ai.js           streaming Claude / OpenAI answers
  js/settings.js     settings dialog
  js/storage.js      chrome.storage wrapper and defaults merge
  js/defaults.js     engines and default sites
  js/icons.js        bundled SVG icons
  js/dom.js          element helper, icons, safe Markdown
```
