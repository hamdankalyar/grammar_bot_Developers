/**
 * Text Area Loader Module
 * Handles bubble loading animations for textarea operations
 */

class TextAreaLoader {
  constructor() {
    this.activeLoaders = new Map();
  }

  /**
   * Show bubble loader in textarea wrapper
   * @param {string} selector - CSS selector for the container
   * @param {string} text - Loading text to display
   */
  showTextAreaLoader(selector, text = 'Loading...') {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`TextArea loader container not found: ${selector}`);
      return;
    }
    // Remove existing loader if present
    this.hideTextAreaLoader(selector);
    document.getElementById('genBtn').disabled = true;
    document.getElementById('genBtn').style.pointerEvents = 'none';
    document.getElementById('genBtn').style.cursor = 'not-allowed';
    document.getElementById('genBtn').classList.add('disabled-gen-btn');
    // Create loader backdrop
    const loaderBackdrop = document.createElement('div');
    loaderBackdrop.className = 'loader-backdrop';
    loaderBackdrop.dataset.selector = selector;

    // Create bubble loader container
    const bubbleLoader = document.createElement('div');
    bubbleLoader.className = 'bubble-loader';

    // Create 4 bubbles
    for (let i = 1; i <= 4; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubbleLoader.appendChild(bubble);
    }

    // Create loader text
    const loaderText = document.createElement('span');
    loaderText.className = 'loader-text';
    loaderText.textContent = text;

    // Assemble loader
    loaderBackdrop.appendChild(bubbleLoader);
    loaderBackdrop.appendChild(loaderText);

    element.appendChild(loaderBackdrop);
    this.activeLoaders.set(selector, { element, text });
  }

  /**
   * Hide textarea loader
   * @param {string} selector - CSS selector for the container
   */
  hideTextAreaLoader(selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    document.getElementById('genBtn').disabled = false;
    document.getElementById('genBtn').style.pointerEvents = 'auto';
    document.getElementById('genBtn').style.cursor = 'pointer';
    document.getElementById('genBtn').classList.remove('disabled-gen-btn');
    // Create loader backdrop
    const loaders = element.querySelectorAll('.loader-backdrop');
    loaders.forEach(loader => {
      if (loader.dataset.selector === selector) {
        loader.remove();
      }
    });

    this.activeLoaders.delete(selector);
  }

  /**
   * Update loader text
   * @param {string} selector - CSS selector for the container
   * @param {string} newText - New text to display
   */
  updateLoaderText(selector, newText) {
    const element = document.querySelector(selector);
    if (!element) return;

    const loader = element.querySelector('.loader-backdrop[data-selector="' + selector + '"]');
    if (loader) {
      const textElement = loader.querySelector('.loader-text');
      if (textElement) {
        textElement.textContent = newText;

        // Update stored text
        if (this.activeLoaders.has(selector)) {
          this.activeLoaders.get(selector).text = newText;
        }
      }
    }
  }

  /**
   * Check if loader is active for a specific selector
   * @param {string} selector - CSS selector to check
   * @returns {boolean}
   */
  isLoaderActive(selector) {
    return this.activeLoaders.has(selector);
  }

  /**
   * Get current loader text
   * @param {string} selector - CSS selector for the container
   * @returns {string|null}
   */
  getCurrentText(selector) {
    const loaderData = this.activeLoaders.get(selector);
    return loaderData ? loaderData.text : null;
  }

  /**
   * Hide all active textarea loaders
   */
  hideAllLoaders() {
    this.activeLoaders.forEach((_, selector) => {
      this.hideTextAreaLoader(selector);
    });
  }

  /**
   * Get list of active loaders
   * @returns {Array<string>}
   */
  getActiveLoaders() {
    return Array.from(this.activeLoaders.keys());
  }

  /**
   * Check if any textarea loaders are active
   * @returns {boolean}
   */
  hasActiveLoaders() {
    return this.activeLoaders.size > 0;
  }
}

// Create and export singleton instance
const textAreaLoader = new TextAreaLoader();

// Export for ES6 modules
export default textAreaLoader;

// Export for CommonJS/global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = textAreaLoader;
}

// Global fallback
if (typeof window !== 'undefined') {
  window.textAreaLoader = textAreaLoader;
}
