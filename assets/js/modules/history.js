// =========================================================== History/Saved Responses Module ===========================================================

// Global variables for history management
let isOpeningPopup = false;
let originalZIndex;

// DOM selectors
const sidebarSelector = '.elementor-element-3abd86dc';
const popupSelector = '#savedResponsesPopup';
const popupContentSelector = '.popup-content';

// Function to save response
function saveResponse(response) {
  response = response.replace(/\\/g, '');
  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body:
      'action=hgf_korrektur_save_response&response=' +
      encodeURIComponent(response) +
      '&nonce=' +
      HGF_ajax_object.nonce
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // console.log('Response saved successfully');
        if (document.getElementById('savedResponsesPopup').style.display === 'flex') {
          displaySavedResponses();
        }
      } else {
        console.error('Failed to save response');
      }
    })
    .catch(error => console.error('Error:', error));
}

// Function to get saved responses via AJAX
function getSavedResponses() {
  // console.log('inside the saved responses function');
  return fetch(
    HGF_ajax_object.ajax_url +
      '?action=hgf_korrektur_get_user_responses&nonce=' +
      HGF_ajax_object.nonce
  )
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        return data.data.responses;
      } else {
        console.error('Failed to get responses');
        return [];
      }
    })
    .catch(error => {
      console.error('Error:', error);
      return [];
    });
}

// Function to delete a specific response
function deleteResponse(responseId) {
  historyLoader(true);
  // Find the delete button associated with this response ID
  const deleteButton = document.querySelector(`.delete-btns[data-id="${responseId}"]`);
  const buttonContainer = deleteButton.closest('.button-container');

  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body:
      'action=hgf_korrektur_delete_response&response_id=' +
      responseId +
      '&nonce=' +
      HGF_ajax_object.nonce
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Refresh the list of saved responses
        displaySavedResponses();
      } else {
        console.error('Failed to delete response');
      }
    })
    .catch(error => {
      console.error('Error:', error);
    })
    .finally(() => {
      // Remove the loading animation after completion
      buttonContainer.classList.remove('loading');
    });
}

// Convert HTML to Markdown using TurndownService
function convertHtmlToMarkdown(html) {
  // console.log("in the html to markdown function");
  // console.log("content of html: " + html);
  var turndownService = new TurndownService();
  return turndownService.turndown(html);
}

// Format markdown output
function formatMarkdownOutput(htmlContent) {
  return `<div class="markdown-body">${htmlContent}</div>`;
}

// Handle response generation and save it
function onResponseGenerated(newResponse) {
  // Remove all backslashes from the newResponse
  // console.log("newResponse", newResponse);
  const html = marked.parse(newResponse);
  const safeHTML = DOMPurify.sanitize(html);

  let cleanedResponse = convertHtmlToMarkdown(safeHTML);
  // console.log("after removing backslashes", cleanedResponse);
  // Pass the cleaned response to saveResponse
  saveResponse(cleanedResponse);
}

// History loader function
function historyLoader(flag) {
  // console.log("inside loader", flag);
  const loader1 = document.querySelector('.loader1');
  const popupContent = document.querySelector('.popup-content');

  if (!loader1 || !popupContent) {
    console.error('Loader or popup content not found');
    return;
  }

  // console.log("here are loader and content", loader1, popupContent);
  if (flag) {
    loader1.style.display = 'flex';
    // popupContent.style.overflowY = 'hidden';
  } else {
    loader1.style.display = 'none';
    // popupContent.style.overflowY = 'scroll';
  }
}

