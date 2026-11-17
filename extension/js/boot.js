// Classic (blocking) script: runs before CSS paints.
(function () {
  var boot = { mode: 'auto', stealFocus: true };
  try {
    boot = Object.assign(boot, JSON.parse(localStorage.getItem('nt:boot') || '{}'));
  } catch (e) {}

  var root = document.documentElement;
  var mode = boot.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : boot.mode;
  root.dataset.theme = mode;
  if (boot.accent) root.style.setProperty('--accent', boot.accent);

  // Chrome keeps focus in the omnibox on new-tab override pages. Re-navigating the tab
  // to our own URL moves focus into the page so you can type immediately.
  if (boot.stealFocus && location.search !== '?focus' && window.chrome && chrome.tabs) {
    chrome.tabs.update({ url: chrome.runtime.getURL('newtab.html?focus') });
  }
})();
