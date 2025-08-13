// ========================================================== Rewrite System Module ==========================================================

// Global state for tracking responses and current paragraph
let rewriteResponses = {};
let currentParagraphIndex = 0;

// Modal management variables
let originalZIndex;
const sidebarSelector = '.elementor-element-3189719';

// Initialize rewrite system
// Initialize rewrite system
function initializeRewriteSystem({
  displayResponse,
  onResponseGenerated,
  showLoader,
  hideLoader,
  originalContent,
  languageMap,
  getCurrentLanguage,
  HGF_ajax_object,
  dkHamdanCloseModal,
  clearHighlights,
  manuallyCloseMicButton
}) {
  // Store references to required functions
  window._rewriteSystem = {
    displayResponse,
    onResponseGenerated,
    showLoader,
    hideLoader,
    originalContent,
    languageMap,
    getCurrentLanguage,
    HGF_ajax_object,
    dkHamdanCloseModal,
    clearHighlights,
    manuallyCloseMicButton
  };

  function validateTextForToneChange() {
    if (!quill1.getText().trim().length) {
      return false;
    }
    return true;
  }

  // Add event listeners for rewrite buttons with null checks and text validation
  const convencingBtn = document.getElementById('convencing');
  if (convencingBtn) {
    convencingBtn.addEventListener('click', () => {
      if (!validateTextForToneChange()) return;
      handleRewrite('convencing');
    });
  } else {
    console.warn('Element with ID "convencing" not found');
  }

  const simplifyBtn = document.getElementById('simplify');
  if (simplifyBtn) {
    simplifyBtn.addEventListener('click', () => {
      if (!validateTextForToneChange()) return;
      handleRewrite('simplify');
    });
  } else {
    console.warn('Element with ID "simplify" not found');
  }

  const elaborateBtn = document.getElementById('elaborate');
  if (elaborateBtn) {
    elaborateBtn.addEventListener('click', () => {
      if (!validateTextForToneChange()) return;
      handleRewrite('elaborate');
    });
  } else {
    console.warn('Element with ID "elaborate" not found');
  }

  const conciseBtn = document.getElementById('concise');
  if (conciseBtn) {
    conciseBtn.addEventListener('click', () => {
      if (!validateTextForToneChange()) return;
      handleRewrite('concise');
    });
  } else {
    console.warn('Element with ID "concise" not found');
  }

  const professionalBtn = document.getElementById('professional');
  if (professionalBtn) {
    professionalBtn.addEventListener('click', () => {
      if (!validateTextForToneChange()) return;
      handleRewrite('professional');
    });
  } else {
    console.warn('Element with ID "professional" not found');
  }

  // Add navigation event listeners with null checks
  const arrowLeft = document.querySelector('.arrow-left');
  if (arrowLeft) {
    arrowLeft.addEventListener('click', () => {
      // console.log('Navigating to previous response...');
      navigateResponses('prev');
    });
  } else {
    console.warn('Element with class "arrow-left" not found');
  }

  const arrowRight = document.querySelector('.arrow-right');
  if (arrowRight) {
    arrowRight.addEventListener('click', () => {
      // console.log('Navigating to next response...');
      navigateResponses('next');
    });
  } else {
    console.warn('Element with class "arrow-right" not found');
  }

  // Handle custom rewrite input with null check
  const submitRewrite = document.getElementById('submint_rewrite');
  if (submitRewrite) {
    submitRewrite.addEventListener('click', () => {
      // FIRST: Check if main textarea (Quill editor) has content
      if (!validateTextForToneChange()) {
        return; // Do nothing if main textarea is empty
      }

      // SECOND: Check if custom input field has content
      const customInput = document.getElementById('custom_rewrite_input');
      const inputValue = customInput ? customInput.value.trim() : '';

      if (inputValue.length > 0) {
        // console.log('Custom rewrite submitted.');
        handleRewrite('custom');
      }
      // If custom input is empty, do nothing (button click has no effect)
    });
  } else {
    console.warn('Element with ID "submint_rewrite" not found');
  }

  // Add rewrite button modal trigger with null check
  const rewriteBtn = document.querySelector('#rewriteBtn');
  if (rewriteBtn) {
    rewriteBtn.addEventListener('click', () => {
      // console.log("clicked the rewrite button")
      window._rewriteSystem.clearHighlights();
      dkHamdanOpenModal(0);
    });
  } else {
    console.warn('Element with ID "rewriteBtn" not found');
  }

  // Attach the close function to the close button inside the modal with null check
  const closeButton = document.querySelector('.dk-hamdan-close-button');
  if (closeButton) {
    closeButton.addEventListener('click', dkHamdanCloseModal);
  } else {
    console.warn('Element with class "dk-hamdan-close-button" not found');
  }
}