// Display saved responses in the popup
function displaySavedResponses() {
  // console.log("in the history")
  historyLoader(true);
  getSavedResponses()
    .then(savedResponses => {
      const savedResponsesList = document.getElementById('savedResponsesList');
      const clearHistoryButton = document.getElementById('deleteAllHistory');
      savedResponsesList.innerHTML = '';

      if (savedResponses.length === 0) {
        savedResponsesList.innerHTML = '<p>Ingen gemte svar endnu.</p>';
        clearHistoryButton.style.display = 'none';
        historyLoader(false);
        return;
      } else {
        clearHistoryButton.style.display = 'flex';
      }

      savedResponses.forEach((response, index) => {
        const responseElement = document.createElement('div');
        responseElement.className = 'saved-response';

        // Decode the response text
        let decodedResponse = response.response;

        responseElement.innerHTML = `
                <div class="textarea-container">
                    <div class="response-text-area no-min-height" contenteditable="false"></div>
                </div>
                <div class="button-container">
                    <p class="copy-btn1" data-index="${index}">
                        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" class="copy-icon" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_373_2280)">
                            <path d="M7.5 12.5C7.5 10.143 7.5 8.96447 8.23223 8.23223C8.96447 7.5 10.143 7.5 12.5 7.5L13.3333 7.5C15.6904 7.5 16.8689 7.5 17.6011 8.23223C18.3333 8.96447 18.3333 10.143 18.3333 12.5V13.3333C18.3333 15.6904 18.3333 16.8689 17.6011 17.6011C16.8689 18.3333 15.6904 18.3333 13.3333 18.3333H12.5C10.143 18.3333 8.96447 18.3333 8.23223 17.6011C7.5 16.8689 7.5 15.6904 7.5 13.3333L7.5 12.5Z" stroke="#929292" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14.1665 7.49984C14.1646 5.03559 14.1273 3.75918 13.41 2.88519C13.2715 2.71641 13.1167 2.56165 12.9479 2.42314C12.026 1.6665 10.6562 1.6665 7.91663 1.6665C5.17706 1.6665 3.80727 1.6665 2.88532 2.42314C2.71654 2.56165 2.56177 2.71641 2.42326 2.88519C1.66663 3.80715 1.66663 5.17694 1.66663 7.9165C1.66663 10.6561 1.66663 12.0259 2.42326 12.9478C2.56177 13.1166 2.71653 13.2714 2.88531 13.4099C3.7593 14.1271 5.03572 14.1645 7.49996 14.1664" stroke="#929292" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                            <clipPath id="clip0_373_2280">
                            <rect width="20" height="20" fill="white"/>
                            </clipPath>
                            </defs>
                        </svg>
                    </p>
                        <svg width="19" height="19" viewBox="0 0 19 16" fill="none" class="tick-btn1" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                            <path d="M17.717 2.4933C18.0728 3.41378 17.5739 4.044 16.6082 4.66478C15.8291 5.16566 14.8364 5.70829 13.7846 6.63598C12.7535 7.54541 11.7472 8.64078 10.8529 9.71889C9.96223 10.7926 9.20522 11.8218 8.67035 12.5839C8.32471 13.0764 7.84234 13.8109 7.84234 13.8109C7.50218 14.3491 6.89063 14.6749 6.23489 14.6667C5.57901 14.6585 4.97657 14.3178 4.65113 13.7711C3.81924 12.3735 3.1773 11.8216 2.88226 11.6234C2.09282 11.0928 1.1665 11.0144 1.1665 9.77812C1.1665 8.79631 1.99558 8.0004 3.0183 8.0004C3.74035 8.02706 4.41149 8.31103 5.00613 8.71063C5.38625 8.96607 5.78891 9.30391 6.20774 9.74862C6.69929 9.07815 7.29164 8.30461 7.95566 7.5041C8.91998 6.34155 10.0582 5.09441 11.2789 4.0178C12.4788 2.95945 13.8662 1.96879 15.3367 1.445C16.2956 1.10347 17.3613 1.57281 17.717 2.4933Z" stroke="#929292" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    <p class="delete-btns" data-id="${response.id}">
                        <svg width="19" height="19" viewBox="0 0 20 22" fill="none" class="delete-icon" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.5 4.5L16.8803 14.5251C16.7219 17.0864 16.6428 18.3671 16.0008 19.2879C15.6833 19.7431 15.2747 20.1273 14.8007 20.416C13.8421 21 12.559 21 9.99274 21C7.42312 21 6.1383 21 5.17905 20.4149C4.7048 20.1257 4.296 19.7408 3.97868 19.2848C3.33688 18.3626 3.25945 17.0801 3.10461 14.5152L2.5 4.5" stroke="#929292" stroke-width="1.5" stroke-linecap="round"></path>
                            <path d="M1 4.5H19M14.0557 4.5L13.3731 3.09173C12.9196 2.15626 12.6928 1.68852 12.3017 1.39681C12.215 1.3321 12.1231 1.27454 12.027 1.2247C11.5939 1 11.0741 1 10.0345 1C8.96883 1 8.43598 1 7.99568 1.23412C7.8981 1.28601 7.80498 1.3459 7.71729 1.41317C7.32164 1.7167 7.10063 2.20155 6.65861 3.17126L6.05292 4.5" stroke="#929292" stroke-width="1.5" stroke-linecap="round"></path>
                            <path d="M7.5 15.5L7.5 9.5" stroke="#929292" stroke-width="1.5" stroke-linecap="round"></path>
                            <path d="M12.5 15.5L12.5 9.5" stroke="#929292" stroke-width="1.5" stroke-linecap="round"></path>
                        </svg>
                    </p>
                </div>
            `;

        savedResponsesList.appendChild(responseElement);

        // Get the content div and parse the markdown
        const contentDiv = responseElement.querySelector('.response-text-area');
        try {
          // If marked is available, use it to parse markdown
          if (typeof marked !== 'undefined') {
            // console.log("in the marked content of the display history", decodedResponse);
            contentDiv.innerHTML = formatMarkdownOutput(marked.parse(decodedResponse));
            // console.log("what is inide the contentdiv.innerHTML", contentDiv.innerHTML);
            // console.log("this is is the marked reposne of history", formatMarkdownOutput(marked.parse(decodedResponse)));
          } else {
            // Otherwise just set the content directly
            contentDiv.innerHTML = decodedResponse;
          }
        } catch (e) {
          console.error('Error parsing markdown:', e);
          contentDiv.innerHTML = decodedResponse;
        }

        // Adjust the div height similar to textarea
        adjustHistoryDivHeight(contentDiv);
      });

      // Add event listeners for buttons
      attachCopyAndDeleteEventListeners(savedResponses);

      // Move historyLoader(false) here so it only runs after everything is done
      historyLoader(false);
    })
    .catch(error => {
      console.error('Error fetching saved responses:', error);
      historyLoader(false); // Make sure we hide the loader even if there's an error
    });
}

