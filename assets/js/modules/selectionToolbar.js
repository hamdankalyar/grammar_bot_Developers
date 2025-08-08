// selectionToolbar.js - Selection Toolbar Module

// Import functions from global scope that this module depends on
// These functions should be available globally or passed as dependencies
const getDependencies = () => ({
  removeHamDanTags: window.removeHamDanTags || (() => text => text),
  removeMarkTags: window.removeMarkTags || (() => text => text),
  processHtmlForCopy: window.processHtmlForCopy || (() => html => html),
  isMobileDevice: window.isMobileDevice || (() => false),
  processHtmlForMobile: window.processHtmlForMobile || (() => html => html),
  processTextForMobile: window.processTextForMobile || (() => text => text),
  quillHtmlToPlainTextWithParagraphs:
    window.quillHtmlToPlainTextWithParagraphs || (() => html => html),
  SB_ajax_object: window.SB_ajax_object,
  HGF_ajax_object: window.HGF_ajax_object,
  getCurrentLanguage: window.getCurrentLanguage || (() => 'da')
});

// QuillSelectionToolbar Class
class QuillSelectionToolbar {
  constructor(quillInstance) {
    this.quill = quillInstance;
    this.toolbar = null;
    this.isVisible = false;
    this.selectedText = '';
    this.selectedHtml = '';
    this.playbackSpeed = 1.0;
    this.currentAudio = null;
    this.isPlaying = false;
    this.isLoading = false;
    this.isPaused = false;
    this.selectedGender = 'female'; // Always female
    this.currentLanguage = 'da';
    this.audioBlob = null;
    this.speedExpanded = false;
    this.scrollHandler = null; // Track scroll handler for cleanup
    this.isSelecting = false; // Track if we're currently selecting text
    this.ttsRequestInProgress = false; // Flag to prevent multiple concurrent requests

    console.log('QuillSelectionToolbar initialized with:', quillInstance);
    this.init();
  }

  init() {
    this.createToolbar();
    this.bindEvents();

    // Add periodic validation to ensure toolbar doesn't get stuck
    this.validationInterval = setInterval(() => {
      if (this.isVisible && !this.validateCurrentSelection()) {
        console.log('Periodic validation: hiding invalid toolbar');
        this.hideToolbar();
      }
    }, 1000); // Check every second

    console.log('Selection toolbar created and events bound');
  }

