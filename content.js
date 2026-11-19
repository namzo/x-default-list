// X Default Timeline — content script.
//
// Runs in Chrome's isolated world from document_start, so it can only see and
// touch the DOM: it cannot patch X's own JavaScript (React internals,
// history.pushState, etc.). Everything here works through DOM selectors, CSS,
// clicks and DOM/Navigation events, which are shared between worlds.
//
// Current X home layout (checked 2026-11-19):
//   [data-testid="primaryColumn"]
//     nav
//       [data-testid="ScrollSnap-prevButtonWrapper"]
//       [role="tablist"][data-testid="ScrollSnap-List"]
//         [role="presentation"] > div[role="tab"]  "For you"
//         [role="presentation"] > div[role="tab"]  "Following"
//         [role="presentation"] > div[role="tab"]  pinned lists / topics…
//       [data-testid="ScrollSnap-nextButtonWrapper"]
//     section[role="region"]  the posts
// Lists you haven't pinned aren't on Home at all. The extension learns them
// from two pages (checked 2026-11-19):
//   /<username>/lists  rows are [data-testid="listCell"]; your own lists have a
//                      [data-testid="list-icon-button"] (pin), suggestions don't.
//                      Rows carry no list ID.
//   /i/lists/<id>      the list's own page; its name is the first <h2>.
// If your default is an unpinned list, opening X fresh goes to its page instead.
//
// Home's tabs are <div role="tab">. Other pages' tab bars (Explore, profiles)
// use <a role="tab" href>, and the post composer toolbar is a role="tablist"
// with no tabs at all. While X swaps pages, the old page's tab bar can still
// be in the DOM, so we only ever act on a tab bar of <div> tabs.
//
// test.html loads this file with a stand-in for the chrome.* APIs and a copy
// of the markup above; open it to check changes without an X account.

const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  hideForYou: false,
  hideFollowing: false,
  makeForYouDefault: false,
  makeListDefault: false,
  makeFollowingDefault: false,
  selectedList: '',
  // Set only when the chosen list isn't pinned: its ID, for /i/lists/<id>.
  selectedListId: ''
};

const STYLE_ID = 'x-tab-selector-css';
// Class on <html> that hides the tab bar and posts until the default tab is
// selected, so neither the wrong tab nor its posts flash up first. X only
// remembers For you / Following (in IndexedDB), never a list, so with a list
// default X always draws one of those first.
const PENDING_CLASS = 'xdl-pending';
// Never keep the posts hidden longer than this.
const PENDING_MAX_MS = 2500;
// How long to wait for a named pinned list to appear before falling back.
const LIST_WAIT_MS = 8000;
// After choosing the default, keep correcting X if it switches tabs on its own.
const SETTLE_MS = 3000;
// Give up if the tab bar never shows up (and tell the popup).
const SESSION_TIMEOUT_MS = 15000;
// Don't click again while X is still applying the previous click
// (clicking an already-selected tab opens X's timeline menu).
const CLICK_COOLDOWN_MS = 700;

// Remember at most this many lists you've opened.
const MAX_KNOWN_LISTS = 100;
// How long to watch a Lists page or list page for its content.
const LIST_PAGE_WATCH_MS = 6000;

// Your default applies when you open X fresh (new tab, bookmark, typed
// address), once. Reloading, Back/Forward and the Home link keep whichever
// tab you're on, which X itself remembers. Switching tabs on those would
// undo your own choice and make the page jump.
const openedFresh = (() => {
  const entry = performance.getEntriesByType('navigation')[0];
  return !entry || entry.type === 'navigate';
})();
let defaultUsed = false;

let settings = { ...DEFAULT_SETTINGS };
let session = null;
let pinnedNames = []; // pinned tab names, from the last time Home was seen
let savedPinned = null; // JSON of the pinned tab names last saved

// ---------------------------------------------------------------------------
// Helpers

function isHomePage() {
  const path = window.location.pathname;
  return path === '/home' || path === '/';
}

// The default is a list that isn't pinned, so it opens on its own page
// rather than as a Home tab. If you've since pinned it, use the tab.
function isUnpinnedListDefault() {
  return settings.makeListDefault && /^\d+$/.test(settings.selectedListId) &&
    !pinnedNames.includes(settings.selectedList);
}

// The default is one of the Home tabs.
function hasTabDefault() {
  return settings.makeForYouDefault || settings.makeFollowingDefault ||
    (settings.makeListDefault && !isUnpinnedListDefault());
}

function hasActiveSettings() {
  return settings.extensionEnabled && (settings.hideForYou || settings.hideFollowing || hasTabDefault());
}

