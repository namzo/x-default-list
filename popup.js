// Popup script for X.com Tab Selector extension

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

    // Load saved settings
    chrome.storage.sync.get({
        extensionEnabled: true,
        hideForYou: false,
        hideFollowing: false,
        makeForYouDefault: false,
        makeListDefault: false,
        makeFollowingDefault: false,
        selectedList: ''
    }, function(items) {
        extensionEnabled.checked = items.extensionEnabled;
        hideForYou.checked = items.hideForYou;
        hideFollowing.checked = items.hideFollowing;

        // Translate stored booleans → select value
        if (items.makeListDefault) {
            defaultTimeline.value = 'list';
            listHint.style.display = 'block';
            fetchAndPopulateLists(items.selectedList);
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

    function fetchAndPopulateLists(currentValue) {
        listHint.style.display = 'block';
        listSelectorWrapper.style.display = 'block';

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url) return;
            if (!tabs[0].url.includes('x.com') && !tabs[0].url.includes('twitter.com')) {
                selectedList.innerHTML = '<option value="">Open X.com home to see your lists</option>';
                selectedList.disabled = true;
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getLists' }, function(response) {
                if (chrome.runtime.lastError || !response) {
                    selectedList.innerHTML = '<option value="">Navigate to X.com home first</option>';
                    selectedList.disabled = true;
                    return;
                }
                const lists = response.lists || [];
                if (lists.length === 0) {
                    selectedList.innerHTML = '<option value="">No pinned lists found</option>';
                    selectedList.disabled = true;
                    return;
                }
                selectedList.disabled = false;
                selectedList.innerHTML = '<option value="">Select a list</option>';
                lists.forEach(function(name) {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    if (name === currentValue) opt.selected = true;
                    selectedList.appendChild(opt);
                });
            });
        });
    }

    function saveAndApplySettings() {
        const val = defaultTimeline.value;
        const settings = {
            extensionEnabled: extensionEnabled.checked,
            hideForYou: hideForYou.checked,
            hideFollowing: hideFollowing.checked,
            makeForYouDefault: val === 'forYou',
            makeListDefault: val === 'list',
            makeFollowingDefault: val === 'following',
            selectedList: selectedList.value
        };

        chrome.storage.sync.set(settings, function() {
            updateUIState(settings.extensionEnabled);

            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].url && (tabs[0].url.includes('x.com') || tabs[0].url.includes('twitter.com'))) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateSettings',
                        settings: settings
                    });
                }
            });
        });
    }

    // Select change handler
    defaultTimeline.addEventListener('change', function() {
        if (this.value === 'list') {
            chrome.storage.sync.get({ selectedList: '' }, function(items) {
                fetchAndPopulateLists(items.selectedList);
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
