/**
 * Correction Sidebar Loader Module
 * Handles gradient loading animations for correction sidebar operations
 */

class CorrectionSidebarLoader {
  constructor() {
    this.activeLoaders = new Map();
    this.lottieLoadAnimation = null; // Will be injected from main app

    // Animation URLs for different states
    this.animationUrls = {
      ready: 'https://login.skrivsikkert.dk/wp-content/uploads/2025/06/robot-wave.json',
      loading: 'https://login.skrivsikkert.dk/wp-content/uploads/2025/08/robot-loading-loop-1.json',
      success: 'https://login.skrivsikkert.dk/wp-content/uploads/2025/08/robot-comfirmed.json'
    };
  }

  /**
   * Set the lottie animation function
   * @param {Function} lottieFunc - Function to load lottie animations
   */
  setLottieFunction(lottieFunc) {
    this.lottieLoadAnimation = lottieFunc;
  }

  /**
   * Load specific animation based on state
   * @param {string} state - Animation state ('ready', 'loading', 'success')
   * @param {HTMLElement|string} container - Container element or selector
   */
  loadAnimationByState(state = 'ready', container = '#gif') {
    if (!this.lottieLoadAnimation) return;

    // Get container element
    const containerEl = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!containerEl) {
      console.warn(`Animation container not found: ${container}`);
      return;
    }

    // Clear existing animation and any previous lottie instances
    containerEl.innerHTML = '';

    // Also destroy any existing lottie instance
    if (containerEl._lottieInstance) {
      containerEl._lottieInstance.destroy();
      containerEl._lottieInstance = null;
    }