// Helper function to adjust contenteditable div height
function adjustHistoryDivHeight(div) {
  // Reset height to auto first to get the correct scrollHeight
  div.style.height = 'auto';

  // Set the height to the scrollHeight
  div.style.height = div.scrollHeight + 'px';

  // Add some padding if needed
  if (div.scrollHeight > 100) {
    div.style.overflowY = 'auto';
    // div.style.maxHeight = '300px';
  } else {
    div.style.overflowY = 'hidden';
  }
}

// Attach copy and delete event listeners
function attachCopyAndDeleteEventListeners(savedResponses) {
  // Function to detect if the user is on a mobile device
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  // Function to replace colons with semicolons for mobile devices
  function processTextForMobile(text) {
    return isMobileDevice() ? text.replace(/:/g, ';') : text;
  }

  // Function to process HTML content for mobile devices
  function processHtmlForMobile(html) {
    if (!isMobileDevice()) return html;

    // Create a temporary container to parse and modify the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Process text nodes to replace colons with semicolons
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);

    let node;
    while ((node = walker.nextNode())) {
      node.textContent = node.textContent.replace(/:/g, ';');
    }

    // Also process style attributes
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      if (el.hasAttribute('style')) {
        let style = el.getAttribute('style');
        // Replace colons in style values but preserve the colon after property names
        style = style.replace(/([a-z-]+):(.*?)(;|$)/gi, (match, prop, value, end) => {
          return prop + ':' + value.replace(/:/g, ';') + end;
        });
        el.setAttribute('style', style);
      }
    });

    return tempDiv.innerHTML;
  }

  // Helper function to replace heading tags with strong tags
  function replaceHeadingsWithStrong(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Find all heading tags (h1, h2, h3, h4, h5, h6)
    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach(heading => {
      // Create a new strong element
      const strong = document.createElement('strong');

      // Copy all attributes from heading to strong (if any)
      Array.from(heading.attributes).forEach(attr => {
        strong.setAttribute(attr.name, attr.value);
      });

      // Copy the inner HTML content
      strong.innerHTML = heading.innerHTML;

      // Replace the heading with the strong element
      heading.parentNode.replaceChild(strong, heading);
    });

    return tempDiv.innerHTML;
  }

  // Helper function to clean HTML content - removes background color, font size, and font family
  function cleanHTMLForCopy(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // First, replace heading tags with strong tags
    const htmlWithStrongTags = replaceHeadingsWithStrong(tempDiv.innerHTML);
    tempDiv.innerHTML = htmlWithStrongTags;

    // Remove background color, font size, and font family from all elements
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      el.style.backgroundColor = '';
      el.style.fontSize = '';
      el.style.fontFamily = '';

      // Also remove these properties from the style attribute
      if (el.hasAttribute('style')) {
        let style = el.getAttribute('style');
        style = style.replace(/background(-color)?:[^;]+;?/gi, '');
        style = style.replace(/font-size:[^;]+;?/gi, '');
        style = style.replace(/font-family:[^;]+;?/gi, '');
        style = style.replace(/color:[^;]+;?/gi, ''); // Remove font color
        if (style.trim() === '') {
          el.removeAttribute('style');
        } else {
          el.setAttribute('style', style);
        }
      }
    });

    // For mobile devices, replace colons with semicolons
    if (isMobileDevice()) {
      return processHtmlForMobile(tempDiv.innerHTML);
    }

    return tempDiv.innerHTML;
  }

  // Function to show the tick icon
  function showTickIcon(button) {
    button.style.display = 'none';
    button.nextElementSibling.style.display = 'flex';

    // Hide the tick icon after 2 seconds
    setTimeout(() => {
      button.style.display = 'flex';
      button.nextElementSibling.style.display = 'none';
    }, 2000);
  }

  // Copy buttons
  document.querySelectorAll('.copy-btn1').forEach(button => {
    button.addEventListener('click', function () {
      const responseContainer =
        this.closest('.saved-response').querySelector('.response-text-area');

      try {
        // Set up a one-time copy event listener for this specific copy operation
        const copyListener = e => {
          // Get the HTML content of the selection
          const fragment = document.getSelection().getRangeAt(0).cloneContents();
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(fragment);

          // Clean the HTML content (this will also replace headings with strong tags)
          const cleanedHTML = cleanHTMLForCopy(tempDiv.innerHTML);

          // Set the modified HTML as the clipboard data
          e.clipboardData.setData('text/html', cleanedHTML);

          // For plain text, handle mobile device case specifically
          let textContent = tempDiv.textContent;
          if (isMobileDevice()) {
            textContent = processTextForMobile(textContent);
          }
          e.clipboardData.setData('text/plain', textContent);

          // Prevent the default copy behavior
          e.preventDefault();

          // Remove this one-time listener
          document.removeEventListener('copy', copyListener);
        };

        // Add the listener
        document.addEventListener('copy', copyListener);

        // Use the selection method since we're dealing with already rendered content
        const range = document.createRange();
        range.selectNodeContents(responseContainer);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Execute copy command (this works the same as manual Ctrl+C)
        document.execCommand('copy');

        // Clear selection
        selection.removeAllRanges();

        // Show the tick icon
        showTickIcon(this);
      } catch (err) {
        console.error('Failed to copy with selection method:', err);

        // Fallback to clipboard API if selection method fails
        try {
          // Get the HTML content directly from the displayed response
          const htmlContent = responseContainer.innerHTML;

          // Clean the HTML content (this will also replace headings with strong tags)
          const cleanedHTML = cleanHTMLForCopy(htmlContent);

          // Create HTML blob with cleaned styling
          const htmlBlob = new Blob(
            [
              '<!DOCTYPE html><html><head>',
              '<style>',
              // Include only essential markdown styles, avoiding font family, size, and backgrounds
              '.markdown-body {line-height: 1.5;}',
              '.markdown-body strong {font-weight: 600;}',
              '.markdown-body p {margin-top: 0; margin-bottom: 16px;}',
              '</style>',
              '</head><body>',
              cleanedHTML,
              '</body></html>'
            ],
            { type: 'text/html' }
          );

          // Plain text as fallback
          let textContent = responseContainer.textContent;
          // For mobile devices, replace colons with semicolons
          if (isMobileDevice()) {
            textContent = processTextForMobile(textContent);
          }
          const textBlob = new Blob([textContent], { type: 'text/plain' });

          // Use clipboard API
          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });

          navigator.clipboard.write([clipboardItem]).then(() => {
            // Show the tick icon
            showTickIcon(this);
          });
        } catch (fallbackErr) {
          console.error('All rich copy methods failed, using plain text:', fallbackErr);

          // Final fallback to plain text
          let textContent = responseContainer.textContent;
          // For mobile devices, replace colons with semicolons
          if (isMobileDevice()) {
            textContent = processTextForMobile(textContent);
          }
          navigator.clipboard.writeText(textContent).then(() => {
            // Show the tick icon
            showTickIcon(this);
          });
        }
      }
    });
  });

  // Also add a global copy listener for manual selection copying
  document.addEventListener('copy', e => {
    // Only handle copy events if they weren't already handled by our button click handler
    if (e.defaultPrevented) return;

    // Check if the selection is within a response text area
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectionRange = selection.getRangeAt(0);
    const container = selectionRange.commonAncestorContainer;

    // Check if the selection is inside a response-text-area
    const isInResponseArea =
      (container.closest && container.closest('.response-text-area')) ||
      (container.parentNode &&
        container.parentNode.closest &&
        container.parentNode.closest('.response-text-area'));

    if (isInResponseArea) {
      // Get the HTML content of the selection
      const fragment = selectionRange.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      // Clean the HTML (this will also replace headings with strong tags)
      const cleanedHTML = cleanHTMLForCopy(tempDiv.innerHTML);

      // Set the modified HTML as the clipboard data
      e.clipboardData.setData('text/html', cleanedHTML);

      // For plain text, handle mobile device case specifically
      let textContent = tempDiv.textContent;
      if (isMobileDevice()) {
        textContent = processTextForMobile(textContent);
      }
      e.clipboardData.setData('text/plain', textContent);

      // Prevent the default copy behavior
      e.preventDefault();
    }
  });

  // Delete buttons
  document.querySelectorAll('.delete-btns').forEach(button => {
    button.addEventListener('click', function () {
      const id = this.getAttribute('data-id');
      deleteResponse(id).then(() => {
        displaySavedResponses();
      });
    });
  });
}

