// Intercept X.com's programmatic tab selection as early as possible.
// Must run synchronously before any async code so it's active before X.com renders.
(function setupAttributeOverride() {
  if (window.__xOriginalSetAttribute) return; // already installed
  window.__xOriginalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'aria-selected' && value === 'true' && this.getAttribute('role') === 'tab') {
      const tablist = this.closest('[role="tablist"]');
      if (tablist) {
        const tabs = tablist.querySelectorAll('[role="tab"]');
        const tabIndex = Array.from(tabs).indexOf(this);
        if (tabIndex === 0 && tabs.length >= 2) {
          if (settings.makeListDefault && tabs.length >= 3) {
            console.log('Intercepting tab 0 selection, redirecting to list tab');
            let targetTab = tabs[2];
            if (settings.selectedList) {
              const found = Array.from(tabs).slice(2).find(t => t.textContent.trim() === settings.selectedList);
              if (found) targetTab = found;
            }
            return window.__xOriginalSetAttribute.call(targetTab, name, value);
          }
          if (settings.makeFollowingDefault) {
            console.log('Intercepting tab 0 selection, redirecting to Following tab');
            return window.__xOriginalSetAttribute.call(tabs[1], name, value);
          }
        }
      }
    }
    return window.__xOriginalSetAttribute.call(this, name, value);
  };
})();

// Call a React onClick handler directly from the element's fiber props,
// bypassing the browser event system (which X.com may ignore for programmatic clicks).
function triggerReactClick(element) {
  try {
    const propsKey = Object.keys(element).find(k => k.startsWith('__reactProps'));
    if (propsKey) {
      const props = element[propsKey];
      if (props && typeof props.onClick === 'function') {
        const rect = element.getBoundingClientRect();
        const evt = new MouseEvent('click', {
          bubbles: true, cancelable: true, view: window,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        });
        props.onClick(evt);
        return true;
      }
    }
  } catch (e) { /* ignore */ }
  return false;
}

// Helper function to select a tab without causing scrolling
function selectTab(tab) {
  if (!tab) return;

  const tablist = tab.closest('[role="tablist"]');
  if (!tablist) return;

  const tabs = tablist.querySelectorAll('[role="tab"]');

  // Update aria-selected state
  tabs.forEach(t => {
    t.setAttribute('aria-selected', 'false');
    t.classList.remove('active', 'selected', 'r-1kihuf0');
  });
  tab.setAttribute('aria-selected', 'true');
  tab.classList.add('r-1kihuf0');

  const scrollY = window.scrollY;

  try {
    // Primary: call React's onClick handler directly on the tab or its children.
    // This is more reliable than tab.click() which X.com may ignore.
    let handled = triggerReactClick(tab);
    if (!handled) {
      // Try children in order (inner div, span, etc.)
      for (const child of Array.from(tab.querySelectorAll('*'))) {
        if (triggerReactClick(child)) { handled = true; break; }
      }
    }
    if (!handled) {
      // Fallback: native click event
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  } catch (error) {
    console.log('Error triggering tab selection:', error);
    tab.click();
  }

  if (Math.abs(window.scrollY - scrollY) > 10) {
    window.scrollTo(0, scrollY);
  }

  console.log('Selected tab:', tab.textContent.trim());
}

// Persistent enforcement: watch the tablist and correct X.com if it resets the active tab.
let _followingEnforcementObserver = null;
let _followingEnforcing = false;

function startFollowingEnforcement() {
  if (_followingEnforcementObserver) return; // already running

  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return;

  _followingEnforcementObserver = new MutationObserver(() => {
    if (_followingEnforcing || !settings.makeFollowingDefault) return;

    const tabs = tablist.querySelectorAll('[role="tab"]');
    if (tabs.length < 2) return;

    const activeTab = Array.from(tabs).find(t => t.getAttribute('aria-selected') === 'true');
    if (!activeTab) return;

    const activeIndex = Array.from(tabs).indexOf(activeTab);
    if (activeIndex === 0) {
      // X.com reset to "For You" — switch back to Following
      _followingEnforcing = true;
      console.log('Enforcing Following default: correcting tab selection');
      selectTab(tabs[1]);
      setTimeout(() => { _followingEnforcing = false; }, 1000);
    }
  });

  _followingEnforcementObserver.observe(tablist, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected'],
    childList: true,
  });
  console.log('Following default enforcement observer started');
}

