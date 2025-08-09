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
  
  // Find the first visible tab to select
  let firstVisibleTab = null;
  for (let i = 0; i < tabs.length; i++) {
    const parentDiv = tabs[i].closest('[role="presentation"]');
    if (parentDiv && parentDiv.style.display !== 'none') {
      firstVisibleTab = tabs[i];
      break;
    }
  }
  
  if (firstVisibleTab) {
    // Set all tabs to unselected
    tabs.forEach(tab => {
      tab.setAttribute('aria-selected', 'false');
      tab.classList.remove('active', 'selected', 'r-1kihuf0');
    });
    
    // Select the first visible tab
    firstVisibleTab.setAttribute('aria-selected', 'true');
    firstVisibleTab.classList.add('r-1kihuf0');
    firstVisibleTab.click();
    console.log('Selected first visible tab:', firstVisibleTab.textContent.trim());
    return true;
  }
  
  return false;
}

// Function to handle tab selection with retry mechanism
function handleTabSelection() {
  let attempts = 0;
  const maxAttempts = 20; // Increased attempts for more aggressive retrying
  
  const trySelectTab = () => {
    attempts++;
    
    const result = handleTabSelectionWithSettings();
    if (result === true) {
      return; // Success or no tabs to select (both are valid outcomes)
    }
    
    if (attempts < maxAttempts) {
      // Retry with shorter delays for faster response
      setTimeout(trySelectTab, attempts < 5 ? 25 : 50);
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
              thirdTab.click();
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
              tabs[i].click();
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
                tabs[i].click();
                return;
              }
            }
            return;
          }
        }
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
    
    // Call the original setAttribute for all other cases
    return originalSetAttribute.call(this, name, value);
  };
}

// Function to observe DOM changes and handle dynamic content
function observeDOMChanges() {
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
          }
        });
      }
    });
    
    if (shouldReinitialize) {
      // Re-initialize when tablist is found (likely navigation to home)
      console.log('Tablist found, re-initializing extension');
      setTimeout(() => {
        init();
      }, 100);
    }
    
    if (shouldCheckTabs) {
      // Immediate check for faster response
      handleTabSelection();
      // Also check again after a short delay to ensure everything is loaded
      setTimeout(handleTabSelection, 50);
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
  hideFollowing: false
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
    
    immediateStyle.textContent = css;
    document.head.appendChild(immediateStyle);
  }
}

// Function to load settings from storage
function loadSettings() {
  chrome.storage.sync.get({
    onlyShowLists: false,
    hideForYou: false,
    hideFollowing: false
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
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateSettings') {
    updateSettings(request.settings);
  }
});

// Listen for URL changes and handle navigation
let currentUrl = window.location.href;

// Function to handle URL changes
function handleUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    console.log('URL changed to:', newUrl);
    
    if (isHomePage()) {
      console.log('Navigated to home page, initializing extension');
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        init();
      }, 100);
    } else {
      console.log('Left home page, cleaning up CSS');
      cleanupCSS();
    }
  }
}

// Monitor URL changes
setInterval(handleUrlChange, 1000);

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