// Handle rewrite button clicks
function handleRewrite(buttonId) {
  // console.log(`Rewrite button clicked: ${buttonId}`);
  // console.log('Sending rewrite request...');
  sendRewriteRequest(buttonId);
  window._rewriteSystem.dkHamdanCloseModal();
}

// Navigate through responses
function navigateResponses(direction) {
  const counter = document.querySelector('.response-counter');
  const matches = counter.textContent.match(/\d+/g);
  const [current, total] = matches ? matches.map(num => parseInt(num)) : [0, 0];

  if (direction === 'prev' && current > 1) {
    updateContent(current - 2);
  } else if (direction === 'next' && current < total) {
    updateContent(current);
  }
}

// Update content with specific response
function updateContent(responseIndex) {
  // console.log(`Updating content to response index: ${responseIndex}`);

  // Ensure rewriteResponses exists for current paragraph
  if (!rewriteResponses[currentParagraphIndex]) {
    rewriteResponses[currentParagraphIndex] = {
      responses: []
    };
  }

  const responses = rewriteResponses[currentParagraphIndex].responses;

  if (responses && responses[responseIndex]) {
    window._rewriteSystem.displayResponse(responses[responseIndex]);

    // Call adjustHeights if it exists globally
    if (typeof adjustHeights === 'function') {
      adjustHeights();
    }

    // Update counter
    const counter = document.querySelector('.response-counter');
    counter.textContent = `Tekst ${responseIndex + 1} ud af ${responses.length}`;

    // console.log('Content and counter updated successfully');
  } else {
    console.warn('Response not found for index:', responseIndex);
  }
}

// Reset navigation text and state
function resetNavText() {
  const rewriteNavDiv = document.querySelector('.response-navigation');
  const counterNav = document.querySelector('.counter-nav-div');

  rewriteNavDiv.style.display = 'none';
  rewriteResponses = {};
  counterNav.style.justifyContent = 'center';
  const counter = document.querySelector('.response-counter');
  counter.textContent = `Tekst 1 ud af 1`;
}

// Show navigation UI
function showNavigation() {
  const rewriteNavDiv = document.querySelector('.response-navigation');
  const counterNav = document.querySelector('.counter-nav-div');

  rewriteNavDiv.style.display = 'flex';
  counterNav.style.display = 'flex';
  counterNav.style.justifyContent = 'flex-start';
  document.querySelector('.correction-options').style.marginTop = '1.5rem';
}

// Send rewrite request to server
function sendRewriteRequest(buttonId) {
  // console.log(`Sending rewrite request with buttonId: ${buttonId}`);

  const {
    originalContent,
    showLoader,
    hideLoader,
    displayResponse,
    onResponseGenerated,
    languageMap,
    getCurrentLanguage,
    HGF_ajax_object
  } = window._rewriteSystem;

  // Ensure showLoader and hideLoader are bound properly
  const boundShowLoader = showLoader.bind(window.textAreaLoader);
  const boundHideLoader = hideLoader.bind(window.textAreaLoader);

  const currentText = originalContent.html;
  // console.log("Text sending to rewrite\n", currentText)

  boundShowLoader('.textarea-wrapper', 'Omskriver teksten...');

  if (!rewriteResponses[currentParagraphIndex]) {
    rewriteResponses[currentParagraphIndex] = {
      responses: [currentText]
    };
    // console.log('Initialized response storage for the current paragraph index.');
  }

  const formData = new FormData();
  formData.append('action', 'hgf_rewrite_grammer_bot');
  formData.append('current_text', currentText);

  let langForRewrite =
    Object.keys(languageMap).find(key => languageMap[key] === getCurrentLanguage()) ||
    getCurrentLanguage();
  // console.log("language for rewrite", langForRewrite)
  formData.append('language', langForRewrite);

  switch (buttonId) {
    case 'simplify': // Uformel
      formData.append('prompt_index', '0');
      break;
    case 'elaborate': // Personlig
      formData.append('prompt_index', '1');
      break;
    case 'convencing': // Neutral
      formData.append('prompt_index', '2');
      break;
    case 'concise': // Høflig
      formData.append('prompt_index', '3');
      break;
    case 'professional': // Professionel
      formData.append('prompt_index', '4');
      break;
    default:
      formData.append('prompt_index', '2'); // Default to Neutral
      break;
  }

  const customInput = document.getElementById('custom_rewrite_input');
  if (customInput?.value) {
    formData.append('rewrite_prompt', customInput.value);
    // console.log('Custom rewrite prompt provided:', customInput.value);
  }

  // Debug form data
  for (var pair of formData.entries()) {
    // console.log(pair[0] + ', ' + pair[1]);
  }

  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams(formData)
  })
    .then(response => {
      // console.log('Server response received.');
      return response.text();
    })
    .then(text => {
      // console.log('Response text:', text);
      try {
        return JSON.parse(text);
      } catch (error) {
        console.error('Failed to parse response:', error);
        throw new Error('Invalid response format');
      }
    })
    .then(data => {
      // console.log('Parsed response data:', data);
      if (data.success) {
        const content = data.data;
        // console.log("rewrite content:\n", content);
        const removeRegex = content.replace(/\\/g, '');
        // console.log("rewrite content after regex:\n", removeRegex);

        displayResponse(removeRegex);
        onResponseGenerated(removeRegex);
        showNavigation();

        // Store response and update counter
        rewriteResponses[currentParagraphIndex].responses.push(content);
        const responseCount = rewriteResponses[currentParagraphIndex].responses.length;
        document.querySelector('.response-counter').textContent =
          `Tekst ${responseCount} ud af ${responseCount}`;

        // console.log('Rewrite successful. Updated corrections display and counter.');
      } else {
        console.error('Error:', data.data?.message || 'Unknown error');
      }
    })
    .catch(error => {
      console.error('Request failed:', error);
    })
    .finally(() => {
      boundHideLoader('.textarea-wrapper');
      // console.log('Request completed.');
    });
}

