/**
 * Correction Sidebar Loader Module
 * Handles gradient loading animations for correction sidebar operations
 */

class CorrectionSidebarLoader {
  constructor() {
    this.activeLoaders = new Map();
    this.lottieLoadAnimation = null; // Will be injected from main app
  }

  /**
   * Set the lottie animation function
   * @param {Function} lottieFunc - Function to load lottie animations
   */
  setLottieFunction(lottieFunc) {
    this.lottieLoadAnimation = lottieFunc;
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

    // Set the loader content
    correctionContent.innerHTML = `
  <div class="hamdan-speech-bubble">Arbejder...</div>
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

    // Load lottie animation if function is available
    if (this.lottieLoadAnimation) {
      this.lottieLoadAnimation();
    }

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
    if (messageSpan) messageSpan.textContent = 'Jeg er klar!';
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
      if (demoInnerBubble) demoInnerBubble.textContent = 'Arbejder...';
      if (mainBubble) mainBubble.textContent = 'Arbejder...';
    } else {
      // Hide working state
      if (demoInnerBubble) demoInnerBubble.textContent = 'Jeg er klar!';
      if (mainBubble) mainBubble.textContent = 'Jeg er klar!';
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

    // Load lottie animation if function is available
    if (this.lottieLoadAnimation) {
      this.lottieLoadAnimation();
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
  <svg width="24px" height="24px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.98 88.05">
                      <g>
                          <path d="M41.57.34c6.69-1.76,7.85,3.87,12.64,4.85,3.28.67,7.09-.29,10.29.13,4.97.65,4.75,6.88,7.75,10.12,2.7,2.92,8.88,3.67,10.07,6.31,1.25,2.78-.16,8.61.56,12.1.77,3.76,4.95,5.52,5.12,9.83.19,5.12-4.28,6.51-5.12,10.6-.79,3.86,1.02,10.07-1.23,12.91-1.76,2.21-6.31,2.54-9.02,5.12-2.86,2.72-3.73,8.91-6.31,10.07-2.78,1.25-8.61-.16-12.1.56-3.76.77-5.52,4.95-9.83,5.12-5.12.19-6.51-4.28-10.6-5.12-3.86-.79-10.07,1.02-12.91-1.23-2.21-1.76-2.54-6.31-5.12-9.02-2.72-2.86-8.91-3.73-10.07-6.31-1.25-2.78.16-8.61-.56-12.1C4.35,50.51.17,48.76,0,44.45c-.19-5.12,4.28-6.51,5.12-10.6.67-3.28-.29-7.09.13-10.29.65-4.97,6.88-4.75,10.12-7.75,2.92-2.7,3.67-8.88,6.31-10.07,2.78-1.25,8.61.16,12.1-.56,3.11-.64,5.45-4.24,7.79-4.85Z" style="fill:#096;" />
                          <path d="M58.67,29.32c-3.81.84-17.48,17.7-18.77,17.7-3.08-2.28-7.5-9.17-11.23-9.65-4.36-.56-7.31,2.39-5.94,6.72.33,1.04,12.97,14.21,14.15,14.89,1.55.89,3.35,1.08,5.1.55,3.46-1.05,18.85-19.76,23.03-23.11,2.05-4.73-1.53-8.17-6.34-7.11Z" style="fill:#fff;" />
                      </g>
                  </svg><span>Teksten er korrekt</span>
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

    // Load lottie animation if function is available
    if (this.lottieLoadAnimation) {
      this.lottieLoadAnimation();
    }
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
