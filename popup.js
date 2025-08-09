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
        
        // Check for derived state after loading
        checkDerivedState();
        
        // Check individual derived states after loading
        checkIndividualDerivedStates();
    });

    // Function to update toggle state
    function updateToggleState(toggle, isActive) {
        if (isActive) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }

    // Function to update toggle state with derived state support
    function updateToggleStateWithDerived(toggle, isActive, isDerived = false) {
        // Remove all state classes first
        toggle.classList.remove('active', 'derived');
        
        if (isActive) {
            if (isDerived) {
                toggle.classList.add('active', 'derived');
            } else {
                toggle.classList.add('active');
            }
        }
    }

    // Function to get toggle state
    function getToggleState(toggle) {
        return toggle.classList.contains('active');
    }

    // Function to check if "Only show lists" should be in derived state
    function checkDerivedState() {
        const hideForYouActive = getToggleState(hideForYouToggle);
        const hideFollowingActive = getToggleState(hideFollowingToggle);
        const onlyShowListsActive = getToggleState(onlyShowListsToggle);
        const isCurrentlyDerived = onlyShowListsToggle.classList.contains('derived');
        
        // If both individual toggles are on but "Only show lists" is off, it should be derived
        if (hideForYouActive && hideFollowingActive && !onlyShowListsActive) {
            updateToggleStateWithDerived(onlyShowListsToggle, true, true);
            return true;
        } else if (onlyShowListsActive && isCurrentlyDerived && (!hideForYouActive || !hideFollowingActive)) {
            // Remove derived state only if conditions are no longer met AND it was previously derived
            updateToggleStateWithDerived(onlyShowListsToggle, true, false);
        } else if (!onlyShowListsActive && isCurrentlyDerived) {
            // Make sure derived state is removed if toggle is off
            onlyShowListsToggle.classList.remove('derived');
        } else if (onlyShowListsActive && isCurrentlyDerived && hideForYouActive && hideFollowingActive) {
            // Ensure derived state is maintained if conditions are still met
            updateToggleStateWithDerived(onlyShowListsToggle, true, true);
        }
        return false;
    }

    // Function to check and apply derived state to individual toggles
    function checkIndividualDerivedStates() {
        const onlyShowListsActive = getToggleState(onlyShowListsToggle);
        const isOnlyShowListsDerived = onlyShowListsToggle.classList.contains('derived');
        
        if (onlyShowListsActive && !isOnlyShowListsDerived) {
            // "Only show lists" is manually ON, so individual toggles should be derived if they're active
            const hideForYouActive = getToggleState(hideForYouToggle);
            const hideFollowingActive = getToggleState(hideFollowingToggle);
            
            // Apply derived state to individual toggles if they're active
            if (hideForYouActive) {
                updateToggleStateWithDerived(hideForYouToggle, true, true);
            }
            if (hideFollowingActive) {
                updateToggleStateWithDerived(hideFollowingToggle, true, true);
            }
        } else {
            // "Only show lists" is OFF or derived, so individual toggles should be normal
            const hideForYouActive = getToggleState(hideForYouToggle);
            const hideFollowingActive = getToggleState(hideFollowingToggle);
            
            updateToggleStateWithDerived(hideForYouToggle, hideForYouActive, false);
            updateToggleStateWithDerived(hideFollowingToggle, hideFollowingActive, false);
        }
    }

    // Function to save and apply settings
    function saveAndApplySettings() {
        const onlyShowLists = getToggleState(onlyShowListsToggle);
        
        const settings = {
            onlyShowLists: onlyShowLists,
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
        const isDerived = this.classList.contains('derived');
        
        // If it's in derived state, treat it as turning on manually
        if (isDerived) {
            updateToggleStateWithDerived(this, true, false);
            updateToggleState(hideForYouToggle, true);
            updateToggleState(hideFollowingToggle, true);
        } else {
            updateToggleState(this, !isActive);
            
            if (!isActive) {
                // If "Only show lists" is being turned on, automatically toggle the other options on initially
                updateToggleState(hideForYouToggle, true);
                updateToggleState(hideFollowingToggle, true);
            } else {
                // If "Only show lists" is being turned off, automatically toggle the other options off
                updateToggleState(hideForYouToggle, false);
                updateToggleState(hideFollowingToggle, false);
            }
        }
        
        // Check individual derived states
        checkIndividualDerivedStates();
        
        saveAndApplySettings();
    });

    // Handle individual toggle changes
    hideForYouToggle.addEventListener('click', function() {
        const isActive = getToggleState(this);
        const onlyShowListsActive = getToggleState(onlyShowListsToggle);
        const isDerived = onlyShowListsToggle.classList.contains('derived');
        
        updateToggleState(this, !isActive);
        
        // If "Only show lists" is on and we're turning off "Hide For you", turn off "Only show lists"
        if (onlyShowListsActive && isActive && !isDerived) {
            updateToggleState(onlyShowListsToggle, false);
        }
        
        // Check if "Only show lists" should be in derived state
        checkDerivedState();
        
        // Check individual derived states
        checkIndividualDerivedStates();
        
        saveAndApplySettings();
    });

    hideFollowingToggle.addEventListener('click', function() {
        const isActive = getToggleState(this);
        const onlyShowListsActive = getToggleState(onlyShowListsToggle);
        const isDerived = onlyShowListsToggle.classList.contains('derived');
        
        updateToggleState(this, !isActive);
        
        // If "Only show lists" is on and we're turning off "Hide Following", turn off "Only show lists"
        if (onlyShowListsActive && isActive && !isDerived) {
            updateToggleState(onlyShowListsToggle, false);
        }
        
        // Check if "Only show lists" should be in derived state
        checkDerivedState();
        
        // Check individual derived states
        checkIndividualDerivedStates();
        
        saveAndApplySettings();
    });
});
