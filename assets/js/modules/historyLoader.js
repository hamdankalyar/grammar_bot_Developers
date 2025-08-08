/**
 * History Loader Module
 * Handles loading states for history-related operations
 */

class HistoryLoader {
  constructor() {
    this.activeLoaders = new Set();
  }

  /**
   * Show dotted loader for history operations
   * @param {string} containerId - ID of the container element
   * @param {string} loaderClass - Class name for the loader backdrop ('loader1' or 'loader2')
   */
  showHistoryLoader(containerId, loaderClass = 'loader1') {
    const container = document.getElementById(containerId) || document.querySelector(containerId);
    if (!container) {
      console.warn(`History loader container not found: ${containerId}`);
      return;
    }

    // Remove existing loader if present
    this.hideHistoryLoader(containerId);

    // Create loader backdrop
    const loaderBackdrop = document.createElement('div');
    loaderBackdrop.className = loaderClass;
    loaderBackdrop.dataset.loaderId = containerId;

    // Create dotted loader
    const dottedLoader = document.createElement('div');
    dottedLoader.className = 'dotted-loader';

    // Create 8 dots
    for (let i = 1; i <= 8; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      dottedLoader.appendChild(dot);
    }

    loaderBackdrop.appendChild(dottedLoader);
    container.appendChild(loaderBackdrop);
    
    this.activeLoaders.add(containerId);
  }

  /**
   * Hide history loader
   * @param {string} containerId - ID of the container element
   */
  hideHistoryLoader(containerId) {
    const container = document.getElementById(containerId) || document.querySelector(containerId);
    if (!container) return;

    const loaders = container.querySelectorAll('.loader1, .loader2');
    loaders.forEach(loader => {
      if (loader.dataset.loaderId === containerId) {
        loader.remove();
      }
    });

    this.activeLoaders.delete(containerId);
  }

  /**
   * Show loading state for button containers (with spinning icon)
   * @param {HTMLElement|string} buttonContainer - Button container element or selector
   */
  showButtonLoading(buttonContainer) {
    const container = typeof buttonContainer === 'string' 
      ? document.querySelector(buttonContainer) 
      : buttonContainer;
    
    if (!container) return;

    container.classList.add('loading');
  }

  /**
   * Hide loading state for button containers
   * @param {HTMLElement|string} buttonContainer - Button container element or selector
   */
  hideButtonLoading(buttonContainer) {
    const container = typeof buttonContainer === 'string' 
      ? document.querySelector(buttonContainer) 
      : buttonContainer;
    
    if (!container) return;

    container.classList.remove('loading');
  }

  /**
   * Hide all active history loaders
   */
  hideAllLoaders() {
    this.activeLoaders.forEach(containerId => {
      this.hideHistoryLoader(containerId);
    });
    
    // Remove all loading states from button containers
    document.querySelectorAll('.button-container.loading').forEach(container => {
      container.classList.remove('loading');
    });
  }

  /**
   * Check if any history loaders are active
   * @returns {boolean}
   */
  hasActiveLoaders() {
    return this.activeLoaders.size > 0;
  }
}

// Create and export singleton instance
const historyLoader = new HistoryLoader();

// Export for ES6 modules
export default historyLoader;

// Export for CommonJS/global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = historyLoader;
}

// Global fallback
if (typeof window !== 'undefined') {
  window.historyLoader = historyLoader;
}