function stopFollowingEnforcement() {
  if (_followingEnforcementObserver) {
    _followingEnforcementObserver.disconnect();
    _followingEnforcementObserver = null;
  }
  _followingEnforcing = false;
}

// Function to check if extension is completely disabled
function isExtensionDisabled() {
  return !settings.extensionEnabled;
}

// Function to check if any settings are enabled
function hasActiveSettings() {
  return settings.extensionEnabled && (settings.hideForYou || settings.hideFollowing || settings.makeListDefault || settings.makeFollowingDefault);
}

// Function to handle tab selection based on settings
function handleTabSelectionWithSettings() {
  // Only run on home page and if settings are active
  if (!isHomePage() || !hasActiveSettings()) {
    return false;
  }
  
  // Find the tablist element
  const tablist = document.querySelector('[role="tablist"]');
  
  if (!tablist) {
    console.log('Tablist not found, retrying...');
    return false;
  }
  
  // Get all tab elements within the tablist
  const tabs = tablist.querySelectorAll('[role="tab"]');
  
  if (tabs.length < 3) {
    console.log('No 3rd tab found (only', tabs.length, 'tabs available), doing nothing');
    return true; // Return true to stop retrying since there's no 3rd tab
  }
  
  // Show all tab parent divs first
  tabs.forEach(tab => {
    const parentDiv = tab.closest('[role="presentation"]');
    if (parentDiv) parentDiv.style.display = '';
  });
  
  // Handle individual hide settings
  if (settings.hideForYou && tabs[0]) {
    const parentDiv = tabs[0].closest('[role="presentation"]');
    if (parentDiv) {
      parentDiv.style.display = 'none';
    }
  }
  if (settings.hideFollowing && tabs[1]) {
    const parentDiv = tabs[1].closest('[role="presentation"]');
    if (parentDiv) {
      parentDiv.style.display = 'none';
    }
  }
  
  // Hide ScrollSnap elements if tabs are hidden
  if (settings.hideForYou || settings.hideFollowing) {
    setTimeout(() => {
      hideScrollSnapElements();
    }, 100);
  }
  
  // Find the first visible tab to select
  let firstVisibleTab = null;
  
  // If makeListDefault is enabled, find the target list tab by name (or fall back to tabs[2])
  if (settings.makeListDefault && tabs.length >= 3) {
    let targetTab = tabs[2];
    if (settings.selectedList) {
      const found = Array.from(tabs).slice(2).find(t => t.textContent.trim() === settings.selectedList);
      if (found) targetTab = found;
    }
    const targetTabParent = targetTab.closest('[role="presentation"]');
    if (targetTabParent && targetTabParent.style.display !== 'none') {
      firstVisibleTab = targetTab;
      console.log('makeListDefault enabled: selecting list tab', targetTab.textContent.trim());
    }
  }

  // If makeFollowingDefault is enabled, try to select the 2nd tab (Following tab)
  if (!firstVisibleTab && settings.makeFollowingDefault && tabs.length >= 2) {
    const secondTab = tabs[1];
    const secondTabParent = secondTab.closest('[role="presentation"]');
    if (secondTabParent && secondTabParent.style.display !== 'none') {
      firstVisibleTab = secondTab;
      console.log('makeFollowingDefault enabled: selecting 2nd tab (Following tab)');
    }
  }
  
  // If makeListDefault didn't select a tab or is disabled, use the original logic
  if (!firstVisibleTab) {
    for (let i = 0; i < tabs.length; i++) {
      const parentDiv = tabs[i].closest('[role="presentation"]');
      if (parentDiv && parentDiv.style.display !== 'none') {
        firstVisibleTab = tabs[i];
        break;
      }
    }
  }
  
  if (firstVisibleTab) {
    // Skip clicking if the tab is already selected — avoids triggering X.com's dropdown
    if (firstVisibleTab.getAttribute('aria-selected') === 'true') {
      return true;
    }
    selectTab(firstVisibleTab);
    return true;
  }
  
  return false;
}

