// Popup script for the X Default Timeline extension

document.addEventListener('DOMContentLoaded', function() {
    const extensionEnabled = document.getElementById('extensionEnabled');
    const disabledState = document.getElementById('disabledState');
    const enabledState = document.getElementById('enabledState');
    const hideForYou = document.getElementById('hideForYou');
    const hideFollowing = document.getElementById('hideFollowing');
    const listSelectorWrapper = document.getElementById('listSelectorWrapper');
    const listHint = document.getElementById('listHint');
    const selectedList = document.getElementById('selectedList');
    const defaultTimeline = document.getElementById('defaultTimeline');
    const layoutWarning = document.getElementById('layoutWarning');

    // Load saved settings
    chrome.storage.sync.get({
        extensionEnabled: true,
        hideForYou: false,
        hideFollowing: false,
        makeForYouDefault: false,
        makeListDefault: false,
        makeFollowingDefault: false,
        selectedList: '',
        selectedListId: ''
    }, function(items) {
        extensionEnabled.checked = items.extensionEnabled;
        hideForYou.checked = items.hideForYou;
        hideFollowing.checked = items.hideFollowing;

        // Translate stored booleans → select value
        if (items.makeListDefault) {
            defaultTimeline.value = 'list';
            listHint.style.display = 'block';
            fetchAndPopulateLists(items);
        } else if (items.makeFollowingDefault) {
            defaultTimeline.value = 'following';
        } else {
            defaultTimeline.value = 'forYou';
        }

        syncSelectWithHideState();
        updateUIState(items.extensionEnabled);
    });

    // Disable conflicting options in the select and auto-switch if needed
    function syncSelectWithHideState() {
        const forYouOption = defaultTimeline.querySelector('option[value="forYou"]');
        const followingOption = defaultTimeline.querySelector('option[value="following"]');

        forYouOption.disabled = hideForYou.checked;
        followingOption.disabled = hideFollowing.checked;

        // If the currently selected option is now hidden, pick the first available one
        const currentOption = defaultTimeline.querySelector('option:checked');
        if (currentOption && currentOption.disabled) {
            const firstAvailable = defaultTimeline.querySelector('option:not([disabled]):not([value=""])');
            if (firstAvailable) {
                defaultTimeline.value = firstAvailable.value;
            }
        }
    }

    function updateUIState(isEnabled) {
        if (isEnabled) {
            disabledState.style.display = 'none';
            enabledState.style.display = 'block';
        } else {
            disabledState.style.display = 'block';
            enabledState.style.display = 'none';
        }
    }

    // The content script records whether it last found X's Home tabs.
    chrome.storage.local.get({ layout: null }, function(items) {
        const layout = items.layout;
        if (!layout || layout.ok !== false) return;
        const when = new Date(layout.checkedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        layoutWarning.textContent = 'Couldn\'t find the Home tabs on X (' + when + '). X may have changed its layout, so the extension might not work until it\'s updated.';
        layoutWarning.style.display = 'block';
    });

    function showListMessage(text) {
        selectedList.disabled = true;
        selectedList.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = text;
        selectedList.appendChild(opt);
    }

    function addOption(parent, value, text, selected) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        if (selected) opt.selected = true;
        parent.appendChild(opt);
    }

    // Option values: "tab:<name>" for a pinned list or topic (selected as a
    // Home tab), "list:<id>" for a list that isn't pinned (opens its page).
    function populateLists(pinned, unpinned, current) {
        if (pinned.length === 0 && unpinned.length === 0) {
            showListMessage('No lists found yet');
            return;
        }
        selectedList.disabled = false;
        selectedList.innerHTML = '';
        addOption(selectedList, '', 'Select a list or topic', false);

        if (pinned.length) {
            const group = document.createElement('optgroup');
            group.label = 'Pinned · opens as a Home tab';
            pinned.forEach(function(name) {
                addOption(group, 'tab:' + name, name, !current.selectedListId && name === current.selectedList);
            });
            selectedList.appendChild(group);
        }
        if (unpinned.length) {
            const group = document.createElement('optgroup');
            group.label = 'Not pinned · opens the list';
            unpinned.forEach(function(list) {
                addOption(group, 'list:' + list.id, list.name, list.id === current.selectedListId);
            });
            selectedList.appendChild(group);
        }
    }

    // Pinned names come from an open X Home tab if there is one, otherwise
    // from what the content script saved. Unpinned lists are the ones you've
    // opened on X, limited to your own lists once your Lists page has been seen.
    function fetchAndPopulateLists(current) {
        listHint.style.display = 'block';
        listSelectorWrapper.style.display = 'block';

        chrome.storage.local.get({ pinnedTimelines: [], knownLists: {}, yourLists: [] }, function(saved) {
            function show(pinned) {
                const unpinned = Object.keys(saved.knownLists)
                    .map(function(id) { return { id: id, name: saved.knownLists[id] }; })
                    .filter(function(list) {
                        return !pinned.includes(list.name) &&
                            (saved.yourLists.length === 0 || saved.yourLists.includes(list.name));
                    })
                    .sort(function(a, b) { return a.name.localeCompare(b.name); });
                populateLists(pinned, unpinned, current);
            }

            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const tab = tabs[0];
                if (!tab || !tab.url || !/^https:\/\/([^/]+\.)?(x|twitter)\.com\//.test(tab.url)) {
                    show(saved.pinnedTimelines);
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action: 'getLists' }, function(response) {
                    if (chrome.runtime.lastError || !response || !response.found) {
                        show(saved.pinnedTimelines);
                        return;
                    }
                    show(response.lists || []);
                });
            });
        });
    }

    function saveAndApplySettings() {
        const val = defaultTimeline.value;
        const choice = selectedList.value;
        const chosenOption = selectedList.selectedOptions[0];
        const settings = {
            extensionEnabled: extensionEnabled.checked,
            hideForYou: hideForYou.checked,
            hideFollowing: hideFollowing.checked,
            makeForYouDefault: val === 'forYou',
            makeListDefault: val === 'list',
            makeFollowingDefault: val === 'following'
        };
        // Only touch the chosen list once the dropdown has loaded.
        if (!selectedList.disabled && choice.startsWith('tab:')) {
            settings.selectedList = choice.slice(4);
            settings.selectedListId = '';
        } else if (!selectedList.disabled && choice.startsWith('list:')) {
            settings.selectedList = chosenOption.textContent;
            settings.selectedListId = choice.slice(5);
        }

        // The content script listens for storage changes and applies them itself.
        chrome.storage.sync.set(settings, function() {
            updateUIState(settings.extensionEnabled);
        });
    }

    // Select change handler
    defaultTimeline.addEventListener('change', function() {
        if (this.value === 'list') {
            chrome.storage.sync.get({ selectedList: '', selectedListId: '' }, function(items) {
                fetchAndPopulateLists(items);
            });
        } else {
            listHint.style.display = 'none';
            listSelectorWrapper.style.display = 'none';
        }
        saveAndApplySettings();
    });

    // Hide checkbox change handlers — sync select before saving
    hideForYou.addEventListener('change', function() {
        syncSelectWithHideState();
        saveAndApplySettings();
    });

    hideFollowing.addEventListener('change', function() {
        syncSelectWithHideState();
        saveAndApplySettings();
    });

    selectedList.addEventListener('change', saveAndApplySettings);
    extensionEnabled.addEventListener('change', saveAndApplySettings);
});
