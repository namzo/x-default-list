# X Default Timeline

Chrome extension for setting lists as your default timeline on X. It can also open X on For you or Following, and hide the Home tabs you don't use.

## Features

- **Default timeline**: open X on For you, Following, or any list or topic pinned to your Home tabs
- **Lists you haven't pinned**: opening X takes you straight to that list's page, and the Home link still goes to Home
- **Hide tabs**: hide For you, Following or both
- **Opens on the right tab**: the tab bar and posts stay hidden until your default is selected (2.5 seconds at most), so X's last-used tab never flashes up first
- **Keeps your place**: the default applies only when you open X fresh (a new tab, a bookmark, typing x.com). Reloading, Back/Forward and the Home link keep the tab you're on, so the page doesn't jump
- **Layout warning**: the popup tells you when the extension couldn't find X's Home tabs
- Works on x.com and twitter.com, which redirects to it

## Installation

1. Download the zip from the [latest release](https://github.com/namzo/x-default-list/releases/latest) and unzip it. You get an `x-default-timeline` folder
2. Open `chrome://extensions/` in Chrome
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and choose the `x-default-timeline` folder

To update, download the new release, replace the folder's contents and click the reload icon on the extension's card. Chrome can't load the zip itself, so keep the unzipped folder where it is.

To work on the code instead, clone the repository (`git clone https://github.com/namzo/x-default-list.git`) and load this folder.

## Usage

1. Click the extension's icon to open the popup
2. Choose your **Default timeline**. For **A list or topic**, pick one from the second dropdown:
   - **Pinned** lists and topics open as a Home tab. To pin one, click the **+** to the right of your Home tabs, then pin it from **Lists** or **Topics**
   - **Not pinned** lists open on their own page when you open X fresh. A list shows up in the dropdown once you've opened it on X
3. Tick **Hide "For you"** or **Hide "Following"** to remove those tabs
4. Untick **Extension on** to switch the extension off without uninstalling it

Settings save as you change them and apply straight away. Every X account you use in Chrome shares them, because the extension can't tell your accounts apart. If you switch to an account that hasn't pinned your default list, the extension waits a few seconds for it, then picks that account's first pinned tab.

## How it works

`content.js` runs on x.com from page start, in Chrome's isolated world, so it can only read and change the page's DOM.

X serves two web apps, and its servers choose one per account: the old one (scripts from `abs.twimg.com/responsive-web/`) and the new one, `x-web` (scripts from `abs.twimg.com/x-web/`). Their markup differs, so `content.js` handles both. The notes at the top of the file describe each layout.

1. **Finds the Home tab bar**. On the old app, it's the `role="tablist"` in the main column whose tabs are `<div role="tab">`; Explore and profile tab bars use links, and the post composer's toolbar has no tabs. On `x-web`, it's the `role="tablist"` whose For you and Following tabs carry `data-pinned-timeline`
2. **Hides tabs** with injected CSS
3. **Selects the default tab** on the first visit to Home after you open X fresh, or as soon as you change the setting. It waits for the tab bar and your pinned lists, clicks the default, then keeps it selected for 3 seconds in case X switches back. It stops as soon as you pick a tab yourself, and moves you off any tab you've hidden
4. **Puts your tab back after a reload**. X only remembers For you or Following, never a list, so the extension saves the tab you're on in `sessionStorage` (per browser tab) and selects it again
5. **Follows navigation** with the Navigation API, since X is a single-page app
6. **Learns your lists**. Your Lists page (`/<username>/lists`) gives your lists' names, and each list's page (`/i/lists/<id>`) gives its ID; on `x-web` the Lists page gives the IDs too. If your default is a list that isn't pinned, opening X fresh goes to that list's page instead of Home
7. **Reports to the popup** through `chrome.storage.local`: whether it found the Home tabs, your pinned tabs, and the lists it has learned

## Testing

`test.html` loads the real `content.js` into copies of X's Home markup, with a stand-in for the `chrome.*` APIs, so you don't need an X account. The `xweb-*` scenarios use the new app's markup. From this folder, run:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/test.html. It runs 30 scenarios (21 for the old app, 9 for `x-web`), and the slowest take about 16 seconds. A passing run says "All 30 passed" at the top.

When X changes its layout, update the fake markup in `test.html` and the notes at the top of `content.js` together.

## Releasing

1. Raise `version` in `manifest.json` and commit it
2. Tag the commit with the same version and push the tag:

```bash
git tag v1.4 && git push origin v1.4
```

The release workflow (`.github/workflows/release.yml`) checks that the tag matches `manifest.json`, builds `x-default-timeline-v1.4.zip` and publishes it as a GitHub release. The zip leaves out `test.html`, `icons-src/` and repo files (see `.gitattributes`).

If GitHub Actions can't run, publish the same release by hand after pushing the tag:

```bash
git archive --format=zip --prefix=x-default-timeline/ -o x-default-timeline-v1.4.zip v1.4
gh release create v1.4 x-default-timeline-v1.4.zip --verify-tag --title "X Default Timeline v1.4"
```

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
- **Your list isn't in the dropdown**: pin it and open X Home once. For a list you don't want to pin, open the list on X once.
- **Checking what the extension did**: its console messages start with `[X Default Timeline]`.