// Function to handle tab selection with retry mechanism
function handleTabSelection() {
  // Don't run if extension is disabled or no settings are active
  if (isExtensionDisabled() || !hasActiveSettings()) {
    return;
  }
  
  let attempts = 0;
  const maxAttempts = 5; // Reduced attempts to be less aggressive
  
  const trySelectTab = () => {
    attempts++;
    
    const result = handleTabSelectionWithSettings();
    if (result === true) {
      return; // Success or no tabs to select (both are valid outcomes)
    }
    
    if (attempts < maxAttempts) {
      // Retry with much longer delays to avoid interference
      setTimeout(trySelectTab, attempts < 2 ? 200 : 500);
    } else {
      console.log('Failed to find tablist after', maxAttempts, 'attempts');
    }
  };
  
  // Try immediately first
  if (handleTabSelectionWithSettings()) {
    return; // Success on first try
  }
  
  // If not successful, start retry mechanism
  trySelectTab();
}

// Function to handle user clicks on tabs based on settings
function handleTabClicks() {
  document.addEventListener('click', (event) => {
    // Only handle clicks on home page and if extension is enabled and settings are active
    if (!isHomePage() || isExtensionDisabled() || !hasActiveSettings()) {
      return;
    }
    
    // Check if the clicked element is a tab
    const clickedTab = event.target.closest('[role="tab"]');
    if (clickedTab) {
      const tablist = clickedTab.closest('[role="tablist"]');
      if (tablist) {
        const tabs = tablist.querySelectorAll('[role="tab"]');
        const tabIndex = Array.from(tabs).indexOf(clickedTab);
        
        // Handle individual hide settings
        if (settings.hideForYou && tabIndex === 0) {
          console.log('User clicked on hidden "For you" tab, redirecting to next visible tab');
          event.preventDefault();
          event.stopPropagation();

          // Find next visible tab
          for (let i = 1; i < tabs.length; i++) {
            const parentDiv = tabs[i].closest('[role="presentation"]');
            if (parentDiv && parentDiv.style.display !== 'none') {
              selectTab(tabs[i]);
              return;
            }
          }
          return;
        }

        if (settings.hideFollowing && tabIndex === 1) {
          console.log('User clicked on hidden "Following" tab, redirecting to next visible tab');
          event.preventDefault();
          event.stopPropagation();

          // Find next visible tab
          for (let i = 2; i < tabs.length; i++) {
            const parentDiv = tabs[i].closest('[role="presentation"]');
            if (parentDiv && parentDiv.style.display !== 'none') {
              selectTab(tabs[i]);
              return;
            }
          }
          return;
        }
        
        // Note: makeListDefault only affects initial tab selection, not user clicks
        // Users should be able to freely click on any tab after the initial selection
      }
      
      // User clicked on a valid tab, allow it
      console.log('User clicked on a valid tab, allowing user selection');
    }
  });
  
}

