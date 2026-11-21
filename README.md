# X Default Timeline

A Chrome extension that chooses which X Home tab opens by default (For you, Following or a pinned list or topic) and can hide the tabs you don't use.

## Features

- **Default timeline**: For you, Following, or any list or topic you've pinned to your Home tabs
- **Lists you haven't pinned**: choose one and opening X takes you straight to that list's page (the Home link still shows Home)
- **Hide "For you"** and/or **Hide "Following"**
- **No flash of the wrong timeline**: the tab bar and posts stay hidden for a moment (at most 2.5 seconds) until your default tab is selected, so you never see X's last-used tab first
- **Keeps your place**: the default applies when you open X fresh (new tab, bookmark, typing x.com). After that, reloading, Back/Forward and the Home link keep whichever tab you're on, so the page doesn't jump
- **Warns you if X changes its layout**: the popup says so when it couldn't find the Home tabs
- **Remembers your pinned lists**, so you can choose one from the popup on any tab
- Works on x.com/home (and twitter.com, which redirects there)
- Works on both of X's web apps: the old one and the new one (`x-web`) that X is rolling out account by account

## Installation

1. Clone this repository: `git clone https://github.com/namzo/x-default-list.git`
2. Open `chrome://extensions/` in Chrome
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and choose this folder

After pulling changes, click the reload icon on the extension's card.

## Usage

1. Click the extension's icon to open the popup
2. Choose your **Default timeline**. For **A list or topic**, choose which one:
   - **Pinned** lists and topics open as a Home tab. To pin one, click the **+** to the right of your Home tabs, then pin it from **Lists** or **Topics**
   - **Not pinned** lists open on their own page whenever you open X fresh (new tab, bookmark, typing x.com). Reloading, Back and the Home link still show Home. A list appears here once you've opened it on X. On the new app, opening your Lists page once adds all your lists
3. Tick **Hide "For you"** or **Hide "Following"** if you like
4. Untick **Extension on** at the top of the popup to turn the extension off without uninstalling it

Settings save as you change them and apply straight away. They're the same for every X account you use in Chrome: the extension doesn't tell your accounts apart. If you switch to an account that doesn't have your default list pinned, it waits a few seconds for the list and then picks that account's first pinned tab.

## How it works

`content.js` runs on x.com from page start, in Chrome's isolated world, so it works only through the DOM.

X serves two different web apps, and its servers choose one per account: the old one (scripts from `abs.twimg.com/responsive-web/`) and the new one, `x-web` (scripts from `abs.twimg.com/x-web/`). Their markup differs, so `content.js` knows both; the notes at the top of the file describe each.

1. **Finds the Home tab bar**: on the old app, the `role="tablist"` in the main column whose tabs are `<div role="tab">` (Explore and profile tab bars use links, and the post composer toolbar has no tabs). On `x-web`, the `role="tablist"` whose tabs include For you and Following, marked `data-pinned-timeline`
2. **Hides tabs** with injected CSS keyed to the current markup
3. **Selects the default tab** on the first visit to Home after you open X fresh, or straight after you change the setting. It waits for the tab bar and your pinned lists, clicks the default, then guards it for 3 seconds in case X switches back (stopping as soon as you pick a tab). Back/Forward and the Home link keep the tab you're on (X keeps it within the page). After a reload X only remembers For you or Following, never a list, so the extension keeps the tab you were on in `sessionStorage` (per browser tab) and puts it back. It also moves you off a tab you've hidden
4. **Follows navigation** with the Navigation API, since X is a single-page app
5. **Learns your lists**: your Lists page (`/<username>/lists`) gives the names of your own lists, and each list's page (`/i/lists/<id>`) gives its ID. On `x-web` the Lists page gives the IDs too, so opening it once is enough. If your default is a list that isn't pinned, opening X fresh replaces Home with that list's page
6. **Reports to the popup** through `chrome.storage.local`: whether it found the Home tabs, your pinned tabs, and the lists it has learned

## Testing

`test.html` runs the real `content.js` against a copy of X's current Home markup, with a stand-in for the `chrome.*` APIs. The `xweb-*` scenarios use a copy of the new app's markup instead. No X account needed. From this folder, run:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/test.html. It runs 30 scenarios (21 for the old app, 9 for `x-web`), and the slowest take about 16 seconds; the summary at the top should say "All 30 passed". When X changes its layout, update the fake markup in `test.html` and the notes at the top of `content.js` together.

## Files

- `manifest.json`: extension configuration
- `content.js`: picks the default tab and hides tabs on X
- `popup.html`, `popup.js`: settings popup
- `test.html`: offline tests for `content.js`
- `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`: icons, rendered from `icons-src/`

To change the icon, edit the SVGs in `icons-src/` and re-render:

```bash
rsvg-convert -w 16 -h 16 icons-src/icon16.svg -o icon16.png && for s in 32 48 128; do rsvg-convert -w $s -h $s icons-src/icon.svg -o icon$s.png; done
```

## Troubleshooting

- **The popup says it couldn't find the Home tabs**: X has probably changed its layout. Check which app the account gets (the page loads scripts from `abs.twimg.com/x-web/` on the new one), then open `test.html` and compare that app's fake markup with x.com.
- **Your list isn't in the dropdown**: pin it (see Usage) and open X Home once, or, for a list you don't want pinned, open the list itself (or, on the new app, your Lists page) once.
- **Console messages** start with `[X Default Timeline]`.