// Open popup function
function openPopup() {
  // console.log("opening popup");
  if (isOpeningPopup) {
    return;
  }
  isOpeningPopup = true;
  const sidebar = document.querySelector(sidebarSelector);
  const popup = document.querySelector(popupSelector);

  if (sidebar && popup) {
    originalZIndex = window.getComputedStyle(sidebar).zIndex;
    popup.style.zIndex = '9999999';
    sidebar.style.zIndex = '0';
    popup.style.display = 'flex';
    // console.log("popup called")
    displaySavedResponses();
  }
}

// Close popup function
function closePopup() {
  const sidebar = document.querySelector(sidebarSelector);
  const popup = document.querySelector(popupSelector);

  if (sidebar && popup) {
    // sidebar.style.zIndex = originalZIndex;
    sidebar.style.zIndex = '1';
    popup.style.zIndex = '';
    popup.style.display = 'none';
  }
  isOpeningPopup = false;
}

// Handle clicks on the document to close the popup if clicked outside
function handleDocumentClick(event) {
  const popup = document.querySelector(popupSelector);
  const popupContent = document.querySelector(popupContentSelector);
  const showSavedResponsesBtn = document.getElementById('showSavedResponsesBtn');

  if (showSavedResponsesBtn.contains(event.target)) {
    openPopup();
    return;
  }

  if (event.target.closest('.delete-btns')) {
    return; // Don't close the popup if clicking on a delete button
  }

  if (popup.style.display === 'flex' && !popupContent.contains(event.target)) {
    closePopup();
  }
}