// Function to observe DOM changes and handle dynamic content
function observeDOMChanges() {
  let reinitializeTimeout = null;
  let checkTabsTimeout = null;
  let hasInitialized = false;
  
  const observer = new MutationObserver((mutations) => {
    // Only observe on home page and if extension is enabled and settings are active
    if (!isHomePage() || isExtensionDisabled() || !hasActiveSettings()) {
      return;
    }
    
    let shouldCheckTabs = false;
    let shouldReinitialize = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if tablist was added or modified (only for major changes)
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if we find a tablist - this could be navigation back to home
            if (node.querySelector && node.querySelector('[role="tablist"]')) {
              // If we haven't initialized yet, or if this is a new tablist (navigation)
              if (!hasInitialized || !document.querySelector('[role="tablist"]')) {
                shouldCheckTabs = true;
                shouldReinitialize = true;
                hasInitialized = true;
              }
            }
          }
        });
        
        // IMMEDIATELY hide any tabs that should be hidden (but only for new tab elements)
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tabs = node.querySelectorAll && node.querySelectorAll('[role="tab"]');
            if (tabs && tabs.length > 0) {
              // Only hide tabs if they're actually new and visible
              tabs.forEach(tab => {
                const parentDiv = tab.closest('[role="presentation"]');
                if (parentDiv && parentDiv.style.display !== 'none') {
                  // Immediately hide tabs based on settings
                  if (settings.hideForYou) {
                    const tabIndex = Array.from(tab.parentElement.querySelectorAll('[role="tab"]')).indexOf(tab);
                    if (tabIndex === 0) {
                      parentDiv.style.display = 'none';
                    }
                  }
                  if (settings.hideFollowing) {
                    const tabIndex = Array.from(tab.parentElement.querySelectorAll('[role="tab"]')).indexOf(tab);
                    if (tabIndex === 1) {
                      parentDiv.style.display = 'none';
                    }
                  }
                }
              });
            }
            
            // Hide ScrollSnap navigation arrows if they're added (but only once)
            const scrollSnapElements = node.querySelectorAll && node.querySelectorAll('.ScrollSnap-prevButtonWrapper, .ScrollSnap-nextButtonWrapper, .ScrollSnap-prevButton, .ScrollSnap-nextButton, [class*="ScrollSnap"][class*="prevButton"], [class*="ScrollSnap"][class*="nextButton"]');
            if (scrollSnapElements && scrollSnapElements.length > 0 && (settings.hideForYou || settings.hideFollowing)) {
              scrollSnapElements.forEach(element => {
                element.style.display = 'none';
              });
            }
          }
        });
      }
    });
    
    if (shouldReinitialize) {
      // Reinitialize when tablist is found (could be navigation back to home)
      console.log('Tablist found, initializing extension');
      
      // Clear any existing timeout
      if (reinitializeTimeout) {
        clearTimeout(reinitializeTimeout);
      }
      
      reinitializeTimeout = setTimeout(() => {
        init();
      }, 500); // Increased delay to be less aggressive
    }
    
    if (shouldCheckTabs) {
      // Check tabs when tablist is found
      // Clear any existing timeout
      if (checkTabsTimeout) {
        clearTimeout(checkTabsTimeout);
      }
      
      // Immediate check for faster response
      handleTabSelection();
      // Also check again after a longer delay to ensure everything is loaded
      checkTabsTimeout = setTimeout(handleTabSelection, 300);
    }
  });
  
  // Start observing with more specific configuration
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Don't observe attributes or character data to reduce noise
  });
  
  // Return a function to fully reset/stop the observer (for URL or settings changes)
  return function resetInitialization() {
    hasInitialized = false;
    if (reinitializeTimeout) {
      clearTimeout(reinitializeTimeout);
      reinitializeTimeout = null;
    }
    if (checkTabsTimeout) {
      clearTimeout(checkTabsTimeout);
      checkTabsTimeout = null;
    }
    try {
      observer.disconnect();
    } catch (e) {}
  };
}

// Global settings object
let settings = {
  extensionEnabled: true,
  hideForYou: false,
  hideFollowing: false,
  makeListDefault: false,
  makeFollowingDefault: false,
  selectedList: ''
};

// Initialize the extension
function init() {
  console.log('X.com Third Tab Selector initialized');
  
  // Check if we're on the home page
  if (!isHomePage()) {
    console.log('Not on home page, skipping initialization');
    return;
  }
  
  // Check if extension is disabled - if so, clean up and exit completely
  if (isExtensionDisabled()) {
    console.log('Extension is disabled, cleaning up and stopping all functionality');
    cleanupCSS(); // Restore everything to default state
    return;
  }
  
  // Only initialize if settings are active
  if (!hasActiveSettings()) {
    console.log('No active settings, skipping initialization');
    return;
  }
  
  // Set initialization flag to prevent multiple initializations
  hasInitializedOnThisPage = true;
  
  // Clean up any existing CSS first
  cleanupCSS();
  
  // Load settings first, then inject CSS based on settings
  loadSettings();
  
  // Store the reset function from observeDOMChanges
  if (!window.resetDOMObserver) {
    window.resetDOMObserver = observeDOMChanges();
  }
}

// Function to check if we're on the home page
function isHomePage() {
  const url = window.location.href;
  const path = window.location.pathname;
  
  // Check for explicit home page
  if (url.includes('/home')) {
    return true;
  }
  
  // Check for root domain (home page)
  if (path === '/' || path === '') {
    return true;
  }
  
  return false;
}