    // Load new animation
    const animationUrl = this.animationUrls[state] || this.animationUrls.ready;
    this.lottieLoadAnimation(containerEl, animationUrl);
  }

  /**
   * Show gradient loader in correction message
   * @param {string} selector - CSS selector for the container (.correction-message)
   * @param {string} text - Text to display (optional)
   */
  showCorrectionLoader(selector, text = 'Analyzing...') {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Correction loader container not found: ${selector}`);
      return;
    }
    document.getElementById('genBtn').disabled = true;
    // Check if toggleState is false, return early
    if (typeof window !== 'undefined' && window.toggleState === false) {
      return;
    }

    const correctionContent = document.querySelector('.correction-content');
    if (!correctionContent) return;

    // Remove has-explanations class if it exists
    if (correctionContent.classList.contains('has-explanations')) {
      correctionContent.classList.remove('has-explanations');
    }

    // Set the loader content with loading state
    correctionContent.innerHTML = `
  <div class="hamdan-speech-bubble">
    <div class="gradient-loader"></div>
    <span>Arbejder...</span>
  </div>
  <div class="hamdan-robot-container">
    <div id="gif"></div>
  </div>
  <div class="legend-section" id="legend-section">
    <div class="legend-item">
      <div class="legend-dot change"></div>
      <span class="legend-text">Rettet eller tilføjet</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot add"></div>
      <span class="legend-text">Komma og punktum</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot remove"></div>
      <span class="legend-text">Slettet</span>
    </div>
  </div>
  <div class="correction-message" style="display: none">
    <span>Jeg er klar!</span>
  </div>
`;

    // Load loading animation
    this.loadAnimationByState('loading', '#gif');

    this.activeLoaders.set(selector, { element, text });
  }

  /**
   * Hide correction loader
   * @param {string} selector - CSS selector for the container
   */
  hideCorrectionLoader(selector) {
    const loader = document.querySelector('.gradient-loader');
    if (loader) {
      loader.remove();
    }

    // Change text back to "Jeg er klar!" when hiding correction-message loader
    const messageSpan = document.querySelector('.hamdan-speech-bubble');
    if (messageSpan) {
      messageSpan.textContent = 'Jeg er klar!';
      // Load ready animation when text changes back
      this.loadAnimationByState('ready', '#gif');
    }
    document.getElementById('genBtn').disabled = false;
    this.activeLoaders.delete(selector);
  }

  /**
   * Show/hide smart analysis loader
   * @param {boolean} flag - true to show, false to hide
   */
  toggleSmartLoader(flag) {
    // Check if toggleState is false, return early
    if (typeof window !== 'undefined' && window.toggleState === false) {
      return;
    }

    // Handle demo-inner section (initial state)
    const demoInnerBubble = document.querySelector(
      '.correction-inner .demo-inner .hamdan-speech-bubble'
    );

    // Handle correction-inner-main section (analysis results)
    const mainBubble = document.querySelector('.correction-inner-main .hamdan-speech-bubble');

    if (flag) {
      // Show working state
      if (demoInnerBubble) {
        demoInnerBubble.textContent = 'Arbejder...';
        // Find gif container in demo-inner and load loading animation
        const demoGifContainer = document.querySelector('.correction-inner .demo-inner #gif');
        if (demoGifContainer) {
          this.loadAnimationByState('loading', demoGifContainer);
        }
      }
      if (mainBubble) {
        mainBubble.textContent = 'Arbejder...';
        // Find gif container in correction-inner-main and load loading animation
        const mainGifContainer = document.querySelector('.correction-inner-main .hamdan-robot-container #gif');
        if (mainGifContainer) {
          this.loadAnimationByState('loading', mainGifContainer);
        }
      }
    } else {
      // Hide working state
      if (demoInnerBubble) {
        demoInnerBubble.textContent = 'Jeg er klar!';
        // Load ready animation
        const demoGifContainer = document.querySelector('.correction-inner .demo-inner #gif');
        if (demoGifContainer) {
          this.loadAnimationByState('ready', demoGifContainer);
        }
      }
      if (mainBubble) {
        mainBubble.textContent = 'Jeg er klar!';
        // Load ready animation
        const mainGifContainer = document.querySelector('.correction-inner-main .hamdan-robot-container #gif');
        if (mainGifContainer) {
          this.loadAnimationByState('ready', mainGifContainer);
        }
      }
    }
  }

  /**
   * Update correction content with "ready" state
   */
  showReadyState() {
    const correctionContent = document.querySelector('.correction-content');
    if (!correctionContent) return;

    // Remove has-explanations class if it exists
    if (correctionContent.classList.contains('has-explanations')) {
      correctionContent.classList.remove('has-explanations');
    }

    correctionContent.innerHTML = `
<div class="hamdan-speech-bubble">Jeg er klar!</div>
<div class="hamdan-robot-container">
  <div id="gif"></div>
</div>
<div class="legend-section" id="legend-section">
  <div class="legend-item">
    <div class="legend-dot change"></div>
    <span class="legend-text">Rettet eller tilføjet</span>
  </div>
  <div class="legend-item">
    <div class="legend-dot add"></div>
    <span class="legend-text">Komma og punktum</span>
  </div>
  <div class="legend-item">
    <div class="legend-dot remove"></div>
    <span class="legend-text">Slettet</span>
  </div>
</div>
<div class="correction-message" style="display: none">
  <span>Jeg er klar!</span>
</div>
`;

    // Load ready animation specifically in the correction-content gif container
    const gifContainer = correctionContent.querySelector('#gif');
    if (gifContainer) {
      this.loadAnimationByState('ready', gifContainer);
    }
  }

  /**
   * Show "perfect" state for no changes
   */
  showPerfectState() {
    const correctionContent = document.querySelector('.correction-content');
    if (!correctionContent) return;

    if (correctionContent.classList.contains('has-explanations')) {
      correctionContent.classList.remove('has-explanations');
    }

    correctionContent.innerHTML = `
  <div class="hamdan-speech-bubble">
    <span>Teksten er korrekt!</span>
  </div>
  <div class="hamdan-robot-container">
    <div id="gif"></div>
  </div>
  
  <div class="correction-message" style="display: none">
    <span>Jeg er klar!</span>
  </div>
`;

    // Load success animation for "Teksten er korrekt" state
    this.loadAnimationByState('success', '#gif');
  }

  /**
   * Check if any correction loaders are active
   * @returns {boolean}
   */
  hasActiveLoaders() {
    return this.activeLoaders.size > 0;
  }

  /**
   * Hide all active correction loaders
   */
  hideAllLoaders() {
    this.activeLoaders.forEach((_, selector) => {
      this.hideCorrectionLoader(selector);
    });
    this.toggleSmartLoader(false);
  }

  /**
   * Get list of active loaders
   * @returns {Array<string>}
   */
  getActiveLoaders() {
    return Array.from(this.activeLoaders.keys());
  }
}

// Create and export singleton instance
const correctionSidebarLoader = new CorrectionSidebarLoader();

// Export for ES6 modules
export default correctionSidebarLoader;

// Export for CommonJS/global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = correctionSidebarLoader;
}

// Global fallback
if (typeof window !== 'undefined') {
  window.correctionSidebarLoader = correctionSidebarLoader;
}