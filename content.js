// Helper function to select a tab without causing scrolling
function selectTab(tab) {
  if (!tab) return;
  
  // Get all tabs in the same tablist
  const tablist = tab.closest('[role="tablist"]');
  if (!tablist) return;
  
  const tabs = tablist.querySelectorAll('[role="tab"]');
  
  // Set all tabs to unselected
  tabs.forEach(t => {
    t.setAttribute('aria-selected', 'false');
    t.classList.remove('active', 'selected', 'r-1kihuf0');
  });
  
  // Select the target tab
  tab.setAttribute('aria-selected', 'true');
  tab.classList.add('r-1kihuf0');
  
  // Store current scroll position
  const scrollY = window.scrollY;
  
  // Try to trigger the tab selection using multiple approaches
  try {
    // Approach 1: Try to use the tab's native click method with scroll prevention
    if (typeof tab.click === 'function') {
      // Temporarily override scrollTo to prevent scrolling
      const originalScrollTo = window.scrollTo;
      const originalScrollBy = window.scrollBy;
      
      window.scrollTo = function() {
        // Do nothing - prevent scrolling
      };
      window.scrollBy = function() {
        // Do nothing - prevent scrolling
      };
      
      // Trigger the click
      tab.click();
      
      // Restore the original scroll methods
      window.scrollTo = originalScrollTo;
      window.scrollBy = originalScrollBy;
    } else {
      // Approach 2: Create and dispatch a click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1
      });
      tab.dispatchEvent(clickEvent);
    }
    
    // Approach 3: Also try to trigger focus for good measure
    const focusEvent = new FocusEvent('focus', {
      bubbles: true,
      cancelable: true
    });
    tab.dispatchEvent(focusEvent);
    
  } catch (error) {
    console.log('Error triggering tab selection:', error);
  }
  
  // Restore scroll position if it changed significantly
  if (Math.abs(window.scrollY - scrollY) > 10) {
    window.scrollTo(0, scrollY);
  }
  
  console.log('Selected tab:', tab.textContent.trim());
}

// Function to handle tab selection based on settings
function handleTabSelectionWithSettings() {
  // Only run on home page
  if (!isHomePage()) {
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
  if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
    setTimeout(() => {
      hideScrollSnapElements();
    }, 100);
    
    // Also check periodically for any new ScrollSnap elements
    const scrollSnapInterval = setInterval(() => {
      if (!isHomePage() || (!settings.onlyShowLists && !settings.hideForYou && !settings.hideFollowing)) {
        clearInterval(scrollSnapInterval);
        return;
      }
      hideScrollSnapElements();
    }, 1000);
    
    // Store the interval for cleanup
    window.xScrollSnapInterval = scrollSnapInterval;
  }
  
  // Find the first visible tab to select
  let firstVisibleTab = null;
  
  // If makeListDefault is enabled, try to select the 3rd tab (lists tab)
  if (settings.makeListDefault && tabs.length >= 3) {
    const thirdTab = tabs[2];
    const thirdTabParent = thirdTab.closest('[role="presentation"]');
    if (thirdTabParent && thirdTabParent.style.display !== 'none') {
      firstVisibleTab = thirdTab;
      console.log('makeListDefault enabled: selecting 3rd tab (lists tab)');
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
    // Use the helper function to select the tab
    selectTab(firstVisibleTab);
    return true;
  }
  
  return false;
}

// Function to handle tab selection with retry mechanism
function handleTabSelection() {
  let attempts = 0;
  const maxAttempts = 10; // Reduced attempts to avoid excessive retrying
  
  const trySelectTab = () => {
    attempts++;
    
    const result = handleTabSelectionWithSettings();
    if (result === true) {
      return; // Success or no tabs to select (both are valid outcomes)
    }
    
    if (attempts < maxAttempts) {
      // Retry with longer delays to avoid excessive retrying
      setTimeout(trySelectTab, attempts < 3 ? 100 : 200);
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
    // Only handle clicks on home page
    if (!isHomePage()) {
      return;
    }
    
    // Check if the clicked element is a tab
    const clickedTab = event.target.closest('[role="tab"]');
    if (clickedTab) {
      const tablist = clickedTab.closest('[role="tablist"]');
      if (tablist) {
        const tabs = tablist.querySelectorAll('[role="tab"]');
        const tabIndex = Array.from(tabs).indexOf(clickedTab);
        
        // Handle "Only show lists" setting
        if (settings.onlyShowLists) {
          // If user clicks on hidden tabs (first or second), redirect to 3rd tab
          if (tabIndex === 0 || tabIndex === 1) {
            console.log('User clicked on hidden tab, redirecting to 3rd tab');
            event.preventDefault();
            event.stopPropagation();
            
            const thirdTab = tabs[2];
            if (thirdTab) {
              selectTab(thirdTab);
            }
            return;
          }
        } else {
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
        }
        
        // Note: makeListDefault only affects initial tab selection, not user clicks
        // Users should be able to freely click on any tab after the initial selection
      }
      
      // User clicked on a valid tab, allow it
      console.log('User clicked on a valid tab, allowing user selection');
    }
  });
  
  // Intercept any programmatic attempts to select the first or second tab
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'aria-selected' && value === 'true') {
      // Check if this is a tab and if it's the first or second tab
      if (this.getAttribute('role') === 'tab') {
        const tablist = this.closest('[role="tablist"]');
        if (tablist) {
          const tabs = tablist.querySelectorAll('[role="tab"]');
          const tabIndex = Array.from(tabs).indexOf(this);
          
          // If this is the first tab (index 0) or second tab (index 1) and we want to select it
          if ((tabIndex === 0 || tabIndex === 1) && tabs.length >= 3) {
            // Only redirect if onlyShowLists is enabled (not for makeListDefault)
            if (settings.onlyShowLists) {
              console.log('Preventing tab', tabIndex + 1, 'selection, redirecting to 3rd tab');
              // Instead of selecting the first or second tab, select the 3rd tab
              const thirdTab = tabs[2];
              if (thirdTab) {
                // Call the original setAttribute on the 3rd tab instead
                return originalSetAttribute.call(thirdTab, name, value);
              }
            }
          }
        }
      }
    }
    
    // Call the original setAttribute for all other cases
    return originalSetAttribute.call(this, name, value);
  };
}