// Function to inject CSS to hide tabs immediately
function injectHideCSS() {
  // Only inject CSS on home page and if extension is enabled and settings are active
  if (!isHomePage() || isExtensionDisabled() || !hasActiveSettings()) {
    return;
  }
  
  // Only inject CSS if settings require it
  if (settings.hideForYou || settings.hideFollowing) {
    const style = document.createElement('style');
    style.id = 'x-tab-selector-css';
    
    let css = '';
    if (settings.hideForYou) {
      css += `
        /* Hide first tab when hide for you is enabled */
        .TimelineTabs [role="tablist"] > [role="presentation"]:nth-child(1) {
          display: none !important;
        }
      `;
    }
    if (settings.hideFollowing) {
      css += `
        /* Hide second tab when hide following is enabled */
        .TimelineTabs [role="tablist"] > [role="presentation"]:nth-child(2) {
          display: none !important;
        }
      `;
    }
    
    // Hide ScrollSnap navigation arrows when tabs are hidden
    if (settings.hideForYou || settings.hideFollowing) {
      css += `
        /* Hide ScrollSnap navigation arrows when tabs are hidden */
        .TimelineTabs .ScrollSnap-List .ScrollSnap-prevButtonWrapper,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-nextButtonWrapper,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-prevButton,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-nextButton,
        .TimelineTabs .ScrollSnap-List [class*="prevButton"],
        .TimelineTabs .ScrollSnap-List [class*="nextButton"] {
          display: none !important;
        }

        /* Also hide any other scroll navigation elements */
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-prevButtonWrapper,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-nextButtonWrapper,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-prevButton,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-nextButton,
        .TimelineTabs .ScrollSnap-prevButtonWrapper,
        .TimelineTabs .ScrollSnap-nextButtonWrapper,
        .TimelineTabs .ScrollSnap-prevButton,
        .TimelineTabs .ScrollSnap-nextButton {
          display: none !important;
        }

        /* Hide any scroll navigation arrows in the timeline tabs area */
        .TimelineTabs [class*="ScrollSnap"] [class*="prevButton"],
        .TimelineTabs [class*="ScrollSnap"] [class*="nextButton"],
        .TimelineTabs [class*="scroll"] [class*="prev"],
        .TimelineTabs [class*="scroll"] [class*="next"] {
          display: none !important;
        }

        /* Hide any navigation arrows that might appear */
        .TimelineTabs [class*="nav"],
        .TimelineTabs [class*="arrow"],
        .TimelineTabs [class*="button"][class*="prev"],
        .TimelineTabs [class*="button"][class*="next"] {
          display: none !important;
        }
      `;
    }

    style.textContent = css;
    
    document.head.appendChild(style);
  }
}

// Inject CSS immediately when script loads (before any content)
function injectImmediateCSS() {
  if (!isHomePage() || isExtensionDisabled() || !hasActiveSettings()) {
    return;
  }
  
  // Create a style element that will hide tabs as soon as they appear
  const immediateStyle = document.createElement('style');
  immediateStyle.id = 'x-immediate-css';
  
  // Only hide tabs if settings require it
  if (settings.hideForYou || settings.hideFollowing) {
    let css = '';

    if (settings.hideForYou) {
      css += `
        /* Hide first tab when hide for you is enabled */
        .TimelineTabs [role="tablist"] > [role="presentation"]:nth-child(1) {
          display: none !important;
        }
      `;
    }
    if (settings.hideFollowing) {
      css += `
        /* Hide second tab when hide following is enabled */
        .TimelineTabs [role="tablist"] > [role="presentation"]:nth-child(2) {
          display: none !important;
        }
      `;
    }
    
    // Hide ScrollSnap navigation arrows when tabs are hidden
    if (settings.hideForYou || settings.hideFollowing) {
      css += `
        /* Hide ScrollSnap navigation arrows when tabs are hidden */
        .TimelineTabs .ScrollSnap-List .ScrollSnap-prevButtonWrapper,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-nextButtonWrapper,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-prevButton,
        .TimelineTabs .ScrollSnap-List .ScrollSnap-nextButton {
          display: none !important;
        }
        
        /* Also hide any other scroll navigation elements */
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-prevButtonWrapper,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-nextButtonWrapper,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-prevButton,
        .TimelineTabs [data-testid="scroll-snap-list"] .ScrollSnap-nextButton,
        .TimelineTabs .ScrollSnap-prevButtonWrapper,
        .TimelineTabs .ScrollSnap-nextButtonWrapper,
        .TimelineTabs .ScrollSnap-prevButton,
        .TimelineTabs .ScrollSnap-nextButton {
          display: none !important;
        }
        
        /* Hide any scroll navigation arrows in the timeline tabs area */
        .TimelineTabs [class*="ScrollSnap"] [class*="prevButton"],
        .TimelineTabs [class*="ScrollSnap"] [class*="nextButton"],
        .TimelineTabs [class*="scroll"] [class*="prev"],
        .TimelineTabs [class*="scroll"] [class*="next"] {
          display: none !important;
        }
        
        /* Hide any navigation arrows that might appear */
        .TimelineTabs [class*="nav"],
        .TimelineTabs [class*="arrow"],
        .TimelineTabs [class*="button"][class*="prev"],
        .TimelineTabs [class*="button"][class*="next"] {
          display: none !important;
        }
      `;
    }
    
    immediateStyle.textContent = css;
    document.head.appendChild(immediateStyle);
  }
}