// Get current rewrite responses (for external access)
function getCurrentRewriteResponses() {
  return rewriteResponses;
}

// Get current paragraph index (for external access)
function getCurrentParagraphIndex() {
  return currentParagraphIndex;
}

// Set current paragraph index (for external access)
function setCurrentParagraphIndex(index) {
  currentParagraphIndex = index;
}

// Reset rewrite responses
function resetRewriteResponses() {
  rewriteResponses = {};
  currentParagraphIndex = 0;
}

// =========================================== Rewrite Modal Management ==========================================

// Function to open the modal
function dkHamdanOpenModal(index) {
  // console.log("object index", index);

  const modal = document.querySelector('.dk-hamdan-modal-container');
  modal.style.display = 'block';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.zIndex = '1000';

  // Add overlay to capture outside clicks
  const overlay = document.createElement('div');
  overlay.className = 'dk-hamdan-modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '999';
  document.body.appendChild(overlay);

  document.getElementById('custom_rewrite_input').value = '';
  // Close modal when clicking outside
  overlay.addEventListener('click', dkHamdanCloseModal);

  // Hide sidebar by changing its z-index
  const sidebar = document.querySelector(sidebarSelector);
  if (sidebar) {
    originalZIndex = window.getComputedStyle(sidebar).zIndex;
    sidebar.style.zIndex = '1';
  }
  toggleClearIcon(document.getElementById('custom_rewrite_input'));
}

// Function to close the modal
function dkHamdanCloseModal() {
  const modal = document.querySelector('.dk-hamdan-modal-container');
  const overlay = document.querySelector('.dk-hamdan-modal-overlay');
  modal.style.display = 'none';
  if (overlay) {
    document.body.removeChild(overlay);
  }
  // Restore sidebar's original z-index
  const sidebar = document.querySelector(sidebarSelector);
  if (sidebar) {
    sidebar.style.zIndex = originalZIndex;
  }

  window._rewriteSystem.manuallyCloseMicButton('micButton2');
}

// Function shows the icon in the input field
function toggleClearIcon(input) {
  const icon = input.nextElementSibling; // Select the clear icon
  if (input.value.trim() !== '') {
    icon.style.display = 'inline'; // Show icon
  } else {
    icon.style.display = 'none'; // Hide icon
  }
}

// Export functions
export {
  initializeRewriteSystem,
  handleRewrite,
  sendRewriteRequest,
  navigateResponses,
  updateContent,
  showNavigation,
  resetNavText,
  getCurrentRewriteResponses,
  getCurrentParagraphIndex,
  setCurrentParagraphIndex,
  resetRewriteResponses,
  dkHamdanOpenModal,
  dkHamdanCloseModal,
  toggleClearIcon
};