// Function to observe DOM changes and handle dynamic content
function observeDOMChanges() {
  let reinitializeTimeout = null;
  let checkTabsTimeout = null;
  
  const observer = new MutationObserver((mutations) => {
    // Only observe on home page
    if (!isHomePage()) {
      return;
    }
    
    let shouldCheckTabs = false;
    let shouldReinitialize = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if tablist was added or modified
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector('[role="tablist"]')) {
              shouldCheckTabs = true;
              shouldReinitialize = true;
            }
          }
        });
        
        // Also check if any tab elements were added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector('[role="tab"]')) {
              shouldCheckTabs = true;
            }
          }
        });
        
        // IMMEDIATELY hide any tabs that should be hidden
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tabs = node.querySelectorAll && node.querySelectorAll('[role="tab"]');
            if (tabs && tabs.length > 0) {
              // Immediately hide tabs based on settings
              if (settings.onlyShowLists) {
                if (tabs[0]) {
                  const parentDiv = tabs[0].closest('[role="presentation"]');
                  if (parentDiv) {
                    parentDiv.style.display = 'none';
                  }
                }
                if (tabs[1]) {
                  const parentDiv = tabs[1].closest('[role="presentation"]');
                  if (parentDiv) {
                    parentDiv.style.display = 'none';
                  }
                }
              } else {
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
              }
            }
            
            // Hide ScrollSnap navigation arrows if they're added
            const scrollSnapElements = node.querySelectorAll && node.querySelectorAll('.ScrollSnap-prevButtonWrapper, .ScrollSnap-nextButtonWrapper, .ScrollSnap-prevButton, .ScrollSnap-nextButton, [class*="ScrollSnap"][class*="prevButton"], [class*="ScrollSnap"][class*="nextButton"]');
            if (scrollSnapElements && scrollSnapElements.length > 0 && (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing)) {
              scrollSnapElements.forEach(element => {
                element.style.display = 'none';
              });
            }
            
            // Also call the comprehensive hide function
            if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
              setTimeout(() => {
                hideScrollSnapElements();
              }, 50);
            }
          }
        });
      }
    });
    
    if (shouldReinitialize) {
      // Re-initialize when tablist is found (likely navigation to home)
      console.log('Tablist found, re-initializing extension');
      
      // Clear any existing timeout
      if (reinitializeTimeout) {
        clearTimeout(reinitializeTimeout);
      }
      
      reinitializeTimeout = setTimeout(() => {
        init();
      }, 200);
    }
    
    if (shouldCheckTabs) {
      // Clear any existing timeout
      if (checkTabsTimeout) {
        clearTimeout(checkTabsTimeout);
      }
      
      // Immediate check for faster response
      handleTabSelection();
      // Also check again after a short delay to ensure everything is loaded
      checkTabsTimeout = setTimeout(handleTabSelection, 100);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Global settings object
let settings = {
  onlyShowLists: false,
  hideForYou: false,
  hideFollowing: false,
  makeListDefault: false
};

// Initialize the extension
function init() {
  console.log('X.com Third Tab Selector initialized');
  
  // Check if we're on the home page
  if (!isHomePage()) {
    console.log('Not on home page, skipping initialization');
    return;
  }
  
  // Clean up any existing CSS first
  cleanupCSS();
  
  // Load settings first, then inject CSS based on settings
  loadSettings();
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
  // Only inject CSS on home page
  if (!isHomePage()) {
    return;
  }
  
  // Only inject CSS if settings require it
  if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
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
    if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
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
  if (!isHomePage()) {
    return;
  }
  
  // Create a style element that will hide tabs as soon as they appear
  const immediateStyle = document.createElement('style');
  immediateStyle.id = 'x-immediate-css';
  
  // Only hide tabs if settings require it
  if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
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
    if (settings.onlyShowLists || settings.hideForYou || settings.hideFollowing) {
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
    onlyShowLists: false,
    hideForYou: false,
    hideFollowing: false,
    makeListDefault: false
  }, function(items) {
    settings = items;
    console.log('Settings loaded:', settings);
    
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
  });
}

