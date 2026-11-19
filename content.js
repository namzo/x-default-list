// X Default Timeline — content script.
//
// Runs in Chrome's isolated world, so it can only see and touch the DOM: it
// cannot patch X's own JavaScript (React internals, history.pushState, etc.).
// Everything here works through DOM selectors, CSS, clicks and DOM/Navigation
// events, which are shared between worlds.
//
// Current X home layout (checked 2026-11-19):
//   [data-testid="primaryColumn"] nav
//     [data-testid="ScrollSnap-prevButtonWrapper"]
//     [role="tablist"][data-testid="ScrollSnap-List"]
//       [role="presentation"] > [role="tab"]  "For you"
//       [role="presentation"] > [role="tab"]  "Following"
//       [role="presentation"] > [role="tab"]  pinned lists / topics…
//     [data-testid="ScrollSnap-nextButtonWrapper"]
// Home's tabs are <div role="tab">. Other pages' tab bars (Explore, profiles)
// use <a role="tab" href>, and the post composer toolbar is a role="tablist"
// with no tabs at all. While X swaps pages, the old page's tab bar can still
// be in the DOM, so we only ever act on a tab bar of <div> tabs.

const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  hideForYou: false,
  hideFollowing: false,
  makeForYouDefault: false,
  makeListDefault: false,
  makeFollowingDefault: false,
  selectedList: ''
};

const STYLE_ID = 'x-tab-selector-css';
// How long to wait for a named pinned list to appear before falling back.
const LIST_WAIT_MS = 8000;
// After choosing the default, keep correcting X if it switches tabs on its own.
const SETTLE_MS = 3000;
// Give up if the tab bar never shows up.
const SESSION_TIMEOUT_MS = 15000;
// Don't click again while X is still applying the previous click
// (clicking an already-selected tab opens X's timeline menu).
const CLICK_COOLDOWN_MS = 700;

let settings = { ...DEFAULT_SETTINGS };
let session = null;

// ---------------------------------------------------------------------------
// Helpers

function isHomePage() {
  const path = window.location.pathname;
  return path === '/home' || path === '/';
}

function hasActiveSettings() {
  return settings.extensionEnabled && (
    settings.hideForYou || settings.hideFollowing ||
    settings.makeForYouDefault || settings.makeListDefault || settings.makeFollowingDefault
  );
}

function getTimelineTablist() {
  const scope = document.querySelector('[data-testid="primaryColumn"]') || document;
  for (const list of scope.querySelectorAll('[role="tablist"]')) {
    if (list.querySelector('div[role="tab"]') && !list.querySelector('a[role="tab"]')) return list;
  }
  return null;
}

function getTabs(tablist) {
  return tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')) : [];
}

function tabLabel(tab) {
  return tab.textContent.trim();
}

function isSelected(tab) {
  return tab.getAttribute('aria-selected') === 'true';
}

function isHiddenIndex(index) {
  return (index === 0 && settings.hideForYou) || (index === 1 && settings.hideFollowing);
}

// ---------------------------------------------------------------------------
// Hiding tabs (pure CSS, so it applies as soon as X renders the tab bar)

function buildCss() {
  const tablist = '[data-testid="primaryColumn"] [role="tablist"]:has(> [role="presentation"] > div[role="tab"])';
  const nav = '[data-testid="primaryColumn"] nav:has(div[role="tab"])';
  const hidden = [];
  if (settings.hideForYou) hidden.push(`${tablist} > [role="presentation"]:nth-child(1)`);
  if (settings.hideFollowing) hidden.push(`${tablist} > [role="presentation"]:nth-child(2)`);
  if (!hidden.length) return '';
  // The scroll arrows misbehave once tabs are hidden, so hide them too.
  hidden.push(
    `${nav} [data-testid="ScrollSnap-prevButtonWrapper"]`,
    `${nav} [data-testid="ScrollSnap-nextButtonWrapper"]`
  );
  return `${hidden.join(',\n')} { display: none !important; }`;
}