// Function to load settings from storage
function loadSettings() {
  chrome.storage.sync.get({
    extensionEnabled: true,
    hideForYou: false,
    hideFollowing: false,
    makeListDefault: false,
    makeFollowingDefault: false,
    selectedList: ''
  }, function(items) {
    settings = items;
    console.log('Settings loaded:', settings);
    
    // Check if extension is disabled
    if (isExtensionDisabled()) {
      console.log('Extension is disabled, cleaning up any existing CSS and stopping all functionality');
      cleanupCSS(); // Restore everything to default state
      return;
    }
    
    // Only proceed if settings are active
    if (hasActiveSettings()) {
      // Inject CSS based on settings
      injectHideCSS();
      
      // Inject immediate CSS based on settings
      injectImmediateCSS();
      
      // Handle initial page load immediately
      handleTabSelection();

      // Set up event listeners for user interactions
      handleTabClicks();

      // Observe DOM changes for dynamic content
      observeDOMChanges();

      // Start persistent Following enforcement if needed
      if (settings.makeFollowingDefault) {
        setTimeout(startFollowingEnforcement, 300);
      }
    } else {
      console.log('No active settings, cleaning up any existing CSS');
      cleanupCSS();
      stopFollowingEnforcement();
    }
  });
}

// Function to handle settings updates
function updateSettings(newSettings) {
  settings = newSettings;
  console.log('Settings updated:', settings);
  
  // Check if extension is disabled
  if (isExtensionDisabled()) {
    console.log('Extension is disabled, cleaning up and stopping all functionality');
    cleanupCSS(); // Restore everything to default state
    return;
  }
  
  // Clean up existing CSS first
  cleanupCSS();
  
  // Only proceed if settings are active
  if (hasActiveSettings()) {
    // Inject CSS based on new settings
    injectHideCSS();
    injectImmediateCSS();

    // Re-apply the current behavior based on new settings
    handleTabSelection();

    // Start or stop persistent Following enforcement
    if (settings.makeFollowingDefault) {
      // Give handleTabSelection a moment to fire the initial click first
      setTimeout(startFollowingEnforcement, 300);
    } else {
      stopFollowingEnforcement();
    }
  } else {
    stopFollowingEnforcement();
  }
}