// Same rule as the default tab, so Home is always one click away.
function shouldOpenUnpinnedList() {
  return openedFresh && settings.extensionEnabled && isUnpinnedListDefault() && isHomePage();
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
// Status for the popup (chrome.storage.local, per device)

function savePinned(tabs) {
  const pinned = tabs.slice(2).map(tabLabel).filter(Boolean);
  const json = JSON.stringify(pinned);
  if (json === savedPinned) return;
  savedPinned = json;
  pinnedNames = pinned;
  chrome.storage.local.set({ pinnedTimelines: pinned });
}

function saveLayoutStatus(ok) {
  chrome.storage.local.set({ layout: { ok, checkedAt: Date.now() } });
}

// ---------------------------------------------------------------------------
// CSS: hidden tabs, and hiding the posts while the default is being chosen

function buildCss() {
  const tablist = '[data-testid="primaryColumn"] [role="tablist"]:has(> [role="presentation"] > div[role="tab"])';
  const nav = '[data-testid="primaryColumn"] nav:has(div[role="tab"])';
  const rules = [
    `html.${PENDING_CLASS} ${nav},
     html.${PENDING_CLASS} [data-testid="primaryColumn"] section[role="region"] { visibility: hidden !important; }`
  ];
  const hidden = [];
  if (settings.hideForYou) hidden.push(`${tablist} > [role="presentation"]:nth-child(1)`);
  if (settings.hideFollowing) hidden.push(`${tablist} > [role="presentation"]:nth-child(2)`);
  if (hidden.length) {
    // The scroll arrows misbehave once tabs are hidden, so hide them too.
    hidden.push(
      `${nav} [data-testid="ScrollSnap-prevButtonWrapper"]`,
      `${nav} [data-testid="ScrollSnap-nextButtonWrapper"]`
    );
    rules.push(`${hidden.join(',\n')} { display: none !important; }`);
  }
  return rules.join('\n');
}

function applyCss() {
  const css = hasActiveSettings() && isHomePage() ? buildCss() : '';
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

function setPending(on) {
  document.documentElement.classList.toggle(PENDING_CLASS, on);
}

// ---------------------------------------------------------------------------
// Choosing the default tab

function pickDefaultTab(tabs) {
  if (session.applyDefault) {
    if (settings.makeListDefault && !isUnpinnedListDefault() && tabs.length > 2) {
      const pinned = tabs.slice(2);
      return pinned.find(t => tabLabel(t) === settings.selectedList) || pinned[0];
    }
    if (settings.makeFollowingDefault && tabs[1] && !isHiddenIndex(1)) return tabs[1];
    if (settings.makeForYouDefault && tabs[0] && !isHiddenIndex(0)) return tabs[0];
  }
  // Otherwise keep the tab you're on, unless it's one you've hidden.
  const current = tabs.findIndex(isSelected);
  if (current !== -1 && !isHiddenIndex(current)) return tabs[current];
  return tabs.find((t, i) => !isHiddenIndex(i)) || null;
}

function isWaitingForList(tabs) {
  if (!session.applyDefault || !settings.makeListDefault || isUnpinnedListDefault()) return false;
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

// A "session" runs each time Home is shown. It waits for the tab bar, then
// either selects your default (applyDefault: the first Home visit after
// opening X fresh, or right after you change the setting) and guards it for a
// short settle period, or just moves you off a tab you've hidden.

function startSession(forceDefault) {
  endSession();
  if (!isHomePage() || !hasActiveSettings()) return;
  const applyDefault = hasTabDefault() && (forceDefault || (openedFresh && !defaultUsed));
  if (!applyDefault && !settings.hideForYou && !settings.hideFollowing) return;
  if (applyDefault) defaultUsed = true;

  session = {
    applyDefault,
    startedAt: Date.now(),
    appliedAt: 0,
    lastClickAt: 0,
    scheduled: false,
    observer: new MutationObserver(scheduleTick),
    timeout: setTimeout(onSessionTimeout, SESSION_TIMEOUT_MS),
    pendingTimeout: null,
    // Re-check when the wait for a named list runs out, even if the page is idle.
    listTimeout: applyDefault && settings.makeListDefault && !isUnpinnedListDefault() ? setTimeout(scheduleTick, LIST_WAIT_MS + 10) : null
  };
  if (applyDefault) {
    setPending(true);
    session.pendingTimeout = setTimeout(() => setPending(false), PENDING_MAX_MS);
  }
  // At document_start there is no <body> yet, so watch the whole document.
  session.observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected']
  });
  tick();
}

function endSession() {
  setPending(false);
  if (!session) return;
  if (session.appliedAt && isHomePage()) {
    const tabs = getTabs(getTimelineTablist());
    if (tabs.length > 2 || (tabs.length === 2 && Date.now() - session.startedAt > SETTLE_MS)) savePinned(tabs);
  }
  session.observer.disconnect();
  clearTimeout(session.timeout);
  clearTimeout(session.pendingTimeout);
  clearTimeout(session.listTimeout);
  session = null;
}

function onSessionTimeout() {
  // The tab bar never appeared. Only blame X's layout if the signed-in app
  // (which has a primary column) actually loaded.
  if (session && !session.appliedAt && document.querySelector('[data-testid="primaryColumn"]')) {
    saveLayoutStatus(false);
    console.warn('[X Default Timeline] Could not find the Home tabs. X may have changed its layout.');
  }
  endSession();
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
  if (tabs.length < 2) return;
  // X draws For you and Following before your pinned tabs, so two tabs
  // doesn't mean "nothing pinned" yet; endSession saves the final answer.
  if (tabs.length > 2) savePinned(tabs);
  if (isWaitingForList(tabs)) return;

  const target = pickDefaultTab(tabs);
  if (target && !isSelected(target)) selectTab(target);
  if (!target || isSelected(target)) setPending(false);

  if (!session.appliedAt) {
    session.appliedAt = Date.now();
    saveLayoutStatus(true);
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
// Learning your lists, so the popup can offer ones that aren't pinned

const LIST_PAGE = /^\/i\/lists\/(\d+)$/;
const LISTS_INDEX = /^\/[A-Za-z0-9_]{1,15}\/lists$/;
let pageWatch = null;

function stopWatchingListPage() {
  if (!pageWatch) return;
  pageWatch.observer.disconnect();
  clearTimeout(pageWatch.debounce);
  clearTimeout(pageWatch.timeout);
  pageWatch = null;
}

function watchListPages() {
  stopWatchingListPage();
  if (!settings.extensionEnabled) return;
  const path = window.location.pathname;
  const listMatch = path.match(LIST_PAGE);
  if (!listMatch && !LISTS_INDEX.test(path)) return;

  const yourLists = new Set(); // collected over this visit (rows load lazily)
  const check = () => {
    if (window.location.pathname !== path) return stopWatchingListPage();
    if (listMatch) recordListPage(listMatch[1]); else recordYourLists(yourLists);
  };
  // Re-check once the page settles, so a heading left over from the
  // previous page is replaced by the real one.
  const watch = {
    observer: new MutationObserver(() => {
      clearTimeout(watch.debounce);
      watch.debounce = setTimeout(check, 300);
    }),
    debounce: null,
    timeout: setTimeout(() => { check(); stopWatchingListPage(); }, LIST_PAGE_WATCH_MS)
  };
  pageWatch = watch;
  watch.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  check();
}

function recordListPage(id) {
  const heading = document.querySelector('[data-testid="primaryColumn"] h2');
  const name = heading && heading.textContent.trim();
  if (!name) return;
  chrome.storage.local.get({ knownLists: {} }, (items) => {
    const known = items.knownLists || {};
    if (known[id] === name) return;
    delete known[id]; // re-insert so the most recent is last
    known[id] = name;
    const ids = Object.keys(known);
    while (ids.length > MAX_KNOWN_LISTS) delete known[ids.shift()];
    chrome.storage.local.set({ knownLists: known });
  });
}

function recordYourLists(collected) {
  const before = collected.size;
  for (const cell of document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="listCell"]')) {
    if (!cell.querySelector('[data-testid="list-icon-button"]')) continue; // a suggestion
    const name = cell.innerText.split('\n')[0].trim();
    if (name) collected.add(name);
  }
  if (collected.size !== before) chrome.storage.local.set({ yourLists: Array.from(collected) });
}

// ---------------------------------------------------------------------------
// Navigation (X is a single-page app)

let lastPath = window.location.pathname;

function onNavigated(navigationType) {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;

  watchListPages();
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

// forceDefault: you've just changed the setting, so show it straight away.
function applySettings(newSettings, forceDefault) {
  settings = { ...DEFAULT_SETTINGS, ...newSettings };
  applyCss();
  startSession(forceDefault);
  watchListPages();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const next = { ...settings };
  for (const key of Object.keys(changes)) next[key] = changes[key].newValue;
  applySettings(next, true);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLists') {
    const tabs = getTabs(getTimelineTablist());
    if (tabs.length >= 2) savePinned(tabs);
    sendResponse({ found: tabs.length >= 2, lists: tabs.slice(2).map(tabLabel).filter(Boolean) });
  }
});

chrome.storage.local.get({ pinnedTimelines: [] }, (local) => {
  if (Array.isArray(local.pinnedTimelines)) {
    pinnedNames = local.pinnedTimelines;
    savedPinned = JSON.stringify(pinnedNames);
  }
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    settings = { ...DEFAULT_SETTINGS, ...items };
    if (shouldOpenUnpinnedList()) {
      window.location.replace('/i/lists/' + settings.selectedListId);
      return;
    }
    applySettings(items);
  });
});