// Initialize history functionality
function initializeHistory() {
  console.log('DeleteAllHistory element:', document.getElementById('deleteAllHistory'));

  // Add CSS to ensure proper textarea behavior
  const style = document.createElement('style');
  style.textContent = `
        .textarea-container {
            width: 100%;
            margin-bottom: 10px;
        }

        .response-textarea {
            width: 100%;
            min-height: 50px;
            padding: 8px;
            border: none;
            background: transparent;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
            resize: none;
            overflow: hidden;
        }

        .response-textarea:focus {
            outline: none;
        }

        .button-container {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 7px;
        }
    `;
  document.head.appendChild(style);

  // Event listener for show saved responses button
  document.addEventListener('DOMContentLoaded', function () {
    const showBtn = document.getElementById('showSavedResponsesBtn');
    if (showBtn) {
      showBtn.addEventListener('click', openPopup);
      // console.log("Event listener attached to showSavedResponsesBtn");
    }
  });

  // Event listener for close button
  const closeBtn = document.querySelector('.grammar-history-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closePopup);
  }

  // Event listener for document clicks (outside popup)
  document.addEventListener('click', handleDocumentClick);

  document.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('#deleteAllHistory');
    if (!deleteBtn) return;

    console.log('Delete All History clicked'); // DEBUG
    historyLoader(true);

    fetch(HGF_ajax_object.ajax_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'action=hgf_korrektur_delete_all_user_responses&nonce=' + HGF_ajax_object.nonce
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          displaySavedResponses();
        } else {
          console.error('Failed to delete responses:', data.data);
        }
      })
      .catch(err => console.error('Error:', err))
      .finally(() => historyLoader(false));
  });

  // Add resize handler for textareas
  window.addEventListener('resize', () => {
    const textareas = document.querySelectorAll('.response-textarea');
    textareas.forEach(textarea => {
      adjustHistoryTextareaHeight(textarea);
    });
  });
}

// Helper function to adjust history textarea height (if needed)
function adjustHistoryTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// Export functions for use in main file
export {
  saveResponse,
  getSavedResponses,
  deleteResponse,
  onResponseGenerated,
  displaySavedResponses,
  attachCopyAndDeleteEventListeners,
  historyLoader,
  openPopup,
  closePopup,
  handleDocumentClick,
  initializeHistory,
  adjustHistoryDivHeight,
  formatMarkdownOutput,
  convertHtmlToMarkdown
};
