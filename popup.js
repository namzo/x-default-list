// Popup script for X.com Tab Selector extension

document.addEventListener('DOMContentLoaded', function() {
    const extensionEnabled = document.getElementById('extensionEnabled');
    const disabledState = document.getElementById('disabledState');
    const enabledState = document.getElementById('enabledState');
    const hideForYou = document.getElementById('hideForYou');
    const hideFollowing = document.getElementById('hideFollowing');
    const makeListDefault = document.getElementById('makeListDefault');
    const makeFollowingDefault = document.getElementById('makeFollowingDefault');
    const listSelectorWrapper = document.getElementById('listSelectorWrapper');
    const selectedList = document.getElementById('selectedList');

    // Load saved settings
    chrome.storage.sync.get({
        extensionEnabled: true,
        hideForYou: false,
        hideFollowing: false,
        makeListDefault: false,
        makeFollowingDefault: false,
        selectedList: ''
    }, function(items) {
        extensionEnabled.checked = items.extensionEnabled;
        hideForYou.checked = items.hideForYou;
        hideFollowing.checked = items.hideFollowing;
        makeListDefault.checked = items.makeListDefault;
        makeFollowingDefault.checked = items.makeFollowingDefault;

        updateUIState(items.extensionEnabled);

        if (items.makeListDefault) {
            fetchAndPopulateLists(items.selectedList);
        }
    });

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
                selectedList.innerHTML = '<option value="">— select a list —</option>';
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
        const settings = {
            extensionEnabled: extensionEnabled.checked,
            hideForYou: hideForYou.checked,
            hideFollowing: hideFollowing.checked,
            makeListDefault: makeListDefault.checked,
            makeFollowingDefault: makeFollowingDefault.checked,
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

    makeListDefault.addEventListener('change', function() {
        if (makeListDefault.checked) {
            chrome.storage.sync.get({ selectedList: '' }, function(items) {
                fetchAndPopulateLists(items.selectedList);
            });
        } else {
            listSelectorWrapper.style.display = 'none';
        }
        saveAndApplySettings();
    });

    selectedList.addEventListener('change', saveAndApplySettings);

    extensionEnabled.addEventListener('change', saveAndApplySettings);
    hideForYou.addEventListener('change', saveAndApplySettings);
    hideFollowing.addEventListener('change', saveAndApplySettings);
    makeFollowingDefault.addEventListener('change', saveAndApplySettings);
});