// Function to actively hide ScrollSnap navigation elements
function hideScrollSnapElements() {
  if (!isHomePage() || isExtensionDisabled() || !hasActiveSettings() || (!settings.hideForYou && !settings.hideFollowing)) {
    return;
  }
  
  // Find the TimelineTabs area first
  const timelineTabs = document.querySelector('.TimelineTabs') || document.querySelector('[data-testid="primaryColumn"]');
  if (!timelineTabs) {
    return;
  }
  
  // Find all possible ScrollSnap navigation elements within the TimelineTabs area
  const selectors = [
    '.ScrollSnap-prevButtonWrapper',
    '.ScrollSnap-nextButtonWrapper',
    '.ScrollSnap-prevButton',
    '.ScrollSnap-nextButton',
    '[class*="ScrollSnap"][class*="prevButton"]',
    '[class*="ScrollSnap"][class*="nextButton"]',
    '[class*="scroll"][class*="prev"]',
    '[class*="scroll"][class*="next"]',
    '[class*="nav"][class*="prev"]',
    '[class*="nav"][class*="next"]',
    '[class*="arrow"][class*="prev"]',
    '[class*="arrow"][class*="next"]',
    '[class*="button"][class*="prev"]',
    '[class*="button"][class*="next"]',
    // More specific selectors for Twitter's ScrollSnap
    '[data-testid="scroll-snap-list"] [class*="prev"]',
    '[data-testid="scroll-snap-list"] [class*="next"]',
    '[data-testid="scroll-snap-list"] [class*="button"]',
    // General navigation arrows
    '[role="button"][aria-label*="previous"]',
    '[role="button"][aria-label*="next"]',
    '[role="button"][aria-label*="scroll"]'
  ];
  
  selectors.forEach(selector => {
    const elements = timelineTabs.querySelectorAll(selector);
    elements.forEach(element => {
      element.style.display = 'none';
      element.style.visibility = 'hidden';
      element.style.opacity = '0';
    });
  });
  
  // Also look for any elements with scroll-related classes within the TimelineTabs area
  const scrollElements = timelineTabs.querySelectorAll('[class*="ScrollSnap"], [class*="scroll"]');
  scrollElements.forEach(element => {
    const className = element.className || '';
    if (typeof className === 'string' && (className.includes('prev') || className.includes('next') || className.includes('button'))) {
      const computedStyle = window.getComputedStyle(element);
      const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
      
      if (isVisible) {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
      }
    }
  });
  
  // Also check for any elements that might be navigation arrows based on their attributes
  const potentialNavElements = timelineTabs.querySelectorAll('[role="button"], [class*="button"], [class*="nav"], [class*="arrow"]');
  potentialNavElements.forEach(element => {
    const ariaLabel = element.getAttribute('aria-label') || '';
    const className = element.className || '';
    const textContent = element.textContent || '';
    
    // Check if this element looks like a navigation arrow
    if (ariaLabel.toLowerCase().includes('previous') || 
        ariaLabel.toLowerCase().includes('next') || 
        ariaLabel.toLowerCase().includes('scroll') ||
        className.toLowerCase().includes('prev') ||
        className.toLowerCase().includes('next') ||
        textContent.includes('‹') ||
        textContent.includes('›') ||
        textContent.includes('←') ||
        textContent.includes('→')) {
      
      const computedStyle = window.getComputedStyle(element);
      const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
      
      if (isVisible) {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
      }
    }
  });
}

// Function to clean up CSS and restore default state
function cleanupCSS() {
  console.log('Cleaning up CSS and restoring default state');
  
  // Remove injected CSS styles
  const style = document.getElementById('x-tab-selector-css');
  if (style) {
    style.remove();
    console.log('Removed x-tab-selector-css');
  }
  
  const immediateStyle = document.getElementById('x-immediate-css');
  if (immediateStyle) {
    immediateStyle.remove();
    console.log('Removed x-immediate-css');
  }
  
  // Clear any remaining intervals (for backward compatibility)
  if (window.xScrollSnapInterval) {
    clearInterval(window.xScrollSnapInterval);
    window.xScrollSnapInterval = null;
  }
  
  // Reset DOM observer to allow re-initialization when returning to home page
  if (window.resetDOMObserver) {
    window.resetDOMObserver();
  }
  
  // Restore any hidden tabs to their default visible state across all tablists
  const tablists = document.querySelectorAll('[role="tablist"]');
  tablists.forEach((listEl) => {
    const tabPresentations = listEl.querySelectorAll('[role="presentation"]');
    tabPresentations.forEach((presentation, index) => {
      if (presentation && presentation.style && presentation.style.display === 'none') {
        presentation.style.display = '';
        console.log('Restored tab', index + 1, 'to visible state');
      }
    });
  });
  
  // Restore any hidden ScrollSnap navigation elements
  const timelineTabs = document.querySelector('.TimelineTabs') || document.querySelector('[data-testid="primaryColumn"]');
  if (timelineTabs) {
    const hiddenElements = timelineTabs.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]');
    hiddenElements.forEach(element => {
      const className = typeof element.className === 'string' ? element.className : '';
      if (className.includes('ScrollSnap') ||
          className.includes('scroll') ||
          className.includes('nav') ||
          className.includes('arrow') ||
          className.includes('button')) {
        element.style.display = '';
        element.style.visibility = '';
        element.style.opacity = '';
        console.log('Restored navigation element:', className);
      }
    });
  }

  // Restore Element.prototype.setAttribute if we overrode it
  if (window.__xSetAttributeOverridden && window.__xOriginalSetAttribute) {
    try {
      Element.prototype.setAttribute = window.__xOriginalSetAttribute;
    } catch (e) {}
    window.__xSetAttributeOverridden = false;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateSettings') {
    updateSettings(request.settings);
  }
  if (request.action === 'getLists') {
    const tablist = document.querySelector('[role="tablist"]');
    if (tablist) {
      const tabs = tablist.querySelectorAll('[role="tab"]');
      const lists = Array.from(tabs).slice(2).map(t => t.textContent.trim()).filter(Boolean);
      sendResponse({ lists });
    } else {
      sendResponse({ lists: [] });
    }
    return true;
  }
});

