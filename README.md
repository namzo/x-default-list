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

`content.js` runs on x.com from page start, in Chrome's isolated world, so it works only through the page's DOM. It finds the Home tab bar, hides tabs with CSS, clicks your default and learns your lists from the Lists pages you visit. It tells the popup what it found through `chrome.storage.local`.

X serves two web apps with different markup, and its servers choose one per account: the old one (`responsive-web`) and the new one (`x-web`). `content.js` handles both. The notes at the top of the file describe each layout and the elements the extension looks for.

## Testing

`test.html` loads the real `content.js` into copies of X's Home markup, with a stand-in for the `chrome.*` APIs, so you don't need an X account. The `xweb-*` scenarios use the new app's markup. From this folder, run:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/test.html. It runs 32 scenarios (22 for the old app, 10 for `x-web`), and the slowest take about 16 seconds. A passing run says "All 32 passed" at the top.

When X changes its layout, update the fake markup in `test.html` and the notes at the top of `content.js` together.

## Releasing

1. Raise `version` in `manifest.json` and commit it
2. Tag the commit with the same version and push it. For version 1.6:

```bash
git tag -a v1.6 -m "X Default Timeline 1.6" && git push origin main v1.6
```

The release workflow (`.github/workflows/release.yml`) checks that the tag matches `manifest.json`, builds `x-default-timeline-v1.6.zip` and publishes it as a GitHub release. The zip leaves out `test.html`, `icons-src/` and repo files (see `.gitattributes`).

If GitHub Actions can't run, publish the same release by hand after pushing the tag:

```bash
git archive --format=zip --prefix=x-default-timeline/ -o x-default-timeline-v1.6.zip v1.6
gh release create v1.6 x-default-timeline-v1.6.zip --verify-tag --title "X Default Timeline v1.6"
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
