# X.com Tab Selector Chrome Extension

This Chrome extension allows you to customize your Twitter timeline tabs with a user-friendly interface. You can hide specific tabs and control which tab is selected by default.

## Features

- **Only show lists**: Hides the first and second tabs completely, showing only the 3rd tab
- **Hide "For you"**: Hides only the first tab while keeping others visible
- **Hide "Following"**: Hides only the second tab while keeping others visible
- **Smart tab selection**: Automatically selects the first visible tab based on your settings
- **User-friendly UI**: Click the extension icon to access settings
- **Settings persistence**: Your preferences are saved and applied automatically
- **Works only on the home page** (x.com/home or twitter.com/home)
- **Handles dynamic content loading** with retry mechanism
- **Console logging for debugging**

## Installation

### Method 1: Load as Unpacked Extension

1. Download or clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing this extension
5. The extension should now appear in your extensions list

### Method 2: Create Icon Files (Optional)

The extension will work without custom icons, but if you want to add them:

1. Create three PNG files:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels) 
   - `icon128.png` (128x128 pixels)
2. Replace the placeholder files in the extension folder

## Usage

1. Install the extension following the instructions above
2. Click the extension icon in your browser toolbar to open the settings popup
3. Choose your preferred settings:
   - **Only show lists**: Hides both "For you" and "Following" tabs
   - **Hide "For you"**: Hides only the first tab
   - **Hide "Following"**: Hides only the second tab
4. Settings are applied automatically when you toggle the checkboxes
5. Visit x.com/home or twitter.com/home to see the changes
6. The extension will automatically select the first visible tab based on your settings

## How It Works

The extension:

1. **Loads user settings**: Retrieves saved preferences from Chrome storage
2. **Detects the Home tab bar**: The `role="tablist"` in the primary column whose tabs are `<div role="tab">` (other pages' tab bars use links, and the composer toolbar has no tabs)
3. **Applies visibility settings**: Hides "For you" / "Following" with injected CSS
4. **Selects the default tab**: Each time you open Home (page load or the Home link), it waits for the tab bar and pinned lists, clicks your default tab, then guards it for a few seconds in case X switches back
5. **Respects you**: Stops as soon as you pick a tab yourself, and leaves Back/Forward alone (X restores the tab you were on)
6. **Follows navigation**: Uses the Navigation API to notice X's in-app page changes
7. **Updates in real-time**: Responds to settings changes from the popup

To pin a list or topic so it appears as a tab, click the **+** to the right of the Home tabs and pin it from **Lists** or **Topics**.

## Files

- `manifest.json`: Extension configuration
- `content.js`: Main script that handles tab selection and settings
- `popup.html`: User interface for settings
- `popup.js`: Popup script that handles settings management
- `icon16.png`, `icon48.png`, `icon128.png`: Extension icons (placeholders)
- `README.md`: This file

## Troubleshooting

- **Extension not working**: Check the browser console for error messages
- **Tabs not found**: The extension will retry automatically, but you can refresh the page
- **User clicks ignored**: The extension is designed to respect manual tab clicks

## Development

To modify the extension:

1. Edit `content.js` to change the behavior
2. Edit `manifest.json` to modify permissions or target sites
3. Reload the extension in `chrome://extensions/`

## Notes

- This extension only works on the home page (x.com/home or twitter.com/home)
- It requires the `activeTab` permission to function
- The extension runs after the DOM is fully loaded
- Console logs are available for debugging (open DevTools to see them)