function applyCss() {
  const css = settings.extensionEnabled && isHomePage() ? buildCss() : '';
  let style = document.getElementById(STYLE_ID);
  if (!css) {
    if (style) style.remove();
    return;
  }
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

// ---------------------------------------------------------------------------
// Choosing the default tab

function pickDefaultTab(tabs) {
  if (settings.makeListDefault && tabs.length > 2) {
    const pinned = tabs.slice(2);
    return pinned.find(t => tabLabel(t) === settings.selectedList) || pinned[0];
  }
  if (settings.makeFollowingDefault && tabs[1] && !isHiddenIndex(1)) return tabs[1];
  if (settings.makeForYouDefault && tabs[0] && !isHiddenIndex(0)) return tabs[0];
  // No usable default: just make sure a hidden tab isn't the one showing.
  const current = tabs.findIndex(isSelected);
  if (current !== -1 && !isHiddenIndex(current)) return tabs[current];
  return tabs.find((t, i) => !isHiddenIndex(i)) || null;
}

function isWaitingForList(tabs) {
  if (!settings.makeListDefault) return false;
  if (Date.now() - session.startedAt > LIST_WAIT_MS) return false;
  if (tabs.length <= 2) return true;
  return !!settings.selectedList && !tabs.slice(2).some(t => tabLabel(t) === settings.selectedList);
}

function selectTab(tab) {
  if (Date.now() - session.lastClickAt < CLICK_COOLDOWN_MS) return;
  session.lastClickAt = Date.now();
  const scrollY = window.scrollY;
  tab.click();
  if (Math.abs(window.scrollY - scrollY) > 10) window.scrollTo(0, scrollY);
  console.log('[X Default Timeline] Selected tab:', tabLabel(tab));
}

// A "session" runs each time the home page is opened (page load, or an
// in-app navigation to Home that isn't Back/Forward). It waits for the tab
// bar, selects the default tab, then guards it for a short settle period.

function startSession() {
  endSession();
  if (!isHomePage() || !hasActiveSettings()) return;

  session = {
    startedAt: Date.now(),
    appliedAt: 0,
    lastClickAt: 0,
    scheduled: false,
    observer: new MutationObserver(scheduleTick),
    timeout: setTimeout(endSession, SESSION_TIMEOUT_MS)
  };
  session.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected']
  });
  tick();
}

function endSession() {
  if (!session) return;
  session.observer.disconnect();
  clearTimeout(session.timeout);
  session = null;
}

function scheduleTick() {
  if (!session || session.scheduled) return;
  session.scheduled = true;
  setTimeout(() => {
    if (!session) return;
    session.scheduled = false;
    tick();
  }, 50);
}

function tick() {
  if (!session) return;
  if (!isHomePage() || !hasActiveSettings()) return endSession();

  const tabs = getTabs(getTimelineTablist());
  if (tabs.length < 2 || isWaitingForList(tabs)) return;

  const target = pickDefaultTab(tabs);
  if (target && !isSelected(target)) selectTab(target);

  if (!session.appliedAt) {
    session.appliedAt = Date.now();
    clearTimeout(session.timeout);
    session.timeout = setTimeout(endSession, SETTLE_MS);
  }
}

// Once the user picks a tab themselves, stop steering.
function onUserTabInteraction(event) {
  if (!session || !event.isTrusted) return;
  const tab = event.target.closest && event.target.closest('[role="tab"]');
  if (tab && tab.closest('[role="tablist"]') === getTimelineTablist()) endSession();
}
document.addEventListener('click', onUserTabInteraction, true);
document.addEventListener('keydown', onUserTabInteraction, true);

// ---------------------------------------------------------------------------
// Navigation (X is a single-page app)

let lastPath = window.location.pathname;

function onNavigated(navigationType) {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;

  applyCss();
  if (!isHomePage()) return endSession();
  // On Back/Forward X restores the tab you were on; leave it alone.
  if (navigationType === 'traverse') return endSession();
  startSession();
}

if (window.navigation) {
  window.navigation.addEventListener('currententrychange', (event) => {
    onNavigated(event.navigationType);
  });
} else {
  window.addEventListener('popstate', () => onNavigated('traverse'));
  setInterval(() => onNavigated('push'), 1000);
}

// ---------------------------------------------------------------------------
// Settings

function applySettings(newSettings) {
  settings = { ...DEFAULT_SETTINGS, ...newSettings };
  applyCss();
  startSession();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const next = { ...settings };
  for (const key of Object.keys(changes)) next[key] = changes[key].newValue;
  applySettings(next);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLists') {
    const lists = getTabs(getTimelineTablist()).slice(2).map(tabLabel).filter(Boolean);
    sendResponse({ lists });
  }
});

chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);
