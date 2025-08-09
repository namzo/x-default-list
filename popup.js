// Popup script for X.com Tab Selector extension

document.addEventListener('DOMContentLoaded', function() {
    const onlyShowListsToggle = document.getElementById('onlyShowListsToggle');
    const hideForYouToggle = document.getElementById('hideForYouToggle');
    const hideFollowingToggle = document.getElementById('hideFollowingToggle');
    const hideForYouOption = document.getElementById('hideForYouOption');
    const hideFollowingOption = document.getElementById('hideFollowingOption');

    // Load saved settings
    chrome.storage.sync.get({
        onlyShowLists: false,
        hideForYou: false,
        hideFollowing: false
    }, function(items) {
        updateToggleState(onlyShowListsToggle, items.onlyShowLists);
        updateToggleState(hideForYouToggle, items.hideForYou);
        updateToggleState(hideFollowingToggle, items.hideFollowing);
        
        // Update UI based on "Only show lists" setting
        updateOptionVisibility();
    });

    // Function to update toggle state
    function updateToggleState(toggle, isActive) {
        if (isActive) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }

    // Function to get toggle state
    function getToggleState(toggle) {
        return toggle.classList.contains('active');
    }

    // Function to save and apply settings
    function saveAndApplySettings() {
        const settings = {
            onlyShowLists: getToggleState(onlyShowListsToggle),
            hideForYou: getToggleState(hideForYouToggle),
            hideFollowing: getToggleState(hideFollowingToggle)
        };

        // Save settings
        chrome.storage.sync.set(settings, function() {
            // Send message to content script to update behavior
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && (tabs[0].url.includes('x.com/home') || tabs[0].url.includes('twitter.com/home'))) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateSettings',
                        settings: settings
                    });
                }
            });
        });
    }

    // Handle "Only show lists" toggle change
    onlyShowListsToggle.addEventListener('click', function() {
        const isActive = getToggleState(this);
        updateToggleState(this, !isActive);
        updateOptionVisibility();
        saveAndApplySettings();
    });

    // Handle individual toggle changes
    hideForYouToggle.addEventListener('click', function() {
        const isActive = getToggleState(this);
        updateToggleState(this, !isActive);
        saveAndApplySettings();
    });

    hideFollowingToggle.addEventListener('click', function() {
        const isActive = getToggleState(this);
        updateToggleState(this, !isActive);
        saveAndApplySettings();
    });

    // Function to update option visibility based on "Only show lists" setting
    function updateOptionVisibility() {
        if (getToggleState(onlyShowListsToggle)) {
            // Disable and hide the individual options
            hideForYouOption.classList.add('disabled');
            hideFollowingOption.classList.add('disabled');
        } else {
            // Enable and show the individual options
            hideForYouOption.classList.remove('disabled');
            hideFollowingOption.classList.remove('disabled');
        }
    }
});