  createToolbar() {
    // Remove any existing toolbar
    const existing = document.getElementById('selection-toolbar');
    if (existing) {
      existing.remove();
    }

    // Create the floating toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'selection-toolbar';
    this.toolbar.style.cssText = `
            position: absolute;
            background: #F5F5F5;
            border: 1px solid #B3B3B3;
            border-radius: 8px;
            padding: 6px;
            display: none;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            gap: 6px;
            align-items: center;
            font-family: Arial, sans-serif;
            min-height: 47px;
            pointer-events: auto;
        `;

    // TTS Button (cycles through states)
    this.ttsButton = document.createElement('button');
    this.ttsButton.innerHTML = `<svg class="lucide-volume-2" width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M11.6666 10.3448V5.65555C11.6666 3.03455 11.6666 1.72405 10.8955 1.39791C10.1244 1.07177 9.21692 1.99844 7.40189 3.85176C6.46195 4.81153 5.92567 5.02407 4.58832 5.02407C3.41877 5.02407 2.83399 5.02407 2.41392 5.31068C1.54192 5.90562 1.67373 7.06849 1.67373 8.00016C1.67373 8.93184 1.54192 10.0947 2.41392 10.6896C2.83399 10.9763 3.41877 10.9763 4.58832 10.9763C5.92567 10.9763 6.46195 11.1888 7.40189 12.1486C9.21692 14.0019 10.1244 14.9286 10.8955 14.6024C11.6666 14.2763 11.6666 12.9658 11.6666 10.3448Z" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M14.1666 5.5C14.6878 6.18306 15 7.05287 15 8C15 8.94713 14.6878 9.81694 14.1666 10.5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M16.6666 3.8335C17.709 4.97193 18.3333 6.42161 18.3333 8.00016C18.3333 9.57872 17.709 11.0284 16.6666 12.1668" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>`;
    this.ttsButton.title = 'Læs højt';
    this.ttsButton.style.cssText = `
            border: none;
            background: #F5F5F5;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            min-width: 36px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;

    // Speed Control Container - this will hold both views
    this.speedContainer = document.createElement('div');
    this.speedContainer.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            height: 30px;
        `;

    // Main Speed Display (shows current speed when collapsed)
    this.speedDisplay = document.createElement('button');
    this.speedDisplay.textContent = '1x';
    this.speedDisplay.style.cssText = `
            background: #EBEBEB;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            height: 30px;
            min-width: 36px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666666;
        `;

    // Speed Options Panel (replaces the speed display when expanded)
    this.speedPanel = document.createElement('div');
    this.speedPanel.style.cssText = `
            top: 0;
            left: 0;
            background: #F5F5F5;
            border-radius: 6px;
            display: none;
            align-items: center;
            gap: 1px;
            padding: 2px;
            height: 30px;
            width: 170px;
            box-sizing: border-box;
            z-index: 1;
        `;

    // Create speed option buttons
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    speeds.forEach((speed, index) => {
      const speedBtn = document.createElement('button');
      speedBtn.textContent = speed === 1 ? '1x' : `${speed}x`;
      speedBtn.dataset.speed = speed;
      speedBtn.style.cssText = `
                background: ${speed === 1 ? '#EBEBEB' : '#F5F5F5'};
                color: #666666;
                border: none;
                border-radius: 3px;
                padding: 2px 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                width: 30px;
                height: 28px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 1;
            `;

      speedBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.selectSpeed(speed);
      });

      this.speedPanel.appendChild(speedBtn);
    });

    this.speedContainer.appendChild(this.speedDisplay);
    this.speedContainer.appendChild(this.speedPanel);

    // Copy Button
    this.copyButton = document.createElement('button');
    this.copyButton.innerHTML = `
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_373_2280)"> <path d="M7.5 12.5C7.5 10.143 7.5 8.96447 8.23223 8.23223C8.96447 7.5 10.143 7.5 12.5 7.5L13.3333 7.5C15.6904 7.5 16.8689 7.5 17.6011 8.23223C18.3333 8.96447 18.3333 10.143 18.3333 12.5V13.3333C18.3333 15.6904 18.3333 16.8689 17.6011 17.6011C16.8689 18.3333 15.6904 18.3333 13.3333 18.3333H12.5C10.143 18.3333 8.96447 18.3333 8.23223 17.6011C7.5 16.8689 7.5 15.6904 7.5 13.3333L7.5 12.5Z" stroke="#666666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M14.1665 7.49984C14.1646 5.03559 14.1273 3.75918 13.41 2.88519C13.2715 2.71641 13.1167 2.56165 12.9479 2.42314C12.026 1.6665 10.6562 1.6665 7.91663 1.6665C5.17706 1.6665 3.80727 1.6665 2.88532 2.42314C2.71654 2.56165 2.56177 2.71641 2.42326 2.88519C1.66663 3.80715 1.66663 5.17694 1.66663 7.9165C1.66663 10.6561 1.66663 12.0259 2.42326 12.9478C2.56177 13.1166 2.71653 13.2714 2.88531 13.4099C3.7593 14.1271 5.03572 14.1645 7.49996 14.1664" stroke="#666666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g> <defs> <clipPath id="clip0_373_2280"> <rect width="20" height="20" fill="white"></rect> </clipPath> </defs> </svg>
                                    `;
    this.copyButton.title = 'Kopier';
    this.copyButton.style.cssText = `
            border: none;
            background: #F5F5F5;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            min-width: 36px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;

    // Add all elements to toolbar
    this.toolbar.appendChild(this.ttsButton);
    this.toolbar.appendChild(this.speedContainer);
    this.toolbar.appendChild(this.copyButton);

    // Add to document
    document.body.appendChild(this.toolbar);

    this.addEventListeners();
  }

  addEventListeners() {
    // TTS Button - handles all states with debouncing
    this.ttsButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      if (this.ttsRequestInProgress) {
        console.log('TTS request already in progress, ignoring click');
        return;
      }

      if (this.isLoading) {
        this.stopTTS();
      } else if (this.isPlaying) {
        this.pauseAudio();
      } else if (this.isPaused) {
        this.resumeAudio();
      } else {
        this.startTTS();
      }
    });

    // Speed Display Click - Toggle speed panel
    this.speedDisplay.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSpeedPanel();
    });

    // Copy Button
    this.copyButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Copy button clicked');
      this.copyText();
    });

    // Hide speed panel when clicking outside
    document.addEventListener('click', e => {
      if (!this.speedContainer.contains(e.target)) {
        this.hideSpeedPanel();
      }
      if (!this.toolbar.contains(e.target)) {
        this.hideToolbar();
      }
    });

    // Add consistent hover effects to all buttons
    this.addHoverEffects();
  }

  addHoverEffects() {
    // Helper function to add hover effects to a button
    const addHoverEffect = (button, originalBackground = '#F5F5F5') => {
      button.addEventListener('mouseenter', () => {
        button.style.background = '#ebebeb';
        button.style.transform = 'scale(1.05)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = originalBackground;
        button.style.transform = 'scale(1)';
      });
    };

    // Add hover effects to main buttons
    addHoverEffect(this.ttsButton);
    addHoverEffect(this.copyButton);
    addHoverEffect(this.speedDisplay, '#EBEBEB');

    // Add hover effects to speed panel buttons
    const speedButtons = this.speedPanel.querySelectorAll('button');
    speedButtons.forEach(speedBtn => {
      const speed = parseFloat(speedBtn.dataset.speed);
      const originalBg = speed === this.playbackSpeed ? '#EBEBEB' : '#F5F5F5';

      speedBtn.addEventListener('mouseenter', () => {
        speedBtn.style.background = '#ebebeb';
        speedBtn.style.transform = 'scale(1.05)';
      });

      speedBtn.addEventListener('mouseleave', () => {
        const currentSpeed = parseFloat(speedBtn.dataset.speed);
        speedBtn.style.background = currentSpeed === this.playbackSpeed ? '#EBEBEB' : '#F5F5F5';
        speedBtn.style.transform = 'scale(1)';
      });
    });
  }

  toggleSpeedPanel() {
    if (this.speedExpanded) {
      this.hideSpeedPanel();
    } else {
      this.showSpeedPanel();
    }
  }

  showSpeedPanel() {
    this.toolbar.style.gap = '0px';
    this.speedDisplay.style.opacity = '0';
    this.speedDisplay.style.transform = 'scale(0.8)';

    setTimeout(() => {
      this.speedDisplay.style.display = 'none';
      this.speedPanel.style.display = 'flex';

      requestAnimationFrame(() => {
        this.speedPanel.style.opacity = '1';
        this.speedPanel.style.transform = 'scale(1)';
      });
    }, 150);

    this.speedExpanded = true;
    this.updateSpeedButtons();
  }

  hideSpeedPanel() {
    this.speedPanel.style.opacity = '0';
    this.speedPanel.style.transform = 'scale(0.8)';

    setTimeout(() => {
      this.speedPanel.style.display = 'none';
      this.speedDisplay.style.display = 'flex';

      requestAnimationFrame(() => {
        this.speedDisplay.style.opacity = '1';
        this.speedDisplay.style.transform = 'scale(1)';
      });
      this.toolbar.style.gap = '6px';
    }, 150);

    this.speedExpanded = false;
  }

  updateSpeedButtons() {
    const buttons = this.speedPanel.querySelectorAll('button');
    buttons.forEach(btn => {
      const speed = parseFloat(btn.dataset.speed);
      if (speed === this.playbackSpeed) {
        btn.style.background = '#EBEBEB';
        btn.style.color = '#666666';
      } else {
        btn.style.background = '#F5F5F5';
        btn.style.color = '#666666';
      }
    });
  }

  selectSpeed(speed) {
    this.playbackSpeed = speed;
    this.speedDisplay.textContent = speed === 1 ? '1x' : `${speed}x`;

    if (this.currentAudio && (this.isPlaying || this.isPaused)) {
      this.currentAudio.playbackRate = this.playbackSpeed;
    }

    this.updateSpeedButtons();

    setTimeout(() => {
      this.hideSpeedPanel();
    }, 300);

    console.log('Speed changed to:', speed);
  }

  bindEvents() {
    console.log('Binding selection events...');

    const editor = this.quill.container.querySelector('.ql-editor');
    if (editor) {
      // Mouse down - start selection tracking
      editor.addEventListener('mousedown', () => {
        this.isSelecting = true;
        this.hideToolbar();
        console.log('Mouse down in editor - starting selection');
      });

      // Mouse up - check for selection after mouse release
      editor.addEventListener('mouseup', () => {
        if (this.isSelecting) {
          setTimeout(() => {
            this.checkAndShowToolbar();
            this.isSelecting = false;
          }, 10);
        }
      });

      // Global mouseup event to catch selections that end outside the editor
      document.addEventListener('mouseup', e => {
        if (this.isSelecting) {
          setTimeout(() => {
            const hasValidSelection = this.checkAndShowToolbar();
            if (hasValidSelection) {
              console.log('Selection completed outside editor but within Quill content');
            }
            this.isSelecting = false;
          }, 10);
        }
      });

      // Handle keyboard events for both selection and deletion
      editor.addEventListener('keyup', e => {
        if (
          e.shiftKey ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          (e.ctrlKey && e.key === 'a')
        ) {
          setTimeout(() => {
            this.checkAndShowToolbar();
          }, 10);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          setTimeout(() => {
            const selection = this.quill.getSelection();
            if (!selection || selection.length === 0) {
              console.log('Selection deleted with', e.key, '- hiding toolbar');
              this.hideToolbar();
            } else {
              const currentText = this.quill.getText(selection.index, selection.length).trim();
              if (!currentText) {
                console.log('Selected text is empty after deletion - hiding toolbar');
                this.hideToolbar();
              }
            }
          }, 10);
        } else if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') {
          setTimeout(() => {
            const selection = this.quill.getSelection();
            if (!selection || selection.length === 0) {
              this.hideToolbar();
            }
          }, 10);
        }
      });

      // Add keydown event for immediate deletion detection
      editor.addEventListener('keydown', e => {
        if ((e.key === 'Backspace' || e.key === 'Delete') && this.isVisible) {
          const selection = this.quill.getSelection();
          if (selection && selection.length > 0) {
            console.log('Selection will be deleted - preparing to hide toolbar');
            setTimeout(() => {
              this.hideToolbar();
            }, 50);
          }
        }
      });

      // Add text-change event listener for content modifications
      this.quill.on('text-change', (delta, oldDelta, source) => {
        if (this.isVisible) {
          setTimeout(() => {
            const selection = this.quill.getSelection();
            if (!selection || selection.length === 0) {
              console.log('Content changed and no selection - hiding toolbar');
              this.hideToolbar();
            } else {
              const currentText = this.quill.getText(selection.index, selection.length).trim();
              if (!currentText) {
                console.log('Content changed and selected text is empty - hiding toolbar');
                this.hideToolbar();
              } else if (currentText !== this.selectedText) {
                this.selectedText = currentText;
              }
            }
          }, 10);
        }
      });
    }

    // Backup method: Document selection events
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const quillEditor = this.quill.container.querySelector('.ql-editor');

        if (quillEditor && quillEditor.contains(range.commonAncestorContainer)) {
          const text = selection.toString().trim();
          if (text && !this.isSelecting) {
            this.selectedText = text;
            this.showToolbarAtDocumentSelection();
          }
        }
      } else {
        if (this.isVisible && !this.isSelecting) {
          console.log('Document selection cleared - hiding toolbar');
          this.hideToolbar();
        }
      }
    });

    // Add scroll event listener to update toolbar position
    this.scrollHandler = () => {
      if (this.isVisible) {
        this.updateToolbarPosition();
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.addScrollListenersToParents();
  }

  // Centralized method to check for valid selections and show toolbar
  checkAndShowToolbar() {
    // First check Quill's internal selection
    const quillSelection = this.quill.getSelection();
    if (quillSelection && quillSelection.length > 0) {
      this.selectedText = this.quill.getText(quillSelection.index, quillSelection.length).trim();
      if (this.selectedText) {
        console.log('Valid Quill selection found:', this.selectedText);
        this.showToolbar(quillSelection);
        return true;
      }
    }

    // Also check document selection as backup
    const domSelection = window.getSelection();
    if (domSelection.rangeCount > 0 && !domSelection.isCollapsed) {
      const range = domSelection.getRangeAt(0);
      const quillEditor = this.quill.container.querySelector('.ql-editor');

      if (
        quillEditor &&
        (quillEditor.contains(range.commonAncestorContainer) ||
          range.commonAncestorContainer === quillEditor ||
          this.isSelectionWithinQuill(range, quillEditor))
      ) {
        const text = domSelection.toString().trim();
        if (text) {
          this.selectedText = text;
          console.log('Valid document selection within Quill found:', this.selectedText);
          this.showToolbarAtDocumentSelection();
          return true;
        }
      }
    }

    return false;
  }

  // Helper method to check if selection range intersects with Quill editor
  isSelectionWithinQuill(range, quillEditor) {
    try {
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;

      const startInQuill =
        quillEditor.contains(startContainer) ||
        (startContainer.nodeType === Node.TEXT_NODE &&
          quillEditor.contains(startContainer.parentNode));
      const endInQuill =
        quillEditor.contains(endContainer) ||
        (endContainer.nodeType === Node.TEXT_NODE && quillEditor.contains(endContainer.parentNode));

      return startInQuill || endInQuill;
    } catch (error) {
      console.log('Error checking selection within Quill:', error);
      return false;
    }
  }

  addScrollListenersToParents() {
    let parent = this.quill.container.parentElement;
    while (parent && parent !== document.body) {
      if (this.isScrollable(parent)) {
        parent.addEventListener('scroll', this.scrollHandler, { passive: true });
      }
      parent = parent.parentElement;
    }
  }

  isScrollable(element) {
    const style = window.getComputedStyle(element);
    return (
      style.overflow === 'scroll' ||
      style.overflow === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'auto'
    );
  }

  updateToolbarPosition() {
    const selection = this.quill.getSelection();
    if (selection && selection.length > 0) {
      this.showToolbar(selection);
    } else {
      const docSelection = window.getSelection();
      if (docSelection.rangeCount > 0 && !docSelection.isCollapsed) {
        this.showToolbarAtDocumentSelection();
      }
    }
  }

  // Add utility method to validate current selection
  validateCurrentSelection() {
    const selection = this.quill.getSelection();
    if (!selection || selection.length === 0) {
      return false;
    }

    const currentText = this.quill.getText(selection.index, selection.length).trim();
    if (!currentText) {
      return false;
    }

    if (currentText !== this.selectedText) {
      this.selectedText = currentText;
    }

    return true;
  }

  showToolbar(range = null) {
    if (!this.selectedText || this.selectedText.trim().length === 0) {
      console.log('No text selected, hiding toolbar');
      return;
    }

    console.log('Showing toolbar for text:', this.selectedText);

    let x, y;

    if (range) {
      const bounds = this.quill.getBounds(range.index, range.length);
      const editorRect = this.quill.container.getBoundingClientRect();

      x = editorRect.left + bounds.left + bounds.width / 2 + window.scrollX;
      y = editorRect.top + bounds.top + window.scrollY;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        x = rect.left + rect.width / 2 + window.scrollX;
        y = rect.top + window.scrollY;
      } else {
        return;
      }
    }

    // Get toolbar dimensions for proper centering
    this.toolbar.style.display = 'flex';
    this.toolbar.style.opacity = '0';
    const toolbarRect = this.toolbar.getBoundingClientRect();
    this.toolbar.style.opacity = '1';

    const toolbarWidth = toolbarRect.width;
    const toolbarHeight = toolbarRect.height;

    const finalLeft = Math.max(10, x - toolbarWidth / 2);
    const finalTop = Math.max(10, y - toolbarHeight - 5);

    const maxLeft = window.innerWidth - toolbarWidth - 10;
    const actualLeft = Math.min(finalLeft, maxLeft);

    this.toolbar.style.left = actualLeft + 'px';
    this.toolbar.style.top = finalTop + 'px';
    this.toolbar.style.display = 'flex';
    this.isVisible = true;

    console.log('Toolbar positioned at center of selection:', actualLeft, finalTop);

    this.updateTTSButton();
    this.hideSpeedPanel();
  }

  showToolbarAtDocumentSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();

      const x = rect.left + rect.width / 2 + window.scrollX;
      const y = rect.top + window.scrollY;

      this.toolbar.style.display = 'flex';
      this.toolbar.style.opacity = '0';
      const toolbarRect = this.toolbar.getBoundingClientRect();
      this.toolbar.style.opacity = '1';

      const toolbarWidth = toolbarRect.width;
      const toolbarHeight = toolbarRect.height;

      const finalLeft = Math.max(10, x - toolbarWidth / 2);
      const finalTop = Math.max(10, y - toolbarHeight - 5);

      const maxLeft = window.innerWidth - toolbarWidth - 10;
      const actualLeft = Math.min(finalLeft, maxLeft);

      this.toolbar.style.left = actualLeft + 'px';
      this.toolbar.style.top = finalTop + 'px';
      this.toolbar.style.display = 'flex';
      this.isVisible = true;
      this.updateTTSButton();
      this.hideSpeedPanel();
    }
  }

  hideToolbar() {
    console.log('Hiding toolbar');
    this.toolbar.style.display = 'none';
    this.isVisible = false;
    this.hideSpeedPanel();

    this.selectedText = '';
    this.stopTTS();
  }

  updateTTSButton() {
    if (this.isLoading) {
      this.ttsButton.innerHTML = `
                <div class="loader4">
                    <div class="dotted-loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
                </div>
            `;
      this.ttsButton.title = 'Loader...';
    } else if (this.isPlaying) {
      this.ttsButton.innerHTML = `
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 30.46 37.79">
                                        <rect fill="#E66B85" x="0" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
                                        <rect fill="#E66B85" x="19.89" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
                                        </svg>`;
      this.ttsButton.title = 'Pause';
    } else if (this.isPaused) {
      this.ttsButton.innerHTML = `
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 345.03 382.74">
                                        <path fill="#E66B85" d="M312.29,134.11L100.12,9.28C55.83-16.78,0,15.15,0,66.53v249.67c0,51.38,55.83,83.31,100.12,57.26l212.17-124.84c43.66-25.69,43.66-88.82,0-114.51Z"></path>
                                        </svg>
                                        `;
      this.ttsButton.title = 'Continue';
    } else {
      this.ttsButton.innerHTML = ` <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M11.6666 10.3448V5.65555C11.6666 3.03455 11.6666 1.72405 10.8955 1.39791C10.1244 1.07177 9.21692 1.99844 7.40189 3.85176C6.46195 4.81153 5.92567 5.02407 4.58832 5.02407C3.41877 5.02407 2.83399 5.02407 2.41392 5.31068C1.54192 5.90562 1.67373 7.06849 1.67373 8.00016C1.67373 8.93184 1.54192 10.0947 2.41392 10.6896C2.83399 10.9763 3.41877 10.9763 4.58832 10.9763C5.92567 10.9763 6.46195 11.1888 7.40189 12.1486C9.21692 14.0019 10.1244 14.9286 10.8955 14.6024C11.6666 14.2763 11.6666 12.9658 11.6666 10.3448Z" stroke="#E66B85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M14.1666 5.5C14.6878 6.18306 15 7.05287 15 8C15 8.94713 14.6878 9.81694 14.1666 10.5" stroke="#E66B85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M16.6666 3.8335C17.709 4.97193 18.3333 6.42161 18.3333 8.00016C18.3333 9.57872 17.709 11.0284 16.6666 12.1668" stroke="#E66B85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                        `;
      this.ttsButton.style.background = '#F5F5F5';
      this.ttsButton.title = 'Læs højt';
    }
  }

  getCleanTextForTTS() {
    try {
      const deps = getDependencies();
      const domSelection = window.getSelection();

      if (domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        console.log('No DOM selection, using plain text for TTS');
        return this.selectedText;
      }

      const quillEditor = this.quill.container.querySelector('.ql-editor');
      const range = domSelection.getRangeAt(0);

      const isWithinEditor =
        quillEditor.contains(range.commonAncestorContainer) ||
        range.commonAncestorContainer === quillEditor;

      if (!isWithinEditor) {
        console.log('Selection not within editor, using plain text for TTS');
        return this.selectedText;
      }

      const selectedFragment = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(selectedFragment);
      let selectedHtml = tempDiv.innerHTML;

      if (!selectedHtml.trim()) {
        console.log('No HTML content found, using plain text for TTS');
        return this.selectedText;
      }

      console.log('Original HTML for TTS:', selectedHtml);

      if (deps.removeHamDanTags && typeof deps.removeHamDanTags === 'function') {
        selectedHtml = deps.removeHamDanTags(selectedHtml);
        console.log('HTML after removeHamdanTags:', selectedHtml);
      } else {
        console.log('removeHamdanTags function not available');
      }

      const textDiv = document.createElement('div');
      textDiv.innerHTML = selectedHtml;

      let cleanText = textDiv.textContent || textDiv.innerText || '';
      cleanText = cleanText.replace(/\s+/g, ' ').trim();

      console.log('Final clean text for TTS:', cleanText);

      return cleanText || this.selectedText;
    } catch (error) {
      console.error('Error getting clean text for TTS:', error);
      return this.selectedText;
    }
  }

  async startTTS() {
    if (this.ttsRequestInProgress) {
      console.log('TTS request already in progress, aborting');
      return;
    }

    if (!this.selectedText.trim()) return;

    this.ttsRequestInProgress = true;
    this.isLoading = true;
    this.isPlaying = false;
    this.isPaused = false;
    this.updateTTSButton();

    console.log('Starting TTS for:', this.selectedText);

    try {
      const cleanText = this.getCleanTextForTTS();

      if (!cleanText.trim()) {
        console.log('No clean text available for TTS');
        this.resetToIdle();
        return;
      }

      const deps = getDependencies();
      let currentLanguage = 'da';
      if (deps.getCurrentLanguage && typeof deps.getCurrentLanguage === 'function') {
        currentLanguage = deps.getCurrentLanguage();
      }

      let lang;
      switch (currentLanguage) {
        case 'da':
          lang = 'Danish';
          break;
        case 'en':
          lang = 'English';
          break;
        case 'ge':
          lang = 'German';
          break;
        case 'fr':
          lang = 'French';
          break;
        case 'es':
          lang = 'Spanish';
          break;
        default:
          lang = 'English';
      }

      console.log('Sending clean text to TTS:', cleanText);
      const audioBlob = await this.requestTTS(cleanText, lang, this.selectedGender);

      if (audioBlob) {
        this.audioBlob = audioBlob;
        await this.playAudio(audioBlob);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      this.resetToIdle();
    } finally {
      this.ttsRequestInProgress = false;
    }
  }

  requestTTS(text, language, gender) {
    return new Promise((resolve, reject) => {
      const deps = getDependencies();

      if (!deps.SB_ajax_object || !deps.HGF_ajax_object) {
        reject(new Error('Required AJAX objects not available'));
        return;
      }

      jQuery.ajax({
        url: deps.SB_ajax_object.ajax_url,
        type: 'POST',
        data: {
          action: 'hgf_grammar_bot_tts',
          nonce: deps.HGF_ajax_object.nonce,
          text: text,
          lang: language,
          gender: gender
        },
        xhrFields: {
          responseType: 'blob'
        },
        success: function (audioData) {
          resolve(audioData);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          reject(new Error(`TTS request failed: ${textStatus}`));
        }
      });
    });
  }

  async playAudio(audioData) {
    try {
      const audioUrl = URL.createObjectURL(audioData);
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.playbackRate = this.playbackSpeed;

      this.currentAudio.onended = () => {
        console.log('Audio playback ended');
        this.resetToIdle();
      };

      this.currentAudio.onerror = () => {
        console.error('Audio playback error');
        this.resetToIdle();
      };

      await this.currentAudio.play();

      this.isLoading = false;
      this.isPlaying = true;
      this.isPaused = false;
      this.updateTTSButton();

      console.log('Audio started playing');
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.resetToIdle();
    }
  }

  pauseAudio() {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
      this.isPaused = true;
      this.updateTTSButton();
      console.log('Audio paused');
    }
  }

  resumeAudio() {
    if (this.currentAudio && this.isPaused) {
      this.currentAudio
        .play()
        .then(() => {
          this.isPlaying = true;
          this.isPaused = false;
          this.currentAudio.playbackRate = this.playbackSpeed;
          this.updateTTSButton();
          console.log('Audio resumed');
        })
        .catch(error => {
          console.error('Failed to resume audio:', error);
          this.resetToIdle();
        });
    }
  }

  stopTTS() {
    console.log('Stopping TTS');
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      if (this.currentAudio.src) {
        URL.revokeObjectURL(this.currentAudio.src);
      }
      this.currentAudio = null;
    }
    this.resetToIdle();
  }

  resetToIdle() {
    this.isLoading = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.audioBlob = null;
    this.ttsRequestInProgress = false;
    this.updateTTSButton();
  }

  async copyText() {
    if (!this.selectedText) return;

    console.log('Copying structured text:', this.selectedText);

    try {
      const deps = getDependencies();
      const domSelection = window.getSelection();

      if (domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        await this.simpleCopyFallback();
        return;
      }

      const quillEditor = this.quill.container.querySelector('.ql-editor');
      const range = domSelection.getRangeAt(0);

      const isWithinEditor =
        quillEditor.contains(range.commonAncestorContainer) ||
        range.commonAncestorContainer === quillEditor;

      if (!isWithinEditor) {
        await this.simpleCopyFallback();
        return;
      }

      const selectedFragment = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(selectedFragment);

      let selectedHtml = tempDiv.innerHTML;

      try {
        if (deps.removeMarkTags && typeof deps.removeMarkTags === 'function') {
          selectedHtml = deps.removeMarkTags(selectedHtml);
        }
      } catch (error) {
        console.log('removeMarkTags not available');
      }

      if (!selectedHtml.trim()) {
        const newRange = document.createRange();
        newRange.selectNodeContents(range.commonAncestorContainer);
        const altFragment = newRange.cloneContents();
        const altDiv = document.createElement('div');
        altDiv.appendChild(altFragment);
        selectedHtml = altDiv.innerHTML;
      }

      const selectedText = domSelection.toString();

      if (!selectedText || selectedText.trim() === '') {
        await this.simpleCopyFallback();
        return;
      }

      if (deps.processHtmlForCopy && typeof deps.processHtmlForCopy === 'function') {
        selectedHtml = deps.processHtmlForCopy(selectedHtml, 'selection');
      }

      const processDiv = document.createElement('div');
      processDiv.innerHTML = selectedHtml;

      // Convert headings to strong tags
      const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      let totalHeadingsConverted = 0;

      headingTags.forEach(hTag => {
        const headings = processDiv.querySelectorAll(hTag);

        headings.forEach((heading, index) => {
          const strongElement = document.createElement('strong');
          strongElement.innerHTML = heading.innerHTML;
          heading.parentNode.replaceChild(strongElement, heading);
          totalHeadingsConverted++;
        });
      });

      // Remove empty paragraphs after strong tags
      const strongElements = processDiv.querySelectorAll('strong');
      let emptyParagraphsRemoved = 0;

      strongElements.forEach((strong, index) => {
        const nextSibling = strong.nextElementSibling;

        if (nextSibling && nextSibling.tagName === 'P') {
          const isEmpty =
            (nextSibling.childNodes.length === 1 &&
              nextSibling.firstChild &&
              nextSibling.firstChild.nodeType === Node.ELEMENT_NODE &&
              nextSibling.firstChild.tagName === 'BR') ||
            nextSibling.innerHTML.trim() === '<br>' ||
            nextSibling.innerHTML.trim() === '<br/>' ||
            nextSibling.innerHTML.trim() === '<br />';

          if (isEmpty) {
            nextSibling.parentNode.removeChild(nextSibling);
            emptyParagraphsRemoved++;
          }
        }
      });

      // Clean up styles
      const allElements = processDiv.querySelectorAll('*');

      let styleModifications = 0;
      allElements.forEach((el, index) => {
        const beforeStyle = el.getAttribute('style');

        el.style.backgroundColor = '';
        el.style.fontSize = '';
        el.style.fontFamily = '';
        el.style.color = '';

        if (el.hasAttribute('style')) {
          let style = el.getAttribute('style');
          const originalStyle = style;

          style = style.replace(/background(-color)?:[^;]+;?/gi, '');
          style = style.replace(/font-size:[^;]+;?/gi, '');
          style = style.replace(/font-family:[^;]+;?/gi, '');
          style = style.replace(/color:[^;]+;?/gi, '');

          if (style.trim() === '') {
            el.removeAttribute('style');
          } else {
            el.setAttribute('style', style);
          }

          if (originalStyle !== (el.getAttribute('style') || '')) {
            styleModifications++;
          }
        }
      });

      let htmlContent = processDiv.innerHTML;
      let textContent = selectedText;

      if (
        deps.quillHtmlToPlainTextWithParagraphs &&
        typeof deps.quillHtmlToPlainTextWithParagraphs === 'function'
      ) {
        textContent = deps.quillHtmlToPlainTextWithParagraphs(htmlContent);
      }

      if (
        deps.isMobileDevice &&
        typeof deps.isMobileDevice === 'function' &&
        deps.isMobileDevice()
      ) {
        if (deps.processHtmlForMobile && typeof deps.processHtmlForMobile === 'function') {
          htmlContent = deps.processHtmlForMobile(htmlContent);
        }
        if (deps.processTextForMobile && typeof deps.processTextForMobile === 'function') {
          textContent = deps.processTextForMobile(textContent);
        }
      }

      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const clipboardItems = [
            new ClipboardItem({
              'text/html': new Blob([htmlContent], { type: 'text/html' }),
              'text/plain': new Blob([textContent], { type: 'text/plain' })
            })
          ];

          await navigator.clipboard.write(clipboardItems);
          this.showCopySuccess();
        } catch (clipboardError) {
          throw clipboardError;
        }
      } else {
        throw new Error('Modern clipboard API not supported');
      }
    } catch (error) {
      console.log('Falling back to alternative copy methods', error);
      try {
        const tempElement = document.createElement('div');
        tempElement.setAttribute('contenteditable', 'true');
        tempElement.innerHTML = htmlContent;
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.style.top = '-9999px';
        document.body.appendChild(tempElement);

        const range = document.createRange();
        range.selectNodeContents(tempElement);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const copySuccess = document.execCommand('copy');

        selection.removeAllRanges();
        document.body.removeChild(tempElement);

        if (copySuccess) {
          this.showCopySuccess();
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (fallbackErr) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(this.selectedText);
            this.showCopySuccess();
          } else {
            throw new Error('All clipboard methods failed');
          }
        } catch (textOnlyError) {
          console.error('All copy methods failed:', textOnlyError);
        }
      }
    }
  }

  async simpleCopyFallback() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(this.selectedText);
        this.showCopySuccess();
      } else {
        this.fallbackCopy('', this.selectedText);
      }
    } catch (error) {
      this.fallbackCopy('', this.selectedText);
    }
  }

  fallbackCopy(htmlContent = '', textContent = '') {
    try {
      if (htmlContent) {
        const tempElement = document.createElement('div');
        tempElement.setAttribute('contenteditable', 'true');
        tempElement.innerHTML = htmlContent;
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        tempElement.style.top = '-9999px';
        document.body.appendChild(tempElement);

        const range = document.createRange();
        range.selectNodeContents(tempElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const copySuccess = document.execCommand('copy');

        selection.removeAllRanges();
        document.body.removeChild(tempElement);

        if (copySuccess) {
          this.showCopySuccess();
          return;
        }
      }

      const textArea = document.createElement('textarea');
      textArea.value = textContent || this.selectedText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();

      const copySuccess = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (copySuccess) {
        this.showCopySuccess();
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (err) {
      console.error('All copy methods failed:', err);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(textContent || this.selectedText)
          .then(() => this.showCopySuccess())
          .catch(() => console.error('Final fallback also failed'));
      }
    }
  }

  showCopySuccess() {
    const originalContent = this.copyButton.innerHTML;
    const originalColor = this.copyButton.style.background;

    this.copyButton.innerHTML = `<svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.717 2.4933C18.0728 3.41378 17.5739 4.044 16.6082 4.66478C15.8291 5.16566 14.8364 5.70829 13.7846 6.63598C12.7535 7.54541 11.7472 8.64078 10.8529 9.71889C9.96223 10.7926 9.20522 11.8218 8.67035 12.5839C8.32471 13.0764 7.84234 13.8109 7.84234 13.8109C7.50218 14.3491 6.89063 14.6749 6.23489 14.6667C5.57901 14.6585 4.97657 14.3178 4.65113 13.7711C3.81924 12.3735 3.1773 11.8216 2.88226 11.6234C2.09282 11.0928 1.1665 11.0144 1.1665 9.77812C1.1665 8.79631 1.99558 8.0004 3.0183 8.0004C3.74035 8.02706 4.41149 8.31103 5.00613 8.71063C5.38625 8.96607 5.78891 9.30391 6.20774 9.74862C6.69929 9.07815 7.29164 8.30461 7.95566 7.5041C8.91998 6.34155 10.0582 5.09441 11.2789 4.0178C12.4788 2.95945 13.8662 1.96879 15.3367 1.445C16.2956 1.10347 17.3613 1.57281 17.717 2.4933Z" stroke="#666666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    this.copyButton.style.background = '#F5F5F5';

    setTimeout(() => {
      this.copyButton.innerHTML = originalContent;
      this.copyButton.style.background = originalColor;
    }, 1500);
  }

  // Cleanup method
  destroy() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);

      let parent = this.quill.container.parentElement;
      while (parent && parent !== document.body) {
        if (this.isScrollable(parent)) {
          parent.removeEventListener('scroll', this.scrollHandler);
        }
        parent = parent.parentElement;
      }
    }

    this.stopTTS();

    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.parentNode.removeChild(this.toolbar);
    }
  }
}

// Initialize Selection Toolbar
function initializeSelectionToolbar(quillInstance) {
  console.log('Initializing selection toolbar with:', quillInstance);

  if (!quillInstance) {
    console.error('Quill instance not provided to initializeSelectionToolbar');
    return null;
  }

  return new QuillSelectionToolbar(quillInstance);
}

// Test function
function testSelectionToolbar() {
  console.log('Testing selection toolbar...');
  if (window.selectionToolbar) {
    console.log('Selection toolbar exists');
    window.selectionToolbar.selectedText = 'Test text';
    window.selectionToolbar.showToolbarAtDocumentSelection();
  } else {
    console.log('Selection toolbar not found');
  }
}

// Add CSS styles to document
function addSelectionToolbarStyles() {
  const styleId = 'selection-toolbar-styles';

  // Check if styles already exist
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
        /* Selection Toolbar Styles */
        #selection-toolbar .loader4 {
            display: inline-block;
        }
        
        #selection-toolbar .dotted-loader {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        #selection-toolbar .dotted-loader .dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background-color: #E66B85;
            margin: 0 1px;
            animation: dotAnimation 1.4s infinite ease-in-out both;
        }
        
        #selection-toolbar .dotted-loader .dot:nth-child(1) { animation-delay: -0.32s; }
        #selection-toolbar .dotted-loader .dot:nth-child(2) { animation-delay: -0.16s; }
        #selection-toolbar .dotted-loader .dot:nth-child(3) { animation-delay: 0s; }
        #selection-toolbar .dotted-loader .dot:nth-child(4) { animation-delay: 0.16s; }
        #selection-toolbar .dotted-loader .dot:nth-child(5) { animation-delay: 0.32s; }
        #selection-toolbar .dotted-loader .dot:nth-child(6) { animation-delay: 0.48s; }
        #selection-toolbar .dotted-loader .dot:nth-child(7) { animation-delay: 0.64s; }
        #selection-toolbar .dotted-loader .dot:nth-child(8) { animation-delay: 0.8s; }
        
        @keyframes dotAnimation {
            0%, 80%, 100% {
                transform: scale(0);
            }
            40% {
                transform: scale(1);
            }
        }
    `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
addSelectionToolbarStyles();

// Export functions
export {
  QuillSelectionToolbar,
  initializeSelectionToolbar,
  testSelectionToolbar,
  addSelectionToolbarStyles
};