// Function to handle settings updates
function updateSettings(newSettings) {
  settings = newSettings;
  console.log('Settings updated:', settings);
  
  // Clean up existing CSS
  cleanupCSS();
  
  // Inject CSS based on new settings
  injectHideCSS();
  injectImmediateCSS();
  
  // Re-apply the current behavior based on new settings
  handleTabSelection();
}

// Function to actively hide ScrollSnap navigation elements
function hideScrollSnapElements() {
  if (!isHomePage() || (!settings.onlyShowLists && !settings.hideForYou && !settings.hideFollowing)) {
    return;
  }
  
  console.log('Hiding ScrollSnap navigation elements');
  
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
      console.log('Hidden ScrollSnap element:', selector, element);
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
        console.log('Hidden potential ScrollSnap element:', className, element);
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
        console.log('Hidden navigation element:', ariaLabel, className, textContent, element);
      }
    }
  });
}

// Function to clean up CSS when leaving home page
function cleanupCSS() {
  const style = document.getElementById('x-tab-selector-css');
  if (style) {
    style.remove();
  }
  
  const immediateStyle = document.getElementById('x-immediate-css');
  if (immediateStyle) {
    immediateStyle.remove();
  }
  
  // Clear ScrollSnap interval
  if (window.xScrollSnapInterval) {
    clearInterval(window.xScrollSnapInterval);
    window.xScrollSnapInterval = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateSettings') {
    updateSettings(request.settings);
  }
});

// Listen for URL changes and handle navigation
let currentUrl = window.location.href;
let urlChangeTimeout = null;

// Function to handle URL changes
function handleUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    console.log('URL changed to:', newUrl);
    
    // Clear any existing timeout
    if (urlChangeTimeout) {
      clearTimeout(urlChangeTimeout);
    }
    
    if (isHomePage()) {
      console.log('Navigated to home page, initializing extension');
      // Small delay to ensure DOM is ready, but don't reinitialize too frequently
      urlChangeTimeout = setTimeout(() => {
        init();
      }, 200);
    } else {
      console.log('Left home page, cleaning up CSS');
      cleanupCSS();
    }
  }
}

// Monitor URL changes less frequently to avoid performance issues
setInterval(handleUrlChange, 2000);

// Also listen for browser navigation events
window.addEventListener('popstate', handleUrlChange);

// Listen for pushstate/replacestate (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  setTimeout(handleUrlChange, 50);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  setTimeout(handleUrlChange, 50);
};

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also run initialization when page becomes visible (for direct navigation)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && isHomePage()) {
    console.log('Page became visible on home page, re-initializing');
    setTimeout(init, 100);
  }
});

// Additional check for when content is loaded (for SPA navigation)
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on home page after content loads
  if (isHomePage()) {
    console.log('DOM loaded on home page, checking for tabs');
    setTimeout(() => {
      const tablist = document.querySelector('[role="tablist"]');
      if (tablist) {
        console.log('Tablist found on page load, initializing');
        init();
      }
    }, 500);
  }
});
