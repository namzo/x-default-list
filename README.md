# X Default Timeline

A Chrome extension that chooses which X Home tab opens by default (For you, Following or a pinned list or topic) and can hide the tabs you don't use.

## Features

- **Default timeline**: For you, Following, or any list or topic you've pinned to your Home tabs
- **Lists you haven't pinned**: choose one and opening X takes you straight to that list's page (the Home link still shows Home)
- **Hide "For you"** and/or **Hide "Following"**
- **No flash of the wrong timeline**: posts stay hidden for a moment (at most 2.5 seconds) until your default tab is selected
- **Respects you**: once you pick a tab yourself it stops steering, and Back/Forward keeps the tab you were on
- **Warns you if X changes its layout**: the popup says so when it couldn't find the Home tabs
- **Remembers your pinned lists**, so you can choose one from the popup on any tab
- Works on x.com/home (and twitter.com, which redirects there)

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and choose this folder

After pulling changes, click the reload icon on the extension's card.

## Usage

1. Click the extension's icon to open the popup
2. Choose your **Default timeline**. For **A list or topic**, choose which one:
   - **Pinned** lists and topics open as a Home tab. To pin one, click the **+** to the right of your Home tabs, then pin it from **Lists** or **Topics**
   - **Not pinned** lists open on their own page whenever you open X fresh (new tab, bookmark, typing x.com). Reloading, Back and the Home link still show Home. A list appears here once you've opened it on X
3. Tick **Hide "For you"** or **Hide "Following"** if you like

Settings save as you change them and apply straight away.

## How it works

`content.js` runs on x.com from page start, in Chrome's isolated world, so it works only through the DOM:

1. **Finds the Home tab bar**: the `role="tablist"` in the main column whose tabs are `<div role="tab">` (Explore and profile tab bars use links, and the post composer toolbar has no tabs)
2. **Hides tabs** with injected CSS keyed to the current markup
3. **Selects the default tab** each time you open Home (page load or the Home link). It waits for the tab bar and your pinned lists, clicks the default, then guards it for 3 seconds in case X switches back
4. **Follows navigation** with the Navigation API, since X is a single-page app
5. **Learns your lists**: your Lists page (`/<username>/lists`) gives the names of your own lists, and each list's page (`/i/lists/<id>`) gives its ID. If your default is a list that isn't pinned, opening X fresh replaces Home with that list's page
6. **Reports to the popup** through `chrome.storage.local`: whether it found the Home tabs, your pinned tabs, and the lists it has learned

## Testing

`test.html` runs the real `content.js` against a copy of X's current Home markup, with a stand-in for the `chrome.*` APIs. No X account needed:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/test.html. The slowest scenarios take about 16 seconds. When X changes its layout, update the fake markup in `test.html` and the notes at the top of `content.js` together.

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

- **The popup says it couldn't find the Home tabs**: X has probably changed its layout. Open `test.html` and compare its fake markup with x.com.
- **Your list isn't in the dropdown**: make sure it's pinned (see Usage), then open X Home once.
- **Console messages** start with `[X Default Timeline]`.