// Also respond to direct storage changes as a fallback so popup toggles work immediately
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName !== 'sync') return;
  const newSettings = { ...settings };
  Object.keys(changes).forEach((key) => {
    newSettings[key] = changes[key].newValue;
  });
  updateSettings(newSettings);
});

// Listen for URL changes and handle navigation
let currentUrl = window.location.href;
let urlChangeTimeout = null;
let hasInitializedOnThisPage = false;

// Function to handle URL changes
function handleUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    console.log('URL changed to:', newUrl);
    
    // Reset initialization flag for new page
    hasInitializedOnThisPage = false;
    
    // Reset DOM observer to allow re-initialization
    if (window.resetDOMObserver) {
      window.resetDOMObserver();
    }
    
    // Clear any existing timeout
    if (urlChangeTimeout) {
      clearTimeout(urlChangeTimeout);
    }
    
    if (isHomePage()) {
      console.log('Navigated to home page, checking if extension should initialize');
      // Check if extension is disabled first
      if (isExtensionDisabled()) {
        console.log('Extension is disabled, skipping initialization');
        cleanupCSS(); // Restore everything to default state
      } else if (hasActiveSettings()) {
        console.log('Active settings found, initializing extension');
        urlChangeTimeout = setTimeout(() => {
          init();
        }, 500);
      } else {
        console.log('No active settings, skipping initialization');
        cleanupCSS();
      }
    } else {
      console.log('Left home page, cleaning up CSS');
      cleanupCSS();
    }
  }
}

// Only set up URL monitoring if extension is enabled and settings are active
function setupUrlMonitoring() {
  // Monitor URL changes less frequently to avoid performance issues
  setInterval(handleUrlChange, 3000);
  
  // Also listen for browser navigation events
  window.addEventListener('popstate', handleUrlChange);
  
  // Listen for pushstate/replacestate (SPA navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(handleUrlChange, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(handleUrlChange, 100);
  };
}

// Main execution - check if extension is enabled FIRST before doing anything
chrome.storage.sync.get({
  extensionEnabled: true,
  hideForYou: false,
  hideFollowing: false,
  makeListDefault: false,
  makeFollowingDefault: false,
  selectedList: ''
}, function(items) {
  settings = items;
  console.log('Settings loaded:', settings);
  
  // If extension is disabled, do NOTHING - completely exit
  if (isExtensionDisabled()) {
    console.log('Extension is disabled - doing nothing at all');
    return;
  }
  
  // Only proceed if we have active settings
  if (hasActiveSettings()) {
    console.log('Extension is enabled and has active settings, starting up');
    
    // Load settings and set up everything
    loadSettings();
    
    // Set up URL monitoring
    setupUrlMonitoring();
    
    // Initialize if DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    
    // Also run initialization when page becomes visible
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && isHomePage() && !hasInitializedOnThisPage) {
        console.log('Page became visible on home page, initializing');
        setTimeout(init, 200);
      }
    });
    
    // Additional check for when content is loaded
    document.addEventListener('DOMContentLoaded', function() {
      if (isHomePage() && !hasInitializedOnThisPage) {
        console.log('DOM loaded on home page, checking for tabs');
        setTimeout(() => {
          const tablist = document.querySelector('[role="tablist"]');
          if (tablist) {
            console.log('Tablist found on page load, initializing');
            init();
          }
        }, 1000);
      }
    });
  } else {
    console.log('Extension is enabled but no active settings');
  }
});
