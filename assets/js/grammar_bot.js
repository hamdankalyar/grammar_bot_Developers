import { getCookie, setCookie, deleteCookie, cookieExists } from './modules/cookieManager.js';
import {
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
} from './modules/rewriteSystem.js';
import {
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
} from './modules/history.js';
import { initializeFileUpload } from './modules/fileUploader.js';
import { initializeSelectionToolbar, testSelectionToolbar } from './modules/selectionToolbar.js';
import {
  isMobileDevice,
  processTextForMobile,
  processHtmlForMobile,
  quillHtmlToPlainTextWithParagraphs,
  processHtmlForCopy,
  processQuillContentForCopy,
  setupQuillCopyHandler,
  handleQuillCopy,
  updateCopyButton,
  initQuillCopy,
  convertBulletListToUlForCopy,
  makeUniversalSpacingCompatible,
  normalizeEmojisInHtml,
  handlePaste,
  scrollAfterPaste,
  moveCaretToEnd
} from './modules/copyPaste.js';
import { removeHamDanTags, removeMarkTags } from './modules/utils.js';
import { initializeSTT, manuallyCloseMicButton } from './modules/speechToText.js';
import {
  getCurrentLanguage,
  setCurrentLanguage,
  getLanguageName,
  closeAllDropdowns,
  updateDropdownOptions,
  handleCustomLanguage,
  initLanguageDropdown,
  languageMap,
  getLanguageCode
} from './modules/languageDropdown.js';
import { initializeTTS, stopSpeaking, manualStopSpeaking } from './modules/textToSpeech.js';
import { initializeDownloadButton } from './modules/quillDownloader.js';
document.addEventListener('DOMContentLoaded', function () {
  if (window.innerWidth < 400) {
    const langLegendDiv = document.querySelector('.lang-legend-div');
    const topHeadingsDiv = document.querySelector('.top-headings-div');
    const showSavedBtn = document.querySelector('#showSavedResponsesBtn');

    if (langLegendDiv && topHeadingsDiv && showSavedBtn) {
      topHeadingsDiv.insertBefore(langLegendDiv, showSavedBtn);
    }
  }
});

function lottieLoadAnimation() {
  lottie.loadAnimation({
    container: document.getElementById('gif'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'https://stemme-skrivsikkert.dk/wp-content/uploads/2025/06/robot-wave.json'
  });
}
lottieLoadAnimation();

function lottieLoadAnimationByAddress(div) {
  lottie.loadAnimation({
    container: div,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'https://stemme-skrivsikkert.dk/wp-content/uploads/2025/06/robot-wave.json'
  });
}

let activeMember = true;
function checkUserMembership() {
  return fetch(
    HGF_ajax_object.ajax_url + '?action=login_check_user_membership&nonce=' + HGF_ajax_object.nonce
  )
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        return data.data.has_active_membership;
      } else {
        console.error('Failed to check membership');
        return false;
      }
    })
    .catch(error => {
      console.error('Error:', error);
      return false;
    });
}

// Run on page load
window.addEventListener('load', function () {
  checkUserMembership().then(hasActiveMembership => {
    if (hasActiveMembership) {
      console.log('User has active membership');
      // Your code for active members
      activeMember = true;
    } else {
      console.log('User does not have active membership');
      // Your code for non-members or inactive members
      activeMember = false;
    }
    updateGenerateButtonState();
  });
});

// ========================= Global Variables =============================

let toggleState = true;
let cookieToggleState = false;
let originalContent = {};
let correctedText;
let noOfChanges = -1;
let lastCorrectedText = '';
let previousText = '';
let isUndo = false;
let isTilpas = false;
let isMainSwtich = true;
let switcherText = '';
let improvedText = '';
let diffHTMLExp;
let isSmartCalled = false;
let isExplanations = false;
let correctedResults = [];
let diffHTMLParts = [];
let isImproved;
// ================================= Quill editor ====================================
// * ------------------------------- Table fix  ----------------------------- *
Quill.register(
  {
    // note: module name is "table-better", not "better-table"
    'modules/table-better': QuillTableBetter
  },
  /* overwrite = */ true
);
// * ------------------------------- MS word bullets ----------------------------- *
const Delta = Quill.import('delta');

const LIST_PREFIX_RE = /^(\s*)([\u2022\u00B7•]|[0-9]+[.)]|[A-Za-z]+[.)])\s+/;
//  group 1  ───┘          optional leading spaces / tabs coming from Word
//  group 2                 •  •  •  OR “1.” “1)”  OR “A.” “a)” …
//  “\s+”                   at least one space / tab after the prefix

function matchMsWordList(node, delta) {
  // clone ops so we never mutate Quill’s original Delta
  const ops = delta.ops.map(op => ({ ...op }));

  // ── 1. find the first text op that actually contains content
  const firstText = ops.find(op => typeof op.insert === 'string' && op.insert.trim().length);
  if (!firstText) return delta; // nothing to do

  // ── 2. detect & strip the Word prefix
  const m = firstText.insert.match(LIST_PREFIX_RE);
  if (!m) return delta; // no bullet/number detected

  const fullPrefix = m[0]; // e.g. “1. ” (with trailing space)
  const prefixCore = m[2]; // e.g. “1.”   (used below)
  firstText.insert = firstText.insert.slice(fullPrefix.length);

  // ── 3. drop the trailing hard-return Word adds at the end of the paragraph
  const last = ops[ops.length - 1];
  if (typeof last.insert === 'string' && last.insert.endsWith('\n')) {
    last.insert = last.insert.slice(0, -1);
  }

  // ── 4. decide list type
  const listType = /^\d/.test(prefixCore) ? 'ordered' : 'bullet';

  // ── 5. indent level (Word exports it in inline CSS: style="level3 …")
  let indent = 0;
  const style = (node.getAttribute('style') || '').replace(/\s+/g, '');
  const levelMatch = style.match(/level(\d+)/); // level1 → indent 0, level2 → indent 1 …
  if (levelMatch) indent = parseInt(levelMatch[1], 10) - 1;

  // ── 6. append Quill’s own list marker
  ops.push({ insert: '\n', attributes: { list: listType, indent } });

  return new Delta(ops);
}

// Same helper for bullet paragraphs that come through <p class="MsoNormal"> …
function maybeMatchMsWordList(node, delta) {
  // Word’s bullet glyphs are usually “•” U+2022 or “·” U+00B7
  const ch = delta.ops[0].insert.trimLeft()[0];
  if (ch === '•' || ch === '·') {
    return matchMsWordList(node, delta);
  }
  // also catch “1. ” or “a) ” in plain MsoNormal paragraphs:
  if (/^[0-9A-Za-z][.)]/.test(delta.ops[0].insert)) {
    return matchMsWordList(node, delta);
  }
  return delta;
}
// -------------------- register the improved matchers --------------------
const MSWORD_MATCHERS = [
  ['p.MsoListParagraphCxSpFirst', matchMsWordList],
  ['p.MsoListParagraphCxSpMiddle', matchMsWordList],
  ['p.MsoListParagraphCxSpLast', matchMsWordList],
  ['p.MsoListParagraph', matchMsWordList],
  ['p.msolistparagraph', matchMsWordList],
  ['p.MsoNormal', maybeMatchMsWordList]
];

/* ------------------------------------------------------------------ 1  Create the blots */
const Inline = Quill.import('blots/inline');

class GrammarAdded extends Inline {
  static blotName = 'grammar-added';
  static tagName = 'ham-dan'; // ← custom element **with a dash**
  static className = 'grammar-correction-added';
}

class GrammarRemoved extends Inline {
  static blotName = 'grammar-removed';
  static tagName = 'ham-dan';
  static className = 'grammar-correction-removed';
}

class GrammarPunct extends Inline {
  static blotName = 'grammar-punct';
  static tagName = 'ham-dan';
  static className = 'grammar-correction-punctuation';
}

/* ------------------------------------------------------------------ 2  Register explicitly */
Quill.register(
  {
    'formats/grammar-added': GrammarAdded,
    'formats/grammar-removed': GrammarRemoved,
    'formats/grammar-punct': GrammarPunct
  },
  true
);

/* ------------------------------------------------------------------ 1  Blot */

class MarkBlot extends Inline {
  static blotName = 'mark'; // format key, e.g. { mark: true }
  static tagName = 'mark'; // real DOM element <mark>
  static className = 'word-highlight'; // optional CSS hook
}

/* ------------------------------------------------------------------ 2  Register */
Quill.register({ 'formats/mark': MarkBlot }, /*suppressWarning=*/ true);

const quill1 = new Quill('#inputText', {
  theme: 'snow',
  modules: {
    // --- CORRECTED PART ---
    // Instead of 'toolbar: false', provide an empty array to ensure
    // the toolbar module is loaded, which quill-table-better depends on.
    toolbar: [],

    clipboard: {
      matchVisual: false,
      matchers: MSWORD_MATCHERS
    },
    // disable the built-in table if you had it on
    table: false,

    // turn on the enhanced table
    'table-better': {
      // your options here (you can leave empty for defaults)
      operationMenu: {
        items: {
          unmergeCells: {
            text: 'Unmerge cells'
          }
        }
      }
    },

    // wire up the keyboard nav that the plugin provides
    keyboard: {
      bindings: QuillTableBetter.keyboardBindings
    }
    // Note: The 'matchVisual: false' key was duplicated, I have removed it from here.
    // It correctly belongs inside the 'clipboard' options.
  },
  placeholder: 'Skriv eller indtal din tekst for at rette grammatikken på dansk…'
});
window.quill1 = quill1;
/* ------------------------------------------------------------------ 4  Clipboard matchers */
function mark(attr) {
  return (node, delta) => {
    delta.ops.forEach(op => {
      op.attributes = { ...(op.attributes || {}), [attr]: true };
    });
    return delta;
  };
}

quill1.clipboard.addMatcher('ham-dan.grammar-correction-added', mark('grammar-added'));
quill1.clipboard.addMatcher('ham-dan.grammar-correction-removed', mark('grammar-removed'));
quill1.clipboard.addMatcher('ham-dan.grammar-correction-punctuation', mark('grammar-punct'));

function flag(attr) {
  return (node, delta) => {
    delta.ops.forEach(op => {
      op.attributes = { ...(op.attributes || {}), [attr]: true };
    });
    return delta;
  };
}

// keep pasted <mark> highlights
quill1.clipboard.addMatcher('mark.word-highlight', flag('mark'));

// ================================= Fixed Quill editor ====================================

// Event handlers
quill1.on('text-change', function (delta, oldDelta, source) {
  adjustHeights();
});

function updatePlaceholder(lang) {
  if (quill1) {
    const placeholderText = `Skriv eller indtal din tekst for at rette grammatikken på ${lang.toLowerCase()}...`;
    quill1.root.setAttribute('data-placeholder', placeholderText);
  } else {
    console.error('Quill editor not initialized.');
  }
}

// ============================== Global Document ==============================
const mainSwitcher = document.getElementById('mainSwitcher');
// =============================== Language Dropdown ==============================
document.addEventListener('DOMContentLoaded', () => {
  initLanguageDropdown('da', updatePlaceholder);
});

// ================================ toggle code =====================================
document.getElementById('correction-toggle').addEventListener('change', e => {
  if (e.target.checked) {
    toggleState = true;
  } else {
    toggleState = false;
  }

  //console.log(toggleState);
  if (toggleState !== cookieToggleState) {
    setCookie('korrektur-toggle', toggleState, 30); // Save for 30 days
  }
  actionOnToggle(toggleState);
});

// -------------- cookies code for saving the value of the toggle previous --------------

document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth < 450) {
    toggleState = true;
    console.log('it is called');
  } else {
    if (getCookie('korrektur-toggle') === null) {
      setCookie('korrektur-toggle', true, 30);
    }
    cookieToggleState = getCookie('korrektur-toggle') === 'true';
    toggleState = cookieToggleState;
  }
  actionOnToggle(toggleState);
});

function actionOnToggle(toggleState) {
  console.log('language is this ', getCurrentLanguage());
  //console.log("toggleState in action", toggleState);
  //console.log("toggle state element check ", document.getElementById('correction-toggle').checked);
  document.getElementById('correction-toggle').checked = toggleState;
  let lengendDots = document.querySelector('#legend-section');
  lengendDots.style.display = toggleState ? 'flex' : 'none';

  const mainTextAreaToggle = document.querySelector('.main-textarea-section');
  const correctionSidebarToggle = document.querySelector('.correction-sidebar');
  const isMobileToggle = window.innerWidth <= 767;
  hideUnderlines(toggleState);
  callSidebar();
  if (!isMobileToggle) {
    if (toggleState) {
      mainTextAreaToggle.style.flexBasis = '74%';
      correctionSidebarToggle.style.flexBasis = '25%';
      correctionSidebarToggle.style.maxWidth = '25%';
      correctionSidebarToggle.style.minWidth = '25%';
      correctionSidebarToggle.style.display = 'flex';
    } else {
      mainTextAreaToggle.style.flexBasis = '100%';
      correctionSidebarToggle.style.display = 'none';
    }
  } else {
    mainTextAreaToggle.style.flexBasis = '100%';
    correctionSidebarToggle.style.display = 'none';
  }
  // ! later height
  // requestAnimationFrame(syncContentHeights);
  adjustInputTextareaHeight();
}
function hideUnderlines(flag) {
  //console.log("in the hideUnderlines value of flag", flag);
  const textContainer = document.getElementById('inputText');
  if (!textContainer) return;

  const spans = textContainer.querySelectorAll(
    'ham-dan.grammar-correction-added, ham-dan.grammar-correction-removed, ham-dan.grammar-correction-punctuation'
  );
  //console.log("Filtered spans:", spans);

  spans.forEach(span => {
    if (!flag) {
      //console.log("Hiding underlines and removed words");
      span.style.borderBottom = 'none';
      if (span.classList.contains('grammar-correction-removed')) {
        span.style.display = 'none';
      }
    } else {
      //console.log("Showing underlines and removed words");
      span.style.borderBottom = '2px solid';
      if (span.classList.contains('grammar-correction-added')) {
        span.style.borderColor = '#1768FE';
      } else if (span.classList.contains('grammar-correction-removed')) {
        span.style.display = 'inline';
        span.style.borderColor = '#C00F0C';
      } else if (span.classList.contains('grammar-correction-punctuation')) {
        span.style.borderColor = '#E5A000';
      }
    }
  });

  adjustInputTextareaHeight();
}

// ------------------------correction tab switching-------------------------

const dropdownButton = document.querySelector('.hk-dropdown-button');
const dropdownContent = document.querySelector('.hk-dropdown-content');
const dropdownOptions = document.querySelectorAll('.hk-dropdown-option');
const correctionInner = document.querySelector('.correction-inner');
const styleInner = document.querySelector('.style-inner');
const improvInner = document.querySelector('.improv-inner');

// Function to update selected option
function updateSelectedOption(option) {
  const selectedIcon = dropdownButton.querySelector('svg:first-child');
  const selectedText = dropdownButton.querySelector('.hk-dropdown-text');
  const optionIcon = option.querySelector('svg').cloneNode(true);
  const optionText = option.querySelector('span').textContent;
  //console.log("updateSelectedOption", option);
  // Update icon and text
  selectedIcon.replaceWith(optionIcon);
  selectedText.textContent = optionText;

  // Update active states
  dropdownOptions.forEach(opt => opt.classList.remove('active'));
  option.classList.add('active');

  if (option.dataset.option === 'smart-help') {
    improvInner.style.display = 'none';
    correctionInner.style.display = 'flex';
    styleInner.style.display = 'none';
    optionIcon.querySelectorAll('path').forEach(path => {
      if (path.getAttribute('stroke') === '#929292') {
        path.setAttribute('stroke', '#E24668');
      }
    });
    const gifInsider = document.querySelector('.correction-inner .demo-inner #gif');
    if (gifInsider && !gifInsider.querySelector('svg')) {
      lottieLoadAnimationByAddress(gifInsider);
    }
    console.log('inside the smart-help', gifInsider);
  } else if (option.dataset.option === 'change-style') {
    improvInner.style.display = 'none';
    correctionInner.style.display = 'none';
    styleInner.style.display = 'flex';
    optionIcon.querySelectorAll('path').forEach(path => {
      path.setAttribute('stroke', '#E24668');
    });
  } else if (option.dataset.option === 'improve-text') {
    improvInner.style.display = 'flex';
    correctionInner.style.display = 'none';
    styleInner.style.display = 'none';

    optionIcon.querySelectorAll('path, line, polyline').forEach(element => {
      element.setAttribute('stroke', '#E24668');
    });
  }

  onUpdateSelectOption(option);
  // ! remember to fix this
  // syncContentHeights();
}
// Toggle dropdown
dropdownButton.addEventListener('click', () => {
  const isOpen = dropdownContent.classList.contains('show');
  dropdownContent.classList.toggle('show');
  dropdownButton.classList.toggle('active');
});

// Handle option selection
dropdownOptions.forEach(option => {
  option.addEventListener('click', () => {
    updateSelectedOption(option);
    dropdownContent.classList.remove('show');
    dropdownButton.classList.remove('active');
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', event => {
  if (!dropdownButton.contains(event.target)) {
    dropdownContent.classList.remove('show');
    dropdownButton.classList.remove('active');
  }
});

// Initialize with the first option selected
window.addEventListener('DOMContentLoaded', () => {
  // Set the first option as selected
  updateSelectedOption(dropdownOptions[0]);

  // Ensure improv-inner is visible by default
  const improvInner = document.querySelector('.improv-inner');
  const correctionInner = document.querySelector('.correction-inner');
  const styleInner = document.querySelector('.style-inner');

  improvInner.style.display = 'flex';
  correctionInner.style.display = 'none';
  styleInner.style.display = 'none';
});

// Function to update dropdown based on which panel is shown
function updateDropdownFromPanel(panel) {
  // Find the appropriate option based on which panel is passed
  let targetOption;
  if (panel === correctionInner) {
    targetOption = document.querySelector('.hk-dropdown-option[data-option="smart-help"]');
  } else if (panel === styleInner) {
    targetOption = document.querySelector('.hk-dropdown-option[data-option="change-style"]');
  }

  // If we found a matching option, update the dropdown
  if (targetOption) {
    updateSelectedOption(targetOption);
  }
}
function onUpdateSelectOption(option) {
  if (option.dataset.option === 'smart-help') {
    // console.log("in onUpdateSelectOption it is smart-help")
    // console.log("result of lastCorrectedText != ''", lastCorrectedText != '')

    if (lastCorrectedText != '' && isSmartCalled == false) {
      // ✅ Show loaders before calling analyzeTranslatedText
      showLoader('.correction-message', 'Analyzing...');
      analyseLoader(true);
      console.log('on update selection analyzeTranslatedText');
      analyzeTranslatedText();
      // console.log("calling in the smart-help")
    } else {
      // ✅ If no API call needed, make sure loaders are hidden
      hideLoader('.correction-message');
      analyseLoader(false);
    }
  } else if (option.dataset.option === 'improve-text') {
    // ✅ Show loader if explanations will be processed
    if (noOfChanges > 0 && !isExplanations) {
      showLoader('.correction-message', 'Analyzing...');
    }

    callImproveSidebar();
  } else if (option.dataset.option === 'change-style') {
    // ✅ Make sure loaders are hidden for style tab
    hideLoader('.correction-message');
    analyseLoader(false);
  }
  clearHighlights();
  adjustHeights();
}
// ----------------------------- Check the sidebar
function callSidebar() {
  if (toggleState && window.innerWidth > 767) {
    const dropDownValue = document.querySelector('.hk-dropdown-text').textContent;
    // console.log("dropDownValue", dropDownValue);

    if (dropDownValue === 'Grammatik') {
      // ✅ Show loader if explanations will be processed
      if (noOfChanges > 0 && !isExplanations) {
        showLoader('.correction-message', 'Analyzing...');
      }
      callImproveSidebar();
    } else if (dropDownValue === 'Smart teksthjælp') {
      // console.log("Retter teksten call started");
      // console.log("starting the analysis");

      if (lastCorrectedText != '' && isSmartCalled == false) {
        // ✅ Show loaders before calling analyzeTranslatedText
        showLoader('.correction-message', 'Analyzing...');
        analyseLoader(true);
        console.log('call sidebar analyzeTranslatedText');
        analyzeTranslatedText();
      } else {
        // ✅ If no API call needed, make sure loaders are hidden
        // hideLoader('.correction-message');
        // analyseLoader(false);
      }
    }
  }
}

// =================================================== gen button ================================

function callImproveSidebar() {
  if (noOfChanges != -1) {
    if (noOfChanges == 0) {
      hideLoader('.correction-message');
      noChangeResultImproveInner();
      analyseLoader(false);
      return;
    }

    if (noOfChanges > 0 && !isExplanations) {
      // console.log("\n=================================Data sending to the explanation api=============================\n");
      // console.log("user input", originalContent.text);
      // console.log("corrected text", correctedText);
      // console.log("no of changes", noOfChanges);

      // ✅ Only show loader if not already shown
      // (this prevents duplicate loader calls when switching tabs)
      const existingLoader = document.querySelector('.gradient-loader');
      if (!existingLoader) {
        showLoader('.correction-message', 'Analyzing...');
      }

      // Check if we have multiple HTML parts (same logic as correction)
      const htmlParts = window.currentHtmlParts || [originalContent.html];

      if (htmlParts.length === 1) {
        // Single part - use existing single API call
        let spanList = collectSpanTags(diffHTMLExp);
        // console.log("Span tag list ", spanList);

        grammerApi('explanations', {
          original: originalContent.text,
          corrected: correctedText,
          noOfChanges: noOfChanges.toString(),
          grammarClasses: JSON.stringify(spanList)
        })
          .then(explanationResults => {
            isExplanations = true;
            processGrammarExplanations(explanationResults);
            hideLoader('.correction-message');
            analyseLoader(false);
          })
          .catch(error => {
            console.error('Explanation API Error:', error);
            handleExplanationError();
          });
      } else {
        // Multiple parts - use parallel processing
        // console.log("Processing explanations in parallel for", htmlParts.length, "parts");

        // Prepare parameters for each part
        const explanationParts = prepareExplanationParts(htmlParts);
        // console.log("Pattern Recieving ExplanationParts Sending", explanationParts);

        grammerApiParallel('explanations', explanationParts)
          .then(explanationResults => {
            // Combine results
            // console.log("explanationResults", explanationResults);
            const combinedExplanations = combineExplanationResults(explanationResults);
            // console.log("combinedExplanations", combinedExplanations);
            isExplanations = true;
            processGrammarExplanations(combinedExplanations);
            hideLoader('.correction-message');
            analyseLoader(false);
          })
          .catch(error => {
            console.error('Parallel Explanation API Error:', error);
            // Fallback to single explanation call
            // fallbackToSingleExplanation();
            handleExplanationError();
          });
      }
    } else {
      // ✅ If explanations already processed, just hide loaders
      hideLoader('.correction-message');
      analyseLoader(false);
    }
  } else {
    // ✅ If no changes processed yet, hide loaders
    hideLoader('.correction-message');
    analyseLoader(false);
  }
}

function updateGenerateButtonState() {
  // Variables used for the elements in the DOM
  let inputText1 = quill1;
  const wordCount = document.querySelector('.word-count');
  const charLimitWarning = document.querySelector('.char-limit-warning');
  const wordCounterDiv = document.querySelector('.word-counter-div');
  const charCount2 = inputText1 ? quill1.getText().trim().length : 0;
  let generateBtn = document.querySelector('#genBtn');
  const counterNav = document.querySelector('.counter-nav-div');

  // Set limits based on membership status
  const charLimit = activeMember ? 20000 : 500;
  const hasText = quill1.getText().trim().length > 0 && quill1.getText().trim().length <= charLimit;
  const overlimit = quill1.getText().trim().length > charLimit;

  // Handle layout and styling based on membership
  if (activeMember) {
    // Unlimited version layout and styling
    wordCounterDiv.style.display = overlimit ? 'flex' : 'none';
    wordCounterDiv.style.flexDirection = 'column';
    // counterNav.style.marginTop = '0px';
    // Style the warning message for unlimited
    if (charLimitWarning) {
      // counterNav.style.marginTop = '15px';
      charLimitWarning.style.color = '#606060';
      charLimitWarning.style.fontSize = '14px';
      charLimitWarning.style.marginBottom = '9px';
      charLimitWarning.textContent = 'Fjern lidt tekst – så hjælper robotten bedre.';
    }

    // Style the word count for unlimited
    if (wordCount) {
      wordCount.style.color = '#606060';
      wordCount.style.fontSize = '14px';
      wordCount.style.marginBottom = '8px';

      const formattedCount = charCount2.toLocaleString('da-DK');
      const overBy = (charCount2 - 20000).toLocaleString('da-DK');
      wordCount.textContent = `${formattedCount}/20.000 tegn (${overBy} over)`;
    }
  } else {
    // Limited version layout and styling
    counterNav.style.marginTop = '15px';
    wordCounterDiv.style.display = 'flex';
    wordCounterDiv.style.flexDirection = 'row';

    // Style the word count for limited
    if (wordCount) {
      wordCount.style.color = '#606060';
      wordCount.style.fontSize = '14px';
      wordCount.style.marginBottom = '0px';
      wordCounterDiv.style.flexDirection = 'row-reverse';
      const formattedCount = charCount2.toLocaleString('da-DK');
      wordCount.textContent = `${formattedCount}/500 tegn`;
    }

    // Style the warning message for limited
    if (charLimitWarning) {
      charLimitWarning.style.display = overlimit ? 'inline' : 'none';
      charLimitWarning.classList.add('char-limit-warning-limited');
      charLimitWarning.innerHTML = `&nbsp;• <a class="char-limit-warning-red" href="https://login.skrivsikkert.dk/konto/" target="_blank">Opgrader</a> eller slet tekst`;
    }
  }

  // Common button state logic
  if (hasText) {
    generateBtn.disabled = false;
    generateBtn.style.backgroundColor = 'rgb(232, 107, 134)';
    generateBtn.style.color = '#FFFFFF';
    generateBtn.style.cursor = 'pointer';
    generateBtn.style.opacity = '1';
  } else {
    if (quill1.getText().trim().length === 0) {
      quill1.setText('');
    }
    // Disable button and update styles
    generateBtn.disabled = true;
    generateBtn.style.backgroundColor = '#FFFFFF';
    generateBtn.style.color = '#111111';
    generateBtn.style.cursor = 'not-allowed';
    generateBtn.style.border = '1px solid grey';
    generateBtn.style.opacity = '0.7';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  updateGenerateButtonState();
});
quill1.on('text-change', updateGenerateButtonState);

// ! +++++++++++++++++++++++++++++++++++++++++++++++ comparison code ++++++++++++++++++++++++++++++++++

function htmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function htmlToTextWithSpacing(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  /* ───────────────────── 1. <br> → newline ───────────────────── */
  tempDiv.querySelectorAll('br').forEach(br => {
    console.log('Replacing <br> with \\n');
    br.replaceWith(document.createTextNode('\n'));
  });

  /* ───────────────────── 2. block-level spacing ───────────────────── */
  const blockElements = tempDiv.querySelectorAll(
    'div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, tr, blockquote'
  );

  blockElements.forEach(el => {
    /* Detect a “strong paragraph” ⇢ <p><strong>…</strong></p> */
    const isStrongParagraph =
      el.tagName === 'P' &&
      el.childNodes.length === 1 &&
      el.firstChild.nodeType === Node.ELEMENT_NODE &&
      el.firstChild.tagName === 'STRONG';

    /* Normal headings OR our special strong-only paragraph */
    const isHeading = /^H[1-6]$/i.test(el.tagName) || isStrongParagraph;
    const spacing = isHeading ? '\n\n' : '\n';

    /* insert AFTER the element (existing behaviour) */
    const afterNode = document.createTextNode(spacing);
    el.parentNode.insertBefore(afterNode, el.nextSibling);

    /* if heading-like, also insert BEFORE the element */
    if (isHeading) {
      const beforeNode = document.createTextNode(spacing);
      el.parentNode.insertBefore(beforeNode, el);
    }

    console.log(
      `Processing <${el.tagName.toLowerCase()}>: ${
        isHeading ? 'heading-like' : 'block'
      } – spacing "${JSON.stringify(spacing)}"`
    );
  });

  /* ───────────────────── 3. &nbsp; → space ───────────────────── */
  tempDiv.innerHTML = tempDiv.innerHTML.replace(/&nbsp;/g, ' ');

  /* ───────────────────── 4. extract text ───────────────────── */
  let textContent = tempDiv.textContent || tempDiv.innerText || '';

  /* ───────────────────── 5. collapse ≥2 blank lines to exactly 2 ───────────────────── */
  textContent = textContent.replace(/\n\s*\n/g, '\n\n');

  console.log('Final text content:', JSON.stringify(textContent));
  return textContent;
}

function filterHtmlParts(htmlParts) {
  const parser = new DOMParser();

  return htmlParts.filter((html, ind) => {
    const doc = parser.parseFromString(html, 'text/html');
    const innerText = doc.body.innerText || '';
    // console.log(`Part ${ind}:`, innerText.length);
    return innerText.trim().length > 0;
  });
}

document.querySelector('#genBtn').addEventListener('click', async () => {
  clearHighlights();
  resetNavText();
  stopSpeaking();
  manuallyCloseMicButton('micButton1');
  noOfChanges = 0;
  resetSidebar();
  document.querySelector('.correction-options').style.display = 'flex';
  isUndo = false;
  isSmartCalled = false;
  isExplanations = false;
  lastCorrectedText = '';
  showLoader('.textarea-wrapper', 'Retter teksten...');
  showLoader('.correction-message', 'Analyzing...');
  analyseLoader(true);

  try {
    const clonedElement = quill1.root.cloneNode(true);
    clonedElement
      .querySelectorAll('ham-dan.grammar-correction-removed')
      .forEach(hamDan => hamDan.remove());

    originalContent.text = quill1.getText();

    // *** IMPORTANT: Get the raw HTML first ***
    let rawHtml = clonedElement.innerHTML;
    console.log('Raw HTML before emoji normalization:', rawHtml);

    // *** NEW: Normalize emojis BEFORE any other processing ***
    rawHtml = normalizeEmojisInHtml(rawHtml);
    console.log('HTML after emoji normalization:', rawHtml);

    // *** NOW assign the normalized HTML ***
    originalContent.html = rawHtml;

    console.log('before the htmlpar', originalContent.html);

    let htmlParts = processComplexHtml(originalContent.html);
    // console.log("just got htmlParts", htmlParts)
    htmlParts = filterHtmlParts(htmlParts);
    // htmlParts.map((part, ind) => console.log("this is part", ind, part))
    window.currentHtmlParts = htmlParts;
    console.log('htmlParts', htmlParts);
    correctedResults = [];
    // console.log("this is htmlParts", htmlParts)
    if (htmlParts.length === 1) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlParts[0];
      console.log('this is partText', tempDiv.innerHTML);
      const partText = htmlToTextWithSpacing(tempDiv.innerHTML);
      correctedResults = [
        await grammerApi('correction', {
          language: getCurrentLanguage(),
          text: partText
        })
      ];
    } else {
      const partsParams = htmlParts.map(part => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = part;
        // console.log("this is partText", htmlToTextWithSpacing(tempDiv.innerHTML))
        return {
          language: getCurrentLanguage(),
          text: htmlToTextWithSpacing(tempDiv.innerHTML)
        };
      });
      correctedResults = await grammerApiParallel('correction', partsParams);
    }

    correctedText = correctedResults.join(' ');

    const diffs = htmlParts.map((part, idx) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = part;
      const partText = htmlToTextWithSpacing(tempDiv.innerHTML);
      return identifyDifferences(partText, correctedResults[idx]);
    });
    // console.log("correctedResults", correctedResults)
    const diffHTMLs = diffs.map(generateDiffHTML);
    // console.log("diffHTMLs", diffHTMLs)
    const diffHtml = diffHTMLs.join('');
    diffHTMLExp = diffHtml;
    diffHTMLParts = diffHTMLs;

    noOfChanges = countSpanTags(diffHtml);
    // console.log("total number of changes", noOfChanges);
    mainSwitcher.disabled = false;
    isMainSwtich = true;
    switcherText = '';

    quill1.setContents([]);

    const htmlRes = marked.parse(diffHtml);
    const safeHTML = DOMPurify.sanitize(htmlRes, {
      ADD_TAGS: ['ham-dan'],
      ADD_ATTR: ['class'],
      ALLOWED_ATTR: ['class'],
      KEEP_CONTENT: true
    });

    quill1.clipboard.dangerouslyPasteHTML(0, safeHTML, 'api');
    hideUnderlines(toggleState);

    // ✅ Start both formatting and sidebar (explanations) in parallel
    // Each will handle their own loaders

    // Start formatting (this will handle .textarea-wrapper loader)
    if (htmlParts.length === 1) {
      formatCallingWithLoader(getCurrentLanguage(), originalContent.html, diffHtml);
    } else {
      const formattingParts = htmlParts.map((htmlPart, index) => ({
        userInputText: htmlPart,
        correctedText: diffHTMLs[index]
      }));

      formatCallingParallelWithLoader(getCurrentLanguage(), formattingParts, diffHtml);
    }

    // Start sidebar (explanations) - this will handle .correction-message loader and analyseLoader
    callSidebar();

    adjustInputTextareaHeight();
  } catch (error) {
    console.error('Processing error:', error);
    hideLoader('.textarea-wrapper');
    hideLoader('.correction-message');
    analyseLoader(false);
  }
});

function countSpanTags(htmlString) {
  const matches = htmlString.match(/<ham-dan[^>]*>/g);
  return matches ? matches.length : 0;
}
// Initialize settings for word-level diff only
const SETTINGS = {
  // Basic diff settings
  diffTimeout: 15.0, // Increase computation time for better results
  diffEditCost: 6, // Higher value prefers word boundaries
  // Word-level settings
  minWordLength: 2, // Minimum length to consider a standalone word
  contextSize: 3, // Words of context to consider for better matches
  // Advanced settings
  useWordDiff: true, // Use word-level diffing algorithm
  useLCS: true, // Use Longest Common Subsequence for better matching
  useSemanticCleaning: true, // Use semantic cleaning
  ignoreWhitespace: true, // Consider whitespace changes or not
  caseSensitive: true, // Case sensitive comparison by default
  highlightPunctuation: true // Highlight punctuation changes by default
};

// Function to identify differences between original and corrected text
function identifyDifferences(originalText, correctedText) {
  // Apply preprocessing based on settings
  let processedOriginalText = originalText;
  let processedCorrectedText = correctedText;

  // Case insensitive if needed
  if (!SETTINGS.caseSensitive) {
    processedOriginalText = processedOriginalText.toLowerCase();
    processedCorrectedText = processedCorrectedText.toLowerCase();
  }

  // Normalize whitespace if needed
  if (SETTINGS.ignoreWhitespace) {
    processedOriginalText = processedOriginalText.replace(/\s+/g, ' ').trim();
    processedCorrectedText = processedCorrectedText.replace(/\s+/g, ' ').trim();
  }

  // Apply pure word-level diff algorithm
  const diffResult = pureWordDiff(processedOriginalText, processedCorrectedText);

  // Return the optimized diff result
  return diffResult;
}

// Pure word-level diff implementation - uses its own algorithm instead of converting from character diff
function pureWordDiff(oldText, newText) {
  // Split text into words and spaces
  const wordPattern = /[^\s]+|\s+/g;
  const oldWords = oldText.match(wordPattern) || [];
  const newWords = newText.match(wordPattern) || [];

  // Create a matrix for dynamic programming approach
  const matrix = Array(oldWords.length + 1)
    .fill()
    .map(() => Array(newWords.length + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= oldWords.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= newWords.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix - Wagner-Fischer algorithm for edit distance
  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Higher cost for word substitution to prefer insertions/deletions
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + SETTINGS.diffEditCost // substitution with higher cost
        );
      }
    }
  }

  // Backtrack to find the operations
  const diff = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      // Words match - no change
      diff.unshift([0, oldWords[i - 1]]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] <= matrix[i - 1][j])) {
      // Insert word from new text
      diff.unshift([1, newWords[j - 1]]);
      j--;
    } else if (i > 0) {
      // Delete word from old text
      diff.unshift([-1, oldWords[i - 1]]);
      i--;
    }
  }

  // Post-process the diff to handle special cases
  return postProcessDiff(diff);
}

// Process the diff to merge adjacent changes and handle special cases
function postProcessDiff(diff) {
  // Merge adjacent changes of the same type
  const mergedDiff = mergeAdjacentChanges(diff);

  // Apply special handling for punctuation if needed
  if (SETTINGS.highlightPunctuation) {
    return handlePunctuation(mergedDiff);
  }

  return mergedDiff;
}

// Merge adjacent changes of the same type for cleaner output
function mergeAdjacentChanges(diff) {
  const result = [];
  let lastType = null;
  let lastText = '';

  diff.forEach(part => {
    if (part[0] === lastType) {
      // Same type as previous, merge them
      lastText += part[1];
    } else {
      // Different type, add the previous one if it exists
      if (lastType !== null) {
        result.push([lastType, lastText]);
      }
      // Start new accumulation
      lastType = part[0];
      lastText = part[1];
    }
  });

  // Add the last accumulated part
  if (lastType !== null) {
    result.push([lastType, lastText]);
  }

  return result;
}

function handlePunctuation(diff) {
  const result = [];

  // Define a function to check for word-with-punctuation patterns
  const isPunctuationOnly = (word1, word2) => {
    // Extract the non-punctuation part of each word
    const baseWord1 = word1.replace(/[,.!?;:]+/g, '');
    const baseWord2 = word2.replace(/[,.!?;:]+/g, '');

    // If the base words are the same but the original words are different,
    // then the difference is only in punctuation
    return baseWord1 === baseWord2 && word1 !== word2;
  };

  // Check if a string is only punctuation
  const isPunctuationString = str => {
    return /^[,.!?;:]+$/.test(str);
  };

  // First pass: Look for pairs of deleted/added text that might represent punctuation changes
  for (let i = 0; i < diff.length; i++) {
    const current = diff[i];
    const next = i + 1 < diff.length ? diff[i + 1] : null;
    const nextNext = i + 2 < diff.length ? diff[i + 2] : null;
    const nextNextNext = i + 3 < diff.length ? diff[i + 3] : null;

    // Skip unchanged text
    if (current[0] === 0) {
      result.push(current);
      continue;
    }

    // Enhanced pattern: [0, text] [-1, word] [0, " "] [-1, punctuation] [1, word+punctuation]
    if (current[0] === -1 && next && next[0] === 0) {
      // Check if the previous item was also unchanged text
      const prev = i > 0 ? diff[i - 1] : null;

      if (prev && prev[0] === 0) {
        // Check if the next is a space and followed by punctuation removal and addition
        if (
          next[1] === ' ' &&
          nextNext &&
          nextNext[0] === -1 &&
          isPunctuationString(nextNext[1]) &&
          nextNextNext &&
          nextNextNext[0] === 1 &&
          nextNextNext[1].endsWith(nextNext[1])
        ) {
          // This matches our enhanced pattern, mark the addition with punctuation class
          result.push([2, ' ' + nextNextNext[1]]);

          // Skip the next items since we've processed them
          i += 3; // Skip next, nextNext, and nextNextNext
          continue;
        } else {
          // This is a simple word removal pattern
          // Mark with a special type [3] to indicate simple word removal
          result.push([3, current[1]]);
          continue;
        }
      }
    }

    // Check for deletion followed by addition (a potential punctuation change)
    if (current[0] === -1 && next && next[0] === 1) {
      // If the only difference is punctuation, mark the whole word
      if (isPunctuationOnly(current[1], next[1])) {
        // Push a special type [2] to indicate punctuation-only change for the whole word
        result.push([2, next[1]]);
        i++; // Skip the next item since we've processed it
        continue;
      }
    }

    // Check for addition followed by deletion (also a potential punctuation change)
    if (current[0] === 1 && next && next[0] === -1) {
      // If the only difference is punctuation, mark the whole word
      if (isPunctuationOnly(current[1], next[1])) {
        // Push a special type [2] to indicate punctuation-only change for the whole word
        result.push([2, current[1]]);
        i++; // Skip the next item since we've processed it
        continue;
      }
    }

    // Handle words where punctuation might have been added or removed
    const hasPunctuation = /[,.!?;:]+/.test(current[1]);
    const wordWithoutPunctuation = current[1].replace(/[,.!?;:]+/g, '');

    // Look ahead and behind for potential matches (words that differ only in punctuation)
    let foundPunctuationOnlyMatch = false;

    // Check previous item
    if (i > 0) {
      const prev = diff[i - 1];
      if (prev[0] !== 0 && prev[0] !== current[0]) {
        // Different operation type (add vs delete)
        const prevWithoutPunctuation = prev[1].replace(/[,.!?;:]+/g, '');
        if (wordWithoutPunctuation === prevWithoutPunctuation) {
          // Already processed as part of the previous iteration
          foundPunctuationOnlyMatch = true;
        }
      }
    }

    // Check next item
    if (!foundPunctuationOnlyMatch && next) {
      if (next[0] !== 0 && next[0] !== current[0]) {
        // Different operation type
        const nextWithoutPunctuation = next[1].replace(/[,.!?;:]+/g, '');
        if (wordWithoutPunctuation === nextWithoutPunctuation) {
          // Will be processed in the next iteration
          foundPunctuationOnlyMatch = true;
        }
      }
    }

    // If no punctuation-only match was found, process normally
    if (!foundPunctuationOnlyMatch) {
      result.push(current);
    }
  }

  return result;
}
// Generate HTML with underlined differences
function generateDiffHTML(diff) {
  let resultHtml = '';

  // We'll only show specific removed text (type 3) that match our pattern
  const highlightPunctuation = SETTINGS.highlightPunctuation;

  for (let i = 0; i < diff.length; i++) {
    const part = diff[i];

    if (part[0] === 3) {
      // Simple word removal (not replaced by anything)
      // Mark with grammar-correction-removed class
      resultHtml += `<ham-dan class="grammar-correction-removed">${part[1]}</ham-dan>`;
    } else if (part[0] === 2) {
      // Punctuation-only change (whole word marking)
      // Mark the entire word with the punctuation class
      resultHtml += `<ham-dan class="grammar-correction-punctuation">${part[1]}</ham-dan>`;
    } else if (part[0] === 1) {
      // Added text
      // Check if it's purely punctuation
      if (highlightPunctuation && /^[,.!?;:]+$/.test(part[1])) {
        // Underline added punctuation
        resultHtml += `<ham-dan class="grammar-correction-punctuation">${part[1]}</ham-dan>`;
      } else if (/^\s+$/.test(part[1])) {
        // Whitespace changes
        resultHtml += part[1];
      } else {
        // Check if this word contains punctuation that might be the only change
        const hasPunctuation = /[,.!?;:]+/.test(part[1]);
        if (hasPunctuation && highlightPunctuation) {
          // Look for the corresponding removed word to compare
          const prevPart = i > 0 ? diff[i - 1] : null;
          const nextPart = i < diff.length - 1 ? diff[i + 1] : null;

          // Check if previous or next part is a removal and differs only in punctuation
          if (
            (prevPart &&
              prevPart[0] === -1 &&
              part[1].replace(/[,.!?;:]+/g, '') === prevPart[1].replace(/[,.!?;:]+/g, '')) ||
            (nextPart &&
              nextPart[0] === -1 &&
              part[1].replace(/[,.!?;:]+/g, '') === nextPart[1].replace(/[,.!?;:]+/g, ''))
          ) {
            // This is a word that differs only in punctuation
            resultHtml += `<ham-dan class="grammar-correction-punctuation">${part[1]}</ham-dan>`;
          } else {
            // This is a regular addition
            resultHtml += `<ham-dan class="grammar-correction-added">${part[1]}</ham-dan>`;
          }
        } else {
          // For regular text, underline the whole thing as added
          resultHtml += `<ham-dan class="grammar-correction-added">${part[1]}</ham-dan>`;
        }
      }
    } else if (part[0] === -1) {
      // Skip all other removed words - we only want to show the special type 3 removals
      // This is intentionally empty - we don't display regular removed words
    } else if (part[0] === 0) {
      // Unchanged text
      // Don't highlight punctuation in unchanged text
      resultHtml += part[1];
    }
  }

  return resultHtml;
}

// =========================================== utility functions ===============================================
function takeCurrentText() {
  return quill1.root.innerHTML;
}

function collectSpanTags(htmlString) {
  // console.log("in the collectSpanTags function this is htmlString: " + htmlString);
  const results = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Get all <ham-dan> elements
  const hamDanElements = doc.querySelectorAll('ham-dan');

  hamDanElements.forEach(el => {
    // Get flattened text content including text of inner tags
    const textContent = el.textContent;

    // Clone the original tag and replace its content with flat text
    const cloned = el.cloneNode(false); // shallow clone (no children)
    cloned.textContent = textContent;

    // Push the new outerHTML
    results.push(cloned.outerHTML);
  });

  // console.log("results: ", results);
  return results;
}

function cleanMarkdown(markdownText) {
  return markdownText;
}

function cleanHTML(html) {
  // Create a DOM parser
  const parser = new DOMParser();

  // Parse the HTML string into a document
  const doc = parser.parseFromString(html, 'text/html');

  /**
   * Recursively clean elements and remove empty ones
   * @param {Element} element - Element to process
   * @returns {boolean} - True if element has text content (directly or in children) or is a br tag
   */
  function cleanElement(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    // Convert styled spans to semantic elements before removing attributes
    if (element.tagName.toLowerCase() === 'span') {
      // Get the style attribute
      const styleAttr = element.getAttribute('style');

      if (styleAttr) {
        // Check for bold styling
        if (
          styleAttr.includes('font-weight: 700') ||
          styleAttr.includes('font-weight:700') ||
          styleAttr.includes('font-weight:bold') ||
          styleAttr.includes('font-weight: bold')
        ) {
          // Replace span with strong
          const strong = document.createElement('strong');
          while (element.firstChild) {
            strong.appendChild(element.firstChild);
          }
          element.parentNode.replaceChild(strong, element);
          element = strong;
        }
        // Check for italic styling
        else if (
          styleAttr.includes('font-style: italic') ||
          styleAttr.includes('font-style:italic')
        ) {
          // Replace span with em
          const em = document.createElement('em');
          while (element.firstChild) {
            em.appendChild(element.firstChild);
          }
          element.parentNode.replaceChild(em, element);
          element = em;
        }
      }
    }

    // Always preserve <br> tags
    if (element.tagName.toLowerCase() === 'br') {
      // Remove all attributes from br tags too
      while (element.attributes.length > 0) {
        element.removeAttribute(element.attributes[0].name);
      }
      return true;
    }

    // Remove all attributes from the current element
    while (element.attributes.length > 0) {
      element.removeAttribute(element.attributes[0].name);
    }

    // Check if the element has direct text content (excluding whitespace)
    // But preserve elements with &nbsp; entities
    const hasDirectText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .some(textNode => {
        const content = textNode.textContent;
        // Check for non-breaking space entity or actual non-breaking space character
        return content.trim() !== '' || content.includes('&nbsp;') || content.includes('\u00A0');
      });

    // Track if any child elements have text
    let hasChildWithText = false;

    // Process all child elements recursively
    for (let i = element.children.length - 1; i >= 0; i--) {
      const child = element.children[i];
      const childHasText = cleanElement(child);

      // If child has no text content, remove it
      if (!childHasText) {
        child.remove();
      } else {
        hasChildWithText = true;
      }
    }

    // Return true if this element has direct text or any child with text
    return hasDirectText || hasChildWithText;
  }

  // Start cleaning from the body
  cleanElement(doc.body);

  // Return the cleaned HTML
  return doc.body.innerHTML;
}

//! =================================================== api calls =================================================

function displayResponse(content, scroll = true) {
  const scrollContainer = quill1.scroll.domNode.parentNode;
  let previousScrollTop = 0;

  // 1. Save current scroll position if scroll=false
  if (!scroll) {
    previousScrollTop = scrollContainer.scrollTop;
  }

  // 2. Temporarily disable adjustInputTextareaHeight to prevent interference
  const originalAdjustInputTextareaHeight = adjustInputTextareaHeight;
  let adjustHeightSuppressed = false;
  adjustInputTextareaHeight = () => {
    adjustHeightSuppressed = true;
  };

  // 3. Clear the editor
  quill1.setContents([]);

  // 4. Parse and sanitize the new content
  const html = marked.parse(content);
  const safeHTML = DOMPurify.sanitize(html, {
    ADD_TAGS: ['ham-dan'],
    ADD_ATTR: ['class'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true
  });
  quill1.clipboard.dangerouslyPasteHTML(0, safeHTML, 'api');

  // 5. Handle scroll restoration or auto-scroll
  if (!scroll) {
    // Restore scroll position immediately
    scrollContainer.scrollTop = previousScrollTop;

    // Re-enable adjustInputTextareaHeight
    adjustInputTextareaHeight = originalAdjustInputTextareaHeight;

    // Call adjustInputTextareaHeight now that content is in place
    adjustInputTextareaHeight();

    // One more pass to ensure scroll position stays the same after height adjustments
    scrollContainer.scrollTop = previousScrollTop;
  } else {
    // Re-enable adjustInputTextareaHeight before using it
    adjustInputTextareaHeight = originalAdjustInputTextareaHeight;
    adjustInputTextareaHeight();

    // Move cursor to the end, then scroll editor content to bottom
    const length = quill1.getLength();
    quill1.setSelection(length, 0, 'silent');
    quill1.root.scrollTop = quill1.root.scrollHeight;
    quill1.focus();
  }

  // 6. Restore behaviors and UI state
  hideUnderlines(toggleState);
  updateGenerateButtonState();
}

const grammerApi = async (type, params) => {
  //// console.log(`Making ${type} request with params: `, params);

  // Prepare data for WordPress AJAX
  const data = {
    action: 'hgf_korrektur_grammar',
    type: type,
    params: JSON.stringify(params)
  };

  try {
    const response = await fetch(HGF_ajax_object.ajax_url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;'
      },
      body: new URLSearchParams(data).toString()
    });

    const responseData = await response.json();
    //// console.log(`here is the resposne from ${type} api call: `, responseData);
    if (responseData.success) {
      //// console.log(`${type} response: `, responseData.data);
      return responseData.data;
    } else {
      throw new Error(responseData.data || 'API request failed');
    }
  } catch (error) {
    console.error(`Error in ${type} call: `, error);
    throw error;
  }
};

function removeEmptyPTags(html) {
  return html.replaceAll('<p><br></p>', '');
}
function convertPSpanstoBr(htmlString) {
  // 1. Create a temporary container and set its innerHTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  // 2. Find all <p> elements inside the container
  const paragraphs = Array.from(tempDiv.querySelectorAll('p'));

  // 3. For each <p>, check if it contains exactly one child that is an empty <span>
  paragraphs.forEach(p => {
    const onlyChild = p.firstChild;
    const isSingleEmptySpan =
      p.childNodes.length === 1 &&
      onlyChild.nodeName.toLowerCase() === 'span' &&
      onlyChild.textContent.trim() === '';

    // 4. If it matches <p><span></span></p>, replace the <p> with a <br>
    if (isSingleEmptySpan) {
      const br = document.createElement('br');
      p.parentNode.replaceChild(br, p);
    }
  });

  // 5. Return the updated HTML as a string
  return tempDiv.innerHTML;
}

// ✅ formatCalling that manages its own loader
function formatCallingWithLoader(language, userInputText, correctedText) {
  // Change loader text to indicate formatting stage
  hideLoader('.textarea-wrapper');
  showLoader('.textarea-wrapper', 'Ordner opsætningen...');

  // Validate input
  if (!language || !userInputText || !correctedText) {
    console.error('Missing required parameters');
    hideLoader('.textarea-wrapper');
    return;
  }
  console.log(
    'before tag removal ',
    convertStrongParagraphsToHeadings(removeHamDanTags(userInputText))
  );
  console.log(
    'after tag removal ',
    convertPSpanstoBr(convertStrongParagraphsToHeadings(removeHamDanTags(userInputText)))
  );
  // ✅ CLEAN HAM-DAN TAGS BEFORE SENDING
  let cleanedUserInput = convertPSpanstoBr(
    convertStrongParagraphsToHeadings(removeHamDanTags(userInputText))
  );

  // cleanedUserInput = convertHeadingsToStrong(cleanedUserInput);
  cleanedUserInput = cleanedUserInput;
  // console.log("this is userInputText: ", cleanedUserInput);
  jQuery.ajax({
    url: HGF_ajax_object.ajax_url,
    type: 'POST',
    dataType: 'json',
    data: {
      action: 'hgf_formatting_call',
      language: language,
      userInputText: cleanedUserInput,
      correctedText: correctedText
    },
    beforeSend: function () {
      // console.log("Sending formatting request...");
    },
    success: function (response) {
      if (response.success) {
        // console.log("response from the formatter: ", response.data);
        let formattedResponse = response.data.replace(/\\/g, '');
        formattedResponse = formattedResponse.replace(/```html|```HTML/g, '');
        formattedResponse = formattedResponse.replace(/```/g, '');
        // console.log("response from the formatter: ", formattedResponse);
        lastCorrectedText = formattedResponse;
        onResponseGenerated(removeHamDanTags(formattedResponse));
        displayResponse(formattedResponse);
        const dropDownValue = document.querySelector('.hk-dropdown-text').textContent;
        if (dropDownValue === 'Smart teksthjælp') {
          console.log('in formatting call analyzeTranslatedText');
          analyzeTranslatedText();
        }
        adjustInputTextareaHeight();

        hideLoader('.textarea-wrapper'); // ✅ Hide when formatting completes
      } else {
        console.error('Formatting error:', response.data.message);
        hideLoader('.textarea-wrapper'); // ✅ Hide on error
      }
    },
    error: function (xhr, status, error) {
      console.error('AJAX error:', error);
      hideLoader('.textarea-wrapper'); // ✅ Hide on error
    }
  });
}

function formatCallingParallelWithLoader(language, formattingParts, fallbackDiffHtml) {
  hideLoader('.textarea-wrapper');
  showLoader('.textarea-wrapper', 'Ordner opsætningen...');

  // ✅ CLEAN HAM-DAN TAGS FROM ALL PARTS
  const cleanedFormattingParts = formattingParts.map(part => ({
    // userInputText: convertHeadingsToStrong(removeHamDanTags(part.userInputText)), // ✅ Clean each part
    userInputText: convertPSpanstoBr(
      convertStrongParagraphsToHeadings(removeHamDanTags(part.userInputText))
    ),
    correctedText: part.correctedText
  }));

  formatCallingParallel(language, cleanedFormattingParts)
    .then(formattingResults => {
      // console.log("Parallel formatting results:", formattingResults);
      const combinedResult = combineFormattingResults(formattingResults);
      lastCorrectedText = combinedResult;
      // console.log("here are the combined results from parallel formatting: ", combinedResult);
      displayResponse(combinedResult);
      onResponseGenerated(removeHamDanTags(combinedResult));
      const dropDownValue = document.querySelector('.hk-dropdown-text').textContent;
      if (dropDownValue === 'Smart teksthjælp') {
        console.log('in formatting call parallel analyzeTranslatedText');
        analyzeTranslatedText();
      }
      adjustInputTextareaHeight();
      hideLoader('.textarea-wrapper');
    })
    .catch(error => {
      console.error('Parallel formatting error:', error);
      // ✅ Clean fallback diff HTML too
      // const cleanedFallback = removeHamDanTags(cleanHTML(originalContent.html));
      // formatCallingWithLoader(language, cleanedFallback, fallbackDiffHtml);
    });
}

// ✅ Keep the original formatCalling for backward compatibility (if needed elsewhere)
function formatCalling(language, userInputText, correctedText) {
  // Validate input
  if (!language || !userInputText || !correctedText) {
    console.error('Missing required parameters');
    return;
  }

  jQuery.ajax({
    url: HGF_ajax_object.ajax_url,
    type: 'POST',
    dataType: 'json',
    data: {
      action: 'hgf_formatting_call',
      language: language,
      userInputText: userInputText,
      correctedText: correctedText
    },
    beforeSend: function () {
      // console.log("Sending formatting request...");
    },
    success: function (response) {
      if (response.success) {
        let formattedResponse = response.data.replace(/\\/g, '');
        formattedResponse = formattedResponse.replace(/```html|```HTML/g, '');
        formattedResponse = formattedResponse.replace(/```/g, '');

        lastCorrectedText = formattedResponse;
        displayResponse(formattedResponse);
        onResponseGenerated(removeHamDanTags(formattedResponse));
        if (originalContent) {
          analyzeTranslatedText();
        }
        adjustInputTextareaHeight();
      } else {
        console.error('Formatting error:', response.data.message);
      }
    },
    error: function (xhr, status, error) {
      console.error('AJAX error:', error);
    }
  });
}

// ======================================================= Input Feild big code ===============================================

// ! =============================================== Explanation display of the improve inner code =================================
/**
 * Manually parses the raw explanation text from the API
 * @param {string} rawExplanation - The raw text returned from the API
 * @return {Array} - An array of explanation objects
 */
function parseExplanationManually(rawExplanation) {
  // First clean up the text by removing JSON formatting markers
  let cleaned = rawExplanation
    .replace(/^```json|```$/g, '') // Remove JSON code block markers
    .replace(/^{[\s\S]*?"explanations":\s*\[/m, '') // Remove the opening part
    .replace(/\s*\]\s*\}\s*$/m, '') // Remove the closing part
    .trim();

  // Split by the pattern that likely indicates new explanation entries (looking for the start of a new object)
  let entries = cleaned.split(/\s*\},\s*\{\s*/);

  if (entries.length === 1 && !entries[0].includes('"change"')) {
    // If we don't see expected formatting, try an alternative approach
    // This might occur if the raw string doesn't match expected patterns
    entries = cleaned.split(/\s*\},\s*\{/);
  }

  // Clean up the first and last entry to remove any remaining brackets
  if (entries.length > 0) {
    entries[0] = entries[0].replace(/^\s*\{\s*/, '');
    let lastIndex = entries.length - 1;
    entries[lastIndex] = entries[lastIndex].replace(/\s*\}\s*$/, '');
  }

  // Parse each entry into an object
  const explanations = entries
    .map(entry => {
      // Extract change and reason using regex
      const changeMatch = entry.match(/"change"\s*:\s*"([^"]+)"/);
      const reasonMatch = entry.match(/"reason"\s*:\s*"([^"]+)"/);

      if (changeMatch && reasonMatch) {
        // Process the change string to handle special characters
        let change = changeMatch[1]
          .replace(/→/g, '➜') // Normalize arrows to your preferred arrow (➜)
          .replace(/"/g, '"') // Normalize quotes
          .replace(/"/g, '"'); // Normalize quotes

        return {
          change: change,
          reason: reasonMatch[1]
        };
      }
      return null;
    })
    .filter(item => item !== null);

  return explanations;
}

/**
 * Process raw explanation data into a usable format
 * @param {string} rawExplanation - The raw explanation text from API
 * @return {Array} - Array of explanation objects
 */
function processExplanations(rawExplanation) {
  //// console.log("Processing raw explanation data");

  try {
    // Try standard JSON parsing first with cleaning
    const cleanedResults = rawExplanation
      .replace(/^`+|`+$/g, '') // Remove backticks
      .replace(/^(json|JSON)\s*/i, '') // Remove 'json' or 'JSON'
      .replace(/→/g, '➜') // Normalize arrows to your preferred arrow
      .replace(/"/g, '"') // Normalize quotes
      .replace(/"/g, '"') // Normalize quotes
      .trim();

    try {
      const explanationResultsObj = JSON.parse(cleanedResults);
      //// console.log("Standard JSON parsing successful");
      return explanationResultsObj.explanations;
    } catch (error) {
      //// console.log("Standard JSON parsing failed, trying aggressive cleanup");

      try {
        // Try more aggressive cleaning before giving up on JSON parse
        const ultraCleanedResults = cleanedResults
          .replace(/[\u201C\u201D]/g, '"') // Replace curly quotes
          .replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters

        const ultraParsedResults = JSON.parse(ultraCleanedResults);
        //// console.log("Ultra-cleaned parsing successful");
        return ultraParsedResults.explanations;
      } catch (ultraError) {
        //// console.log("Ultra-clean parsing failed, falling back to manual parsing");
        return parseExplanationManually(rawExplanation);
      }
    }
  } catch (e) {
    console.error('Error processing explanations:', e);
    return [];
  }
}

/**
 * Main function to process grammar explanation results
 * @param {string} explanationResults - Raw explanation results from API
 */
function processGrammarExplanations(explanationResults) {
  //// console.log("Raw explanationResults", explanationResults);

  // Process the explanations using our custom parser
  const parsedExplanations = processExplanations(explanationResults);
  const cleanParsedExplanations = parsedExplanations.filter(
    item => !item.reason.startsWith('Ingen ændring')
  );
  // Display the processed explanations
  if (parsedExplanations && parsedExplanations.length > 0) {
    //// console.log("Successfully parsed explanations:", parsedExplanations);
    //// console.log("Successfully clean the parsed explanations:", cleanParsedExplanations);

    displayExplanations(cleanParsedExplanations);
  } else {
    console.error('Failed to parse explanations or no explanations found');

    // Use your existing empty explanations handler
    const sidebarContent = document.querySelector('.correction-content');
    if (sidebarContent) {
      if (sidebarContent.classList.contains('has-explanations')) {
        sidebarContent.classList.remove('has-explanations');
      }
      sidebarContent.innerHTML = `
            <div id="gif" ></div>
            <div class="correction-message">
                <span style="color:#2DB62D" >Teksten er korrekt</span>
            </div>
            `;
      lottieLoadAnimation();
    }
  }
}

/**
 * Display explanations in the sidebar
 * @param {Array} explanations - Array of explanation objects
 */
const displayExplanations = explanations => {
  //// console.log("Displaying explanations:", explanations);

  const sidebarContent = document.querySelector('.correction-content');
  //// console.log("Sidebar content element:", sidebarContent);

  // Check if explanations array is empty
  if (!explanations || explanations.length === 0) {
    //// console.log("No explanations provided, handling empty case.");
    if (sidebarContent && sidebarContent.classList.contains('has-explanations')) {
      sidebarContent.classList.remove('has-explanations');
    }
    sidebarContent.innerHTML = `
        <div id="gif" ></div>
        <div class="correction-message">
            <span style="color:#2DB62D" >Teksten er korrekt</span>
        </div>
        `;
    lottieLoadAnimation();
    //// console.log("Updated sidebarContent innerHTML for no explanations case.");
    return; // Exit early
  }

  //// console.log("Explanations provided, processing...");

  // Clear previous content
  sidebarContent.innerHTML = '';
  //// console.log("Cleared sidebarContent innerHTML.");

  // Add class to handle different layout
  sidebarContent.classList.add('has-explanations');
  //// console.log("Added 'has-explanations' class to sidebarContent.");
  // Create a container for the number of changes
  const noOfChangesDiv = document.createElement('div');
  noOfChangesDiv.className = 'no-of-changes';
  noOfChangesDiv.innerHTML = `<span class="no-of-changes-text">Fejl </span> <span class="no-of-changes-count">${explanations.length}</span>`;
  //// console.log("Created noOfChangesDiv element:", noOfChangesDiv);

  const explanationList = document.createElement('div');
  explanationList.className = 'explanation-list';
  //// console.log("Created explanationList element:", explanationList);

  explanations.forEach(item => {
    //// console.log("Processing explanation item:", item);

    // Split the text at the arrow - handle both arrow types
    const arrowSplitRegex = /(?:➜|→)/;
    const parts = item.change.split(arrowSplitRegex);
    const before = parts[0] ? parts[0].trim() : '';
    const after = parts[1] ? parts[1].trim() : '';

    //// console.log("Split change text into before:", before, "and after:", after);

    const explanationItem = document.createElement('div');
    explanationItem.className = 'explanation-item';
    explanationItem.innerHTML = `
        <div class="change-text">
            <span class="not-corrected">${before}</span>
            <span class="corrected">➜ ${after}</span>
        </div>
        <div class="change-reason">${item.reason}</div>
      `;
    //// console.log("Created explanationItem element:", explanationItem);

    explanationList.appendChild(explanationItem);
    //// console.log("Appended explanationItem to explanationList.");
  });

  // First add the number of changes div to the sidebar
  sidebarContent.appendChild(noOfChangesDiv);
  //// console.log("Appended noOfChangesDiv to sidebarContent.");

  // Then add the explanation list
  sidebarContent.appendChild(explanationList);
  //// console.log("Appended explanationList to sidebarContent.");

  // Add fade-in animation
  noOfChangesDiv.classList.add('fade-in');
  explanationList.classList.add('fade-in');
  //// console.log("Added 'fade-in' class to elements.");
  attachExplanationListeners();
};

// Attach click listeners to explanation items
function attachExplanationListeners() {
  //// console.log("Attaching event listeners to explanation items");
  const explanationItems = document.querySelectorAll('.explanation-item');

  explanationItems.forEach(item => {
    // Remove any existing event listeners to prevent duplicates
    item.removeEventListener('click', handleExplanationClick);

    // Add a new event listener
    item.addEventListener('click', handleExplanationClick);
  });
}

// Event handler for explanation item clicks
function handleExplanationClick(event) {
  const item = event.currentTarget;

  /* 0 ── Toggle­-off: was this item already active? */
  if (item.classList.contains('active-explanation')) {
    clearHighlights(); // un-mark editor & reset sidebar
    item.classList.remove('active-explanation');
    return; // stop – nothing else to do
  }

  /* 1 ── Normal flow: make this item active, others inactive */
  document
    .querySelectorAll('.explanation-item.active-explanation')
    .forEach(el => el.classList.remove('active-explanation'));
  item.classList.add('active-explanation');

  /* 2 ── Pull the two text versions */
  const correctedSpan = item.querySelector('.corrected');
  const notCorrectedSpan = item.querySelector('.not-corrected');
  if (!correctedSpan) return;

  const correctedText = correctedSpan.textContent.replace('➜', '').trim();
  const notCorrectedText = notCorrectedSpan.textContent.trim();

  /* 3 ── Try highlighting the *corrected* text first,
            fallback to the *original* if no hit */
  if (!highlightWordInInput(correctedText)) {
    highlightWordInInput(notCorrectedText);
  }
}

/**
 * Highlight the first substring that
 *   • shares ≥ threshold similarity with the clicked word, and
 *   • has **any** character living inside a ham-dan blot.
 *
 * @param {string} word       Word/phrase from the sidebar.
 * @param {number} threshold  Similarity 0…1 (default 0.80).
 * @returns {boolean}         True if something was highlighted.
 */
function highlightWordInInput(word, threshold = 0.8) {
  /* ─── 1. Clean up ─────────────────────────────────────────────── */
  document
    .querySelectorAll('.ql-editor [style*="FFF1C2"]')
    .forEach(el => el.style.removeProperty('background-color'));
  quill1.formatText(0, quill1.getLength(), 'mark', false, Quill.sources.API);
  if (!word) return false;

  const needle = word.trim().toLowerCase();
  const nLen = needle.length;
  if (!nLen) return false;
  if (nLen < 4) threshold = 1.0; // exact for very short words

  /* ─── 2. Helpers ──────────────────────────────────────────────── */
  const levenshtein = (a, b) => {
    const m = a.length,
      n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  };
  const similarity = (a, b) =>
    (Math.max(a.length, b.length) - levenshtein(a, b)) / Math.max(a.length, b.length);

  const charHasGrammar = pos => {
    const f = quill1.getFormat(pos, 1);
    return f['grammar-added'] || f['grammar-removed'] || f['grammar-punct'];
  };

  /* ─── 3. Fuzzy-search the entire document ─────────────────────── */
  const haystack = quill1.getText().toLowerCase();
  const docLen = haystack.length;

  // Search windows from nLen-1 … nLen+2 chars (tweak as desired)
  for (let winLen = Math.max(1, nLen - 1); winLen <= nLen + 2; winLen++) {
    for (let pos = 0; pos <= docLen - winLen; pos++) {
      // quick reject by first char to save work (optional)
      // if (haystack[pos] !== needle[0]) continue;

      const slice = haystack.substr(pos, winLen);
      if (similarity(needle, slice) < threshold) continue;

      // ── At least one char inside ham-dan? ──────────────────
      let insideGrammar = false;
      for (let i = 0; i < winLen; i++) {
        if (charHasGrammar(pos + i)) {
          insideGrammar = true;
          break;
        }
      }
      if (!insideGrammar) continue;

      // ── Found the first good hit → highlight and bail out ──
      quill1.formatText(pos, winLen, 'mark', true, Quill.sources.API);

      // force visual yellow
      document.querySelectorAll('.ql-editor mark.word-highlight').forEach(mark => {
        mark.style.setProperty('background-color', '#FFF1C2', 'important');
        mark
          .querySelectorAll('*')
          .forEach(child => child.style.setProperty('background-color', '#FFF1C2', 'important'));
      });
      return true;
    }
  }
  return false; // nothing matched well enough
}

function clearHighlights() {
  if (!quill1) return;

  /* 1 ─── Remove Quill’s “mark” format from the whole doc */
  quill1.formatText(0, quill1.getLength(), 'mark', false, Quill.sources.API);

  /* 2 ─── Strip inline yellow styling, if any */
  document
    .querySelectorAll('.ql-editor mark.word-highlight, .ql-editor [style*="FFF1C2"]')
    .forEach(el => el.style.removeProperty('background-color'));

  /* 3 ─── Reset the sidebar: no item stays active */
  document
    .querySelectorAll('.explanation-item.active-explanation')
    .forEach(item => item.classList.remove('active-explanation'));

  /* 4 ─── Optional UX: collapse the selection so the caret vanishes */
  quill1.setSelection(null);
}

const resetSidebar = () => {
  //// console.log("Resetting sidebar to initial state");

  const sidebarContent = document.querySelector('.correction-content');

  // Remove the has-explanations class if it exists
  if (sidebarContent && sidebarContent.classList.contains('has-explanations')) {
    sidebarContent.classList.remove('has-explanations');
    //// console.log("Removed 'has-explanations' class from sidebarContent");
  }

  // Clear previous content and set the initial state
  sidebarContent.innerHTML = `
        <div class="hamdan-robot-container">
            <!-- Speech bubble comes first -->
            <div class="hamdan-speech-bubble">
                Jeg er klar!
            </div>
            <!-- Container for your animation -->
            <div id="gif" ></div>
        </div>
        <div class="correction-message" style="display: none;">
            <div class="gradient-loader-smart" style="display: none;"></div>
            <span>Jeg er klar!</span>
        </div>
    `;
  lottieLoadAnimation();
  //// console.log("Reset sidebarContent to initial state with GIF and 'Jeg er klar!' message");

  const demoInner = document.querySelector('.demo-inner');
  console.log('demoInner', demoInner);
  demoInner.style.display = 'flex';
  const bubble = document.querySelector('.demo-inner .hamdan-speech-bubble');
  bubble.style.display = 'block';
  const textSpan = document.querySelector('.demo-inner span');
  textSpan.style.display = 'none';
  const correctionInner = document.querySelector('.correction-inner-main');
  correctionInner.style.display = 'none';
  document.querySelector('.correction-inner').style.paddingTop = '0';
  const bubbleFun = document.querySelector(
    '.correction-inner .demo-inner .hamdan-robot-container .hamdan-speech-bubble'
  );
  bubbleFun.style.display = 'block';
  bubbleFun.textContent = 'Jeg er klar!';
};
const noChangeResultImproveInner = () => {
  const sidebarContent = document.querySelector('.correction-content');
  if (sidebarContent && sidebarContent.classList.contains('has-explanations')) {
    sidebarContent.classList.remove('has-explanations');
  }
  sidebarContent.innerHTML = `
        <div class="hamdan-robot-container">
            <!-- Speech bubble comes first -->
            <div class="hamdan-speech-bubble" >
                Perfekt!
            </div>
            <!-- Container for your animation -->
            <div id="gif" ></div>
        </div>
        <div class="correction-message">
            <div class="no-change-improve-outsider">
                <div class="no-changes-impove-inner">
                    <svg width="24px" height="24px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.98 88.05">
                        <g>
                            <path d="M41.57.34c6.69-1.76,7.85,3.87,12.64,4.85,3.28.67,7.09-.29,10.29.13,4.97.65,4.75,6.88,7.75,10.12,2.7,2.92,8.88,3.67,10.07,6.31,1.25,2.78-.16,8.61.56,12.1.77,3.76,4.95,5.52,5.12,9.83.19,5.12-4.28,6.51-5.12,10.6-.79,3.86,1.02,10.07-1.23,12.91-1.76,2.21-6.31,2.54-9.02,5.12-2.86,2.72-3.73,8.91-6.31,10.07-2.78,1.25-8.61-.16-12.1.56-3.76.77-5.52,4.95-9.83,5.12-5.12.19-6.51-4.28-10.6-5.12-3.86-.79-10.07,1.02-12.91-1.23-2.21-1.76-2.54-6.31-5.12-9.02-2.72-2.86-8.91-3.73-10.07-6.31-1.25-2.78.16-8.61-.56-12.1C4.35,50.51.17,48.76,0,44.45c-.19-5.12,4.28-6.51,5.12-10.6.67-3.28-.29-7.09.13-10.29.65-4.97,6.88-4.75,10.12-7.75,2.92-2.7,3.67-8.88,6.31-10.07,2.78-1.25,8.61.16,12.1-.56,3.11-.64,5.45-4.24,7.79-4.85Z" style="fill:#096;" />
                            <path d="M58.67,29.32c-3.81.84-17.48,17.7-18.77,17.7-3.08-2.28-7.5-9.17-11.23-9.65-4.36-.56-7.31,2.39-5.94,6.72.33,1.04,12.97,14.21,14.15,14.89,1.55.89,3.35,1.08,5.1.55,3.46-1.05,18.85-19.76,23.03-23.11,2.05-4.73-1.53-8.17-6.34-7.11Z" style="fill:#fff;" />
                        </g>
                    </svg>
                    <span class="correct-text-heading">Teksten er korrekt</span>
                </div>
                
            </div>
        </div>
    `;
  lottieLoadAnimation();
};
// ==================================================== loaders ===========================================
const showLoader = (selector, text) => {
  // console.log("showLoader called for selector:", selector);

  updateClearRevertButtonState('true');
  const element = document.querySelector(selector);
  if (!element) return;

  // Different loader implementations based on selector
  if (selector === '.textarea-wrapper') {
    // Loader 1: For textarea
    element.insertAdjacentHTML(
      'beforeend',
      `
            <div class="loader-backdrop">
                <div class="bubble-loader">
                    <div class="bubble"></div>
                </div>
                <span class="loader-text">${text || 'Loading...'}</span>
            </div>
        `
    );
  } else if (selector === '.correction-message') {
    if (toggleState === false) return;
    // Loader 2: For correction content
    // console.log("inside the correction-message loader")
    const correctionContent = document.querySelector('.correction-content');

    if (correctionContent && correctionContent.classList.contains('has-explanations')) {
      correctionContent.classList.remove('has-explanations');
    }
    // correctionContent.innerHTML = "";
    correctionContent.innerHTML = `
        <div id="gif"></div>
        <div class="correction-message">
            <span>Arbejder...</span>
        </div>
        `;

    lottieLoadAnimation();
    const span = document.querySelector('.correction-message');
    if (span) {
      span.insertAdjacentHTML(
        'afterbegin',
        `
            <div class="gradient-loader"></div>
            `
      );
    }
  }
};

const hideLoader = selector => {
  // console.log("hideLoader called for selector:", selector)
  const element = document.querySelector(selector);

  updateClearRevertButtonState('false');
  if (!element) return;

  if (selector === '.correction-message') {
    const loader = document.querySelector('.gradient-loader');
    if (loader) {
      loader.remove();
    }
    // ✅ Change text back to "Jeg er klar!" when hiding correction-message loader
    const messageSpan = document.querySelector('.correction-message span');
    if (messageSpan) {
      messageSpan.textContent = 'Jeg er klar!';
      // console.log("hideLoader - changed correction-message text to 'Jeg er klar!'");
    }
  }

  if (selector === '.textarea-wrapper') {
    // Remove any loader backdrops
    const loaders = element.querySelectorAll('.loader-backdrop');
    loaders.forEach(loader => loader.remove());
  }
};
// ---------------------------- cleaning response data ----------------------------
function cleanResponse(input) {
  let formattedResponse = input.replace(/\\/g, '');

  // Remove ```html or ```HTML and the closing ```
  formattedResponse = formattedResponse.replace(/```html|```HTML/g, '');
  formattedResponse = formattedResponse.replace(/```/g, '');

  return formattedResponse;
}
// ==================================================== Sidebar other dropdowns logics ===========================================
// ------------------------ Style inner buttons logic -------------------------

// Add click handlers to style options and send requests
document.querySelectorAll('.style-option').forEach((option, index) => {
  option.addEventListener('click', function () {
    // false && true
    // true && true
    // console.log(!quill1.getText().trim().length && !lastCorrectedText.trim().length);
    if (!quill1.getText().trim().length || !lastCorrectedText.trim().length) {
      return;
    }

    // Get prompt number based on index (1-4)
    const promptNumber = index + 1;
    previousText = quill1.root.innerHTML;
    let textToSent = removeHamDanTags(lastCorrectedText);
    //// console.log("saving in the previous text", previousText);
    // console.log("What text we are sending to the style change api \n", textToSent)

    // console.log("text \n ", htmlToText(textToSent));
    // Call function to handle style change
    sendStyleChangeRequest(textToSent, promptNumber);
  });
});

// Function to send style change request
function sendStyleChangeRequest(text, promptNumber) {
  showLoader('.textarea-wrapper', 'Forbedre teksten...');

  if (!getCurrentRewriteResponses()[getCurrentParagraphIndex()]) {
    const responses = getCurrentRewriteResponses();
    responses[getCurrentParagraphIndex()] = {
      responses: [text]
    };
    // console.log('Initialized response storage for the current paragraph index.');
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('action', 'hgf_handle_style_change_grammer');
  formData.append('text', text);
  formData.append('prompt_number', promptNumber);
  formData.append('language', getCurrentLanguage());

  // Send request
  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams(formData)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} `);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Update textarea with styled text
        const content = cleanResponse(data.data);

        displayResponse(content);
        onResponseGenerated(content);

        showNavigation();
        // Store response and update counter
        // Add new response and update navigation
        getCurrentRewriteResponses()[getCurrentParagraphIndex()].responses.push(content);
        const responseCount =
          getCurrentRewriteResponses()[getCurrentParagraphIndex()].responses.length;
        document.querySelector('.response-counter').textContent =
          `Tekst ${responseCount} ud af ${responseCount}`;
      } else {
        throw new Error(data.data?.message || 'Style change failed');
      }
    })
    .catch(error => {
      console.error('Style change request failed:', error);
      alert('Failed to change text style. Please try again.');
    })
    .finally(() => {
      hideLoader('.textarea-wrapper');
    });
}

// analyse loader
function analyseLoader(flag) {
  if (toggleState === false) return;

  const loader = document.querySelector('.gradient-loader-smart');
  const messageSpan = document.querySelector('.correction-message2 span'); // ✅ Target the span inside correction-message2
  const bubble = document.querySelector(
    '.correction-inner .demo-inner .hamdan-robot-container .hamdan-speech-bubble'
  );
  if (flag) {
    if (loader) loader.style.display = 'block';
    messageSpan.style.display = 'block';
    bubble.style.display = 'none';
    if (messageSpan) messageSpan.textContent = 'Arbejder...'; // ✅ Change text when showing
    // console.log("analyseLoader true - showing loader and changing text to 'Arbejder...'");
  } else {
    if (loader) loader.style.display = 'none';
    if (messageSpan) messageSpan.textContent = 'Jeg er klar!'; // ✅ Change text back when hiding
    // console.log("analyseLoader false - hiding loader and changing text to 'Jeg er klar!'");
  }
  // lottieLoadAnimation();
}
// ------------------------ correction inner buttons logic -------------------------
function getInnerTextFromHTMLString(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // innerHTML of the body
  const innerHTML = doc.body.innerHTML;

  // Convert innerHTML back to a DOM element
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = innerHTML;

  // Get the innerText (textContent would also work here)
  return tempContainer.innerText;
}
// Store the improvement prompt globally for later use
let savedImprovementPrompt = '';
let analyseAttempts = 1;

function analyzeTranslatedText() {
  // console.log("in the analyzeTranslatedText function");
  if (toggleState === false) return;
  if (isSmartCalled) return;
  if (getInnerTextFromHTMLString(lastCorrectedText).length < 100) {
    analyseLoader(false);
    const bubble = document.querySelector(
      '.correction-inner .demo-inner .hamdan-robot-container .hamdan-speech-bubble'
    );
    bubble.style.display = 'block';
    bubble.textContent = 'Teksten er for kort...';
    document.querySelector('.demo-text-correction-inner').style.display = 'none';
    isSmartCalled = true;
    return;
  }
  // ✅ Only show analyseLoader if not already shown
  // (this prevents duplicate loader calls when switching tabs)
  const smartLoader = document.querySelector('.gradient-loader-smart');
  if (smartLoader && smartLoader.style.display === 'none') {
    analyseLoader(true);
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('action', 'hgf_analyze_text_style_grammer');
  formData.append('text', removeHamDanTags(lastCorrectedText));
  formData.append('language', getCurrentLanguage());
  // console.log("\n============================== Data sending to Analyze call ================================\n")
  // console.log("text sending:\n", originalContent.html);

  // Send request
  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams(formData)
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // More robust cleaning approach for string responses
        let cleanedString = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);

        // Remove markdown code blocks
        cleanedString = cleanedString.replace(/```(?:json)?\s*\n?|```/g, '');

        // Trim whitespace
        cleanedString = cleanedString.trim();

        let parsedData;
        try {
          // Try to parse as-is first
          parsedData = JSON.parse(cleanedString);
        } catch (firstError) {
          // console.log("First parse attempt failed, trying to fix newlines...");

          try {
            // More sophisticated newline fixing
            // This regex finds newlines that are inside string values (between quotes)
            // and escapes them, while preserving structural newlines
            let fixedString = cleanedString.replace(
              /"([^"\\]*(\\.[^"\\]*)*)"/g,
              function (match, content) {
                // Escape newlines and other control characters within string values
                return (
                  '"' +
                  content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') +
                  '"'
                );
              }
            );

            parsedData = JSON.parse(fixedString);
            // console.log("Successfully parsed after fixing newlines");
          } catch (secondError) {
            // console.log("Second parse attempt failed, trying alternative approach...");

            try {
              // Last resort: try to extract JSON using a more aggressive approach
              // Find the first { and last } to extract the JSON object
              const startIndex = cleanedString.indexOf('{');
              const lastIndex = cleanedString.lastIndexOf('}');

              if (startIndex !== -1 && lastIndex !== -1 && startIndex < lastIndex) {
                let jsonString = cleanedString.substring(startIndex, lastIndex + 1);

                // Fix common JSON issues
                jsonString = jsonString
                  .replace(/\n\s*\n/g, '\\n') // Replace double newlines
                  .replace(/([^\\])\n/g, '$1\\n') // Escape single newlines
                  .replace(/\n/g, '\\n') // Escape any remaining newlines
                  .replace(/\r/g, '\\r')
                  .replace(/\t/g, '\\t');

                parsedData = JSON.parse(jsonString);
                // console.log("Successfully parsed using fallback method");
              } else {
                throw new Error('Could not find valid JSON structure');
              }
            } catch (thirdError) {
              console.error('All parsing attempts failed:', thirdError);
              throw thirdError;
            }
          }
        }

        processedData = parsedData;

        // Validate the processed data structure
        if (processedData && processedData.analysis) {
          updateAnalysisUI(processedData.analysis);
          // Save the improvement prompt for later use
          savedImprovementPrompt = processedData.improvementPrompt;
          isImproved = true;
          isSmartCalled = true;
        } else {
          throw new Error('Invalid response structure - missing analysis data');
        }
      } else {
        throw new Error('Server returned error response');
      }
    })
    .catch(error => {
      console.error('Text analysis failed:', error);
      if (analyseAttempts < 2) {
        // console.log("failed to analyze, retrying...");
        analyseAttempts++;
        analyzeTranslatedText();
      } else {
        // console.log("failed to analyze after retry");
        const preDefinedText = {
          textType: 'Besked',
          issue: 'Gør teksten mere præcis og forståelig.',
          currentStyle: 'Uformel',
          targetStyle: 'Professionel',
          buttonText: 'Forbedre teksten'
        };
        updateAnalysisUI(preDefinedText);
        // ✅ Hide loader on failure
        analyseLoader(false);
      }
    })
    .finally(() => {
      // ✅ Hide the loader regardless of success or error (if API completes)
      if (isSmartCalled || analyseAttempts >= 2) {
        // analyseLoader(false);
        console.log(`inside the final block \n isSmartCalled : ${isSmartCalled}`);
        isImproved = true;
        isSmartCalled = true;
        updateClearRevertButtonState();
      }
    });
}
// Function to update the UI with analysis results
function updateAnalysisUI(analysis) {
  // Update text type
  document.querySelector('.analysis-subtitle').textContent = analysis.textType;

  // Update warning message
  document.querySelector('.warning-msg').textContent = analysis.issue;

  // Update style conversion labels
  document.querySelector('.style-label.informal').textContent = analysis.currentStyle;
  document.querySelector('.style-label.professional').textContent = analysis.targetStyle;

  // Update action button text
  document.querySelector('.action-button').textContent = analysis.buttonText;

  // document.querySelector('.correction-inner').style.display = 'flex';
  document.querySelector('.correction-inner').style.paddingTop = '16px';
  document.querySelector('.demo-inner').style.display = 'none';

  document.querySelector('.correction-inner-main').style.display = 'flex';
  // updateDropdownFromPanel(correctionInner);
}

// Add click handler for the action button
document.querySelector('.action-button').addEventListener('click', function () {
  if (!savedImprovementPrompt) {
    // console.error('No improvement prompt available');
    // return;
  }
  if (!isImproved) {
    // ! handle this function
    handleUndo();
    // //// console.log("this is fun")
  } else {
    previousText = takeCurrentText();
    // //// console.log("savedImprovementPrompt:\n", savedImprovementPrompt)
    //// console.log("translated Text", takeCurrentText())
    improveText(savedImprovementPrompt);

    document.querySelector('.action-button').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9.99996" cy="9.99984" r="8.33333" stroke="#ffff" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M13.3333 7.9165H14.0833C14.0833 7.50229 13.7475 7.1665 13.3333 7.1665V7.9165ZM14.0833 14.1665V7.9165H12.5833V14.1665H14.0833ZM6.66663 8.6665H13.3333V7.1665H6.66663V8.6665Z" fill="#ffff"/>
          <path d="M8.74996 5.83301L6.66663 7.91634L8.74996 9.99967" stroke="#ffff" stroke-width="1.5"/>
        </svg>
        <span>Oprindelig tekst</span>
      `;
    isImproved = false;
  }
});

// --------------------------------- show original button logic ---------------------------------
function handleUndo() {
  if (!isUndo) {
    // textarea.innerText = previousText;
    //// console.log("in undo previous text", previousText);
    displayResponse(previousText, false);
    adjustInputTextareaHeight();
    isUndo = true;
    document.querySelector('.action-button').innerHTML = `
        
        <span>Ny tekst</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scaleX(-1);">
          <circle cx="9.99996" cy="9.99984" r="8.33333" stroke="#ffff" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M13.3333 7.9165H14.0833C14.0833 7.50229 13.7475 7.1665 13.3333 7.1665V7.9165ZM14.0833 14.1665V7.9165H12.5833V14.1665H14.0833ZM6.66663 8.6665H13.3333V7.1665H6.66663V8.6665Z" fill="#ffff"/>
          <path d="M8.74996 5.83301L6.66663 7.91634L8.74996 9.99967" stroke="#ffff" stroke-width="1.5"/>
        </svg>
      `;
  } else {
    // textarea.innerText = improvedText;
    //// console.log("in undo improved", improvedText);
    displayResponse(improvedText, false);
    isUndo = false;
    document.querySelector('.action-button').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9.99996" cy="9.99984" r="8.33333" stroke="#ffff" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M13.3333 7.9165H14.0833C14.0833 7.50229 13.7475 7.1665 13.3333 7.1665V7.9165ZM14.0833 14.1665V7.9165H12.5833V14.1665H14.0833ZM6.66663 8.6665H13.3333V7.1665H6.66663V8.6665Z" fill="#ffff"/>
          <path d="M8.74996 5.83301L6.66663 7.91634L8.74996 9.99967" stroke="#ffff" stroke-width="1.5"/>
        </svg>
        <span>Oprindelig tekst</span>
      `;
  }
  // ! handle undo
  adjustInputTextareaHeight();
}
// Function to improve text using saved prompt
function improveText(improvementPrompt) {
  showLoader('.textarea-wrapper', 'Forbedre teksten...');
  let textToSend = removeMarkTags(removeHamDanTags(takeCurrentText()));
  const formData = new FormData();
  formData.append('action', 'hgf_improve_text_style_grammer');
  formData.append('text', textToSend);
  formData.append('prompt', improvementPrompt);
  formData.append('language', getCurrentLanguage());

  //// console.log("\n============================== Data sending to improve call ================================\n")
  //// console.log("text sending:\n", originalContent.html);
  //// console.log("Improvement prompt sending:\n", improvementPrompt);
  //// console.log("language sending:\n", getCurrentLanguage());
  fetch(HGF_ajax_object.ajax_url, {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams(formData)
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const content = data.data.improved_text;
        const removeRegex = content.replace(/\\/g, '');
        displayResponse(removeRegex);
        onResponseGenerated(removeRegex);
        // Adjust heights after content change
        improvedText = removeRegex;

        // adjustHeights();
      } else {
        throw new Error(data.data?.message || 'Text improvement failed');
      }
    })
    .catch(error => {
      console.error('Text improvement failed:', error);
      alert('Failed to improve text. Please try again.');
    })
    .finally(() => {
      hideLoader('.textarea-wrapper');
    });
}

// ==================================================== text switcher function ===============================================================

function textSwitcher() {
  if (isMainSwtich) {
    switcherText = takeCurrentText();
    quill1.root.innerHTML = originalContent.html;

    isMainSwtich = false;
  } else {
    quill1.root.innerHTML = switcherText; // ✅ Injects HTML into the editor
    isMainSwtich = true;
  }

  // Trigger input event for any other listeners
  adjustInputTextareaHeight();
}
mainSwitcher.addEventListener('click', textSwitcher);

// ========================================== Revert back btn ===============================================
document.querySelector('#revertBack').addEventListener('click', e => {
  e.preventDefault();
  quill1.history.undo();
});

// ----------------------------- adjust heigts ========================================================
// Add mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
// Flag to determine if we need special scroll handling
const needsScrollHandling = isMobile || isSafari;
function adjustInputTextareaHeight(element = document.getElementById('inputText')) {
  // Save scroll position for mobile or Safari
  element = element || document.getElementById('inputText');
  const scrollTop = needsScrollHandling
    ? window.pageYOffset || document.documentElement.scrollTop
    : 0;

  // Restore scroll position on mobile or Safari
  if (needsScrollHandling) {
    setTimeout(() => {
      window.scrollTo(0, scrollTop);
    }, 10);
  }

  adjustHeights();
}

// SIMPLIFIED height adjustment function - NO debounce, NO MutationObserver
function adjustHeights() {
  // // console.log("adjustHeights() function called");

  const textAreaContainer = document.querySelector('.text-area-container');
  const mainTextAreaSection = document.querySelector('.main-textarea-section');
  const correctionSidebar = document.querySelector('.correction-sidebar');
  const editor = document.querySelector('.ql-editor');
  const topControls = document.querySelector('.top-controls');
  const headerSection = document.querySelector('.header-section');
  const styleInner = document.querySelector('.style-inner');

  if (!textAreaContainer || !mainTextAreaSection) {
    console.error('Required container elements are missing');
    return;
  }

  // Set minimum height
  const minHeight = 420;

  // Get heights of fixed elements
  const topControlsHeight = topControls ? topControls.offsetHeight : 0;
  const headerHeight = headerSection ? headerSection.offsetHeight : 0;

  // Calculate editor content height
  let editorContentHeight = minHeight;
  if (editor) {
    // Temporarily set height to auto to get accurate scroll height
    const originalHeight = editor.style.height;
    const originalOverflow = editor.style.overflowY;

    editor.style.height = 'auto';
    editor.style.overflowY = 'hidden';

    editorContentHeight = Math.max(editor.scrollHeight + topControlsHeight, minHeight);

    // Restore original styles
    editor.style.height = originalHeight;
    editor.style.overflowY = originalOverflow;
  }

  // Calculate style-inner content height if visible
  let styleInnerContentHeight = 0;
  let styleInnerTotalHeight = minHeight;

  if (styleInner && window.getComputedStyle(styleInner).display !== 'none') {
    // Temporarily remove constraints to measure natural height
    const originalStyleHeight = styleInner.style.height;
    const originalStyleOverflow = styleInner.style.overflowY;

    styleInner.style.height = 'auto';
    styleInner.style.overflowY = 'visible';

    // Get the natural content height
    styleInnerContentHeight = styleInner.scrollHeight;
    styleInnerTotalHeight = Math.max(styleInnerContentHeight + headerHeight, minHeight);

    // Restore original styles temporarily
    styleInner.style.height = originalStyleHeight;
    styleInner.style.overflowY = originalStyleOverflow;

    // // console.log("Height comparison:", {
    //     editorContentHeight: editorContentHeight,
    //     styleInnerContentHeight: styleInnerContentHeight,
    //     styleInnerTotalHeight: styleInnerTotalHeight
    // });
  }

  // MAIN LOGIC: Compare heights and decide final height
  let finalHeight = Math.max(editorContentHeight, styleInnerTotalHeight, minHeight);

  // Apply the final height to all containers
  textAreaContainer.style.height = `${finalHeight}px`;
  mainTextAreaSection.style.height = `${finalHeight}px`;

  if (correctionSidebar) {
    correctionSidebar.style.height = `${finalHeight}px`;
  }

  // Handle style-inner specifically
  if (styleInner && window.getComputedStyle(styleInner).display !== 'none') {
    const availableHeight = finalHeight - headerHeight;
    styleInner.style.height = `${availableHeight}px`;
  }

  // Handle other sidebar sections (improv-inner, correction-inner)
  const improvInner = document.querySelector('.improv-inner');
  const correctionInner = document.querySelector('.correction-inner');
  const correctionContent = document.querySelector('.correction-content');

  if (improvInner && window.getComputedStyle(improvInner).display !== 'none') {
    const availableHeight = finalHeight - headerHeight;
    improvInner.style.height = `${availableHeight}px`;

    if (correctionContent) {
      correctionContent.style.height = `${availableHeight}px`;
    }
  }

  if (correctionInner && window.getComputedStyle(correctionInner).display !== 'none') {
    const availableHeight = finalHeight - headerHeight;
    correctionInner.style.height = `${availableHeight}px`;

    const correctionInnerMain = document.querySelector('.correction-inner-main');
    if (correctionInnerMain) {
      correctionInnerMain.style.height = `${availableHeight}px`;
    }
  }
}

// Simple event listeners - NO debounce, NO MutationObserver
document.addEventListener('DOMContentLoaded', function () {
  // Initial height adjustment
  setTimeout(adjustHeights, 100);

  // Get or initialize Quill instance
  let quill;

  // Check if Quill is already initialized
  const editorElement = document.querySelector('.ql-editor');
  if (editorElement && editorElement.__quill) {
    quill = editorElement.__quill;
  } else if (window.quill) {
    quill = window.quill;
  }

  // Listen for Quill text changes
  if (quill) {
    quill.on('text-change', function () {
      // Small delay to let Quill finish updating
      setTimeout(adjustHeights, 10);
    });
  }

  // Fallback event listeners for the editor element
  if (editorElement) {
    // Key events that change structure
    editorElement.addEventListener('keyup', function (e) {
      if (['Enter', 'Backspace', 'Delete', 'Tab'].includes(e.key)) {
        setTimeout(adjustHeights, 10);
      }
    });

    // Paste events
    editorElement.addEventListener('paste', function () {
      setTimeout(adjustHeights, 50);
    });

    // Input events as fallback
    editorElement.addEventListener('input', function () {
      setTimeout(adjustHeights, 10);
    });
  }

  // Window resize
  window.addEventListener('resize', function () {
    setTimeout(adjustHeights, 50);
  });
});

// Utility function to trigger height adjustment from external code
function syncContentHeights() {
  // // console.log("syncContentHeights() called");
  adjustHeights();
}

// Function to manually trigger height adjustment
function forceHeightAdjustment() {
  setTimeout(adjustHeights, 10);
}

// Make functions available globally
window.adjustHeights = adjustHeights;
window.syncContentHeights = syncContentHeights;
window.forceHeightAdjustment = forceHeightAdjustment;

// Force initial adjustment after everything loads
window.addEventListener('load', function () {
  setTimeout(adjustHeights, 100);
});

// ------------------------------------- handle clear button ----------------------------
const clearButton = document.querySelector('#clearBtn');
const revertFun = document.querySelector('#revertBack');
// Function to update clear button state
function updateClearRevertButtonState(flag = 'center') {
  // Enable/disable clear button based on textarea content

  if (flag === 'false') {
    revertFun.disabled = false;
    clearButton.disabled = false;
  }
  if (flag === 'true') {
    // disabled both
    revertFun.disabled = true;
    clearButton.disabled = true;
  } else {
    revertFun.disabled = quill1.getText().trim().length === 0;
    clearButton.disabled = quill1.getText().trim().length === 0;
  }
}

// Function to handle clear operation
function handleClear() {
  stopSpeaking();
  quill1.setContents([]);
  // Refocus editor
  manuallyCloseMicButton('micButton1');
  quill1.focus();
  // Manually trigger events if needed
  quill1.root.dispatchEvent(new Event('input'));

  // Save scroll position for mobile or Safari
  resetNavText();
  const scrollTop = needsScrollHandling
    ? window.pageYOffset || document.documentElement.scrollTop
    : 0;
  const correctionOpts = document.getElementById('correctionOptions');
  correctionOpts.style.display = 'none';

  resetSidebar();
  lastCorrectedText = '';
  // Force placeholder update
  updatePlaceholder(getLanguageName(getCurrentLanguage()));
  // updateSelectedOption(dropdownOptions[0]);
  // Update other UI elements

  adjustInputTextareaHeight();
  if (typeof updateGenerateButtonState === 'function') {
    updateGenerateButtonState();
  }
  document.querySelector('#mainSwitcher').disabled = true;
  isMainSwtich = true;
  switcherText = '';
  isUndo = false;
  noOfChanges = -1;
  originalContent.html = '';
  originalContent.text = '';

  // Restore scroll position on mobile or Safari
  if (needsScrollHandling) {
    setTimeout(() => {
      window.scrollTo(0, scrollTop);
    }, 10);
  }
  updateClearRevertButtonState();
}
// Add click event listener to clear button
clearButton.addEventListener('click', handleClear);

quill1.on('text-change', updateClearRevertButtonState);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
    e.preventDefault();
    handleClear();
  }
});

// Initial call to set correct state
updateClearRevertButtonState();

// !---------------------------------------- sipliting code --------------------------------
function getTextLength(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent.trim().length;
}

function findTextPositionInHtml(html, targetTextLength) {
  let currentTextLength = 0;
  let htmlPosition = 0;
  const tempDiv = document.createElement('div');

  // Walk through HTML character by character
  while (htmlPosition < html.length && currentTextLength < targetTextLength) {
    tempDiv.innerHTML = html.substring(0, htmlPosition + 1);
    const newTextLength = tempDiv.textContent.trim().length;

    if (newTextLength >= targetTextLength) {
      // Find a safe break point near here
      for (let i = htmlPosition; i < Math.min(html.length, htmlPosition + 100); i++) {
        if (html[i] === '>' && i + 1 < html.length) {
          return i + 1;
        }
      }
      return htmlPosition;
    }

    htmlPosition++;
    currentTextLength = newTextLength;
  }

  return htmlPosition;
}

/* ─────────────────────────── robust splitter ────────────────────────────
   - Split an HTML string into 1-5 nearly-even parts **without** cutting
     through “atomic” blocks such as lists and tables.                     */
function robustHtmlDivider(htmlContent, maxLength = 500, targetSplits = 2) {
  /* ---------- helpers ---------- */
  const getTextLen = node => node.textContent.length;
  const serialise = (nodes, start, end) =>
    nodes
      .slice(start, end)
      .map(n => n.outerHTML ?? n.textContent)
      .join('')
      .trim();

  /* ---------- quick exit ---------- */
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;
  const nodes = Array.from(body.childNodes);
  const total = getTextLen(body);

  if (total <= maxLength || targetSplits === 1) return [htmlContent];

  /* ---------- choose safe boundaries ---------- */
  const atomic = new Set([
    'UL',
    'OL',
    'TABLE',
    'THEAD',
    'TBODY',
    'TFOOT',
    'TR',
    'BLOCKQUOTE',
    'SECTION',
    'ARTICLE',
    'HEADER',
    'FOOTER',
    'NAV',
    'ASIDE',
    'MAIN'
  ]);

  /* build cumulative text-lengths once */
  const cum = [];
  nodes.reduce((sum, n, i) => ((cum[i] = sum + getTextLen(n)), cum[i]), 0);

  /* ideal breakpoints: ⅓, ⅔, ¼,½,¾, etc. */
  const ideals = [];
  for (let i = 1; i < targetSplits; i++) {
    ideals.push((total * i) / targetSplits);
  }

  const taken = new Set();
  const cuts = [];

  /** find node boundary closest to `ideal`, skipping atomic blocks */
  const boundaryFor = ideal => {
    let bestIdx = -1,
      bestDist = Infinity;
    for (let i = 0; i < cum.length; i++) {
      if (taken.has(i)) continue;
      if (atomic.has(nodes[i].nodeName)) continue; // don’t cut list/table itself
      const dist = Math.abs(cum[i] - ideal);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) taken.add(bestIdx);
    return bestIdx;
  };

  /* pick boundaries */
  for (const ideal of ideals) {
    const idx = boundaryFor(ideal);
    if (idx !== -1) cuts.push(idx);
  }
  cuts.sort((a, b) => a - b);

  /* sanity check – if we didn’t manage to find enough boundaries,
       fall back to a simple no-split behaviour */
  if (cuts.length !== ideals.length) return [htmlContent];

  /* ---------- build parts ---------- */
  const parts = [];
  let prev = 0;
  for (const cut of cuts) {
    parts.push(serialise(nodes, prev, cut + 1));
    prev = cut + 1;
  }
  parts.push(serialise(nodes, prev, nodes.length));
  return parts;
}

/* ─────────────────────── generic fallback splitter ───────────────────────
   – only used if robustHtmlDividerThrows or returns the entire HTML */
function characterBasedSplit(htmlContent, pieces) {
  const totalTextLength = getTextLength(htmlContent);
  const approxPerPiece = totalTextLength / pieces;
  const result = [];
  let start = 0;

  for (let p = 1; p < pieces; p++) {
    const target = approxPerPiece * p;
    const breakPoint = findTextPositionInHtml(htmlContent, target);
    result.push(htmlContent.substring(start, breakPoint).trim());
    start = breakPoint;
  }
  result.push(htmlContent.substring(start).trim());
  return result;
}

/* ──────────────────────── top-level orchestrator ──────────────────────── */

function processComplexHtml(htmlContent, maxLength = 500) {
  // 1) optional cleaning (leave unchanged)
  const cleaned =
    typeof convertBulletListToUl === 'function' && typeof removeHamDanTags === 'function'
      ? convertBulletListToUl(removeHamDanTags(htmlContent))
      : htmlContent;

  const len = getTextLength(cleaned);

  /* 2) decide split count –- UPDATED ------------- */
  let splits;
  if (len <= 500)
    splits = 1; // ≤ 500
  else if (len < 1500)
    splits = 2; // 501 – 1 499
  else if (len < 2500)
    splits = 3; // 1 500 – 2 499
  else if (len < 3500)
    splits = 4; // 2 500 – 3 499
  else if (len < 4500)
    splits = 5; // 3 500 – 4 499
  else splits = 6; // ≥ 4 500

  /* 3) try the robust splitter (unchanged) */
  try {
    const pieces = robustHtmlDivider(cleaned, maxLength, splits);
    if (pieces.length === 1 && splits > 1) {
      console.warn('⚠️ robustHtmlDivider could not split; using character fallback');
      // return characterBasedSplit(cleaned, splits);
      return [cleaned];
    }
    return pieces;
  } catch (err) {
    console.error('robustHtmlDivider crashed:', err);
    // return characterBasedSplit(cleaned, splits);
    return [cleaned];
  }
}

/* Keep/getTextLength, findTextPositionInHtml, convertBulletListToUl,
   removeHamDanTags, etc. exactly as you already have them.               */

// Export (optional, if you need them globally)
window.robustHtmlDivider = robustHtmlDivider;
window.processComplexHtml = processComplexHtml;

// ---------------------------- removing headings to strong tag ---------------------------------------
function convertHeadingsToStrong(html) {
  // This regex matches:
  //  1. <(h[1-6])[^>]*>   → an opening tag <h1>–<h6> (with any attributes)
  //  2. ([\s\S]*?)       → lazily captures everything inside (including newlines)
  //  3. </\1>            → the corresponding closing tag (e.g. </h3> if <h3> was matched)
  //
  // The 'gi' flags mean global (replace all) and case-insensitive (so <H2> also matches).
  return html.replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, '<strong>$2</strong>');
}
// ---------------------------------------- parallel api requests ----------------------------------------
const grammerApiParallel = async (type, partsArray) => {
  // console.log(`Making parallel ${type} request with ${partsArray.length} parts`);
  // console.log('partsArray:', partsArray.lenght, partsArray);
  const data = {
    action: 'hgf_korrektur_grammar_parallel',
    type: type,
    parts: JSON.stringify(partsArray)
  };

  try {
    const response = await fetch(HGF_ajax_object.ajax_url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;'
      },
      body: new URLSearchParams(data).toString()
    });

    const responseData = await response.json();

    if (responseData.success) {
      // console.log("grammerApiParallel success \n", responseData.data);
      return responseData.data;
    } else {
      throw new Error(responseData.data || 'Parallel API request failed');
    }
  } catch (error) {
    console.error(`Error in parallel ${type} call:`, error);
    throw error;
  }
};

const formatCallingParallel = async (language, parts) => {
  // console.log("printing the formatCallingparts \n", parts);
  const data = {
    action: 'hgf_formatting_call_parallel',
    language: language,
    parts: JSON.stringify(parts)
  };

  try {
    const response = await fetch(HGF_ajax_object.ajax_url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;'
      },
      body: new URLSearchParams(data).toString()
    });

    const responseData = await response.json();

    if (responseData.success) {
      // console.log("formatCallingParallel success \n", responseData.data);
      return responseData.data;
    } else {
      throw new Error(responseData.data?.message || 'Parallel formatting request failed');
    }
  } catch (error) {
    console.error('Error in parallel formatting call:', error);
    throw error;
  }
};

function combineFormattingResults(results) {
  return results
    .map(result => {
      let cleaned = result.replace(/\\/g, '');
      cleaned = cleaned.replace(/```html|```HTML/g, '');
      cleaned = cleaned.replace(/```/g, '');
      return cleaned.trim();
    })
    .join('\n\n');
}

// ---------------------------------- for the explanation this is code ----------------------------------

function prepareExplanationParts(htmlParts) {
  // console.log(`Preparing explanation parts for ${htmlParts.length} sections`);

  // Plain text version of each original HTML slice
  const originalTextParts = htmlParts.map(part => {
    const tmp = document.createElement('div');
    tmp.innerHTML = part;
    return htmlToTextWithSpacing(tmp.innerHTML);
  });

  const explanationParts = [];

  htmlParts.forEach((_, index) => {
    const partOriginal = originalTextParts[index] || '';
    const partCorrected = correctedResults[index] || '';
    const partDiffHTML = diffHTMLParts[index] || '';

    const spanList = partDiffHTML ? collectSpanTags(partDiffHTML) : [];
    const changeCount = spanList.length;
    // console.log(`Part ${index} has ${changeCount} changes`);
    if (changeCount > 0) {
      explanationParts.push({
        original: partOriginal,
        corrected: partCorrected,
        noOfChanges: changeCount.toString(),
        grammarClasses: JSON.stringify(spanList)
      });
    }
  });

  // console.log('Prepared explanation parts:', explanationParts);
  return explanationParts;
}

// Helper function to convert diff HTML to corrected text
function convertDiffHTMLToText(diffHTML) {
  if (!diffHTML) return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = diffHTML;

  // Remove elements with grammar-correction-removed class
  tempDiv.querySelectorAll('.grammar-correction-removed').forEach(el => el.remove());

  // Clean up the remaining text
  return tempDiv.textContent || tempDiv.innerText || '';
}

// Helper function to combine explanation results
function combineExplanationResults(results) {
  if (!results || results.length === 0) return '';
  if (results.length === 1) return results[0];

  // console.log("Combining explanation results:", results);

  try {
    // Parse each result and combine explanations
    const allExplanations = [];

    results.forEach((result, index) => {
      // console.log(`Processing explanation result ${index}:`, result);

      const parsedExplanations = processExplanations(result);
      if (parsedExplanations && parsedExplanations.length > 0) {
        allExplanations.push(...parsedExplanations);
      }
    });

    // Create combined result in the expected format
    const combinedResult = {
      explanations: allExplanations
    };

    // console.log("Combined explanations result:", combinedResult);

    // Return as JSON string to match the expected format
    return JSON.stringify(combinedResult);
  } catch (error) {
    console.error('Error combining explanation results:', error);
    return results.join(' ');
  }
}
// Fallback function for single explanation call
function fallbackToSingleExplanation() {
  // console.log("Falling back to single explanation call");

  let spanList = collectSpanTags(diffHTMLExp);
  // console.log("Fallback span tag list ", spanList);

  grammerApi('explanations', {
    original: originalContent.text,
    corrected: correctedText,
    noOfChanges: noOfChanges.toString(),
    grammarClasses: JSON.stringify(spanList)
  })
    .then(explanationResults => {
      isExplanations = true;
      processGrammarExplanations(explanationResults);
      hideLoader('.correction-message');
      analyseLoader(false); // ✅ Hide after fallback completes
    })
    .catch(error => {
      console.error('Fallback Explanation API Error:', error);
      handleExplanationError();
    });
}

// Helper function to handle explanation errors
function handleExplanationError() {
  const sidebarContent = document.querySelector('.correction-content');
  if (sidebarContent) {
    if (sidebarContent.classList.contains('has-explanations')) {
      sidebarContent.classList.remove('has-explanations');
    }
    sidebarContent.innerHTML = `
            <div class="correction-message">
                <span style="color:#FF5555">Der opstod en fejl ved behandling af forklaringer.</span>
            </div>
        `;
  }
  hideLoader('.correction-message');
  analyseLoader(false); // ✅ Hide on error
}

function convertStrongParagraphsToHeadings(htmlInput) {
  // 1. Normalise input into a temporary container we can mutate safely
  const container = document.createElement('div');

  if (typeof htmlInput === 'string') {
    container.innerHTML = htmlInput;
  } else if (htmlInput instanceof Node) {
    container.appendChild(htmlInput.cloneNode(true)); // work on a copy, stay side-effect-free
  } else {
    throw new TypeError('convertStrongParagraphsToHeadings expects an HTML string or a DOM node');
  }

  // 2. Walk over every <p> inside the container
  container.querySelectorAll('p').forEach(p => {
    // Ignore whitespace-only text nodes
    const meaningfulChildren = Array.from(p.childNodes).filter(
      n => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim())
    );

    // Our conversion rule: exactly one child and it must be <strong>
    if (
      meaningfulChildren.length === 1 &&
      meaningfulChildren[0].nodeType === Node.ELEMENT_NODE &&
      meaningfulChildren[0].tagName === 'STRONG'
    ) {
      const strong = meaningfulChildren[0];
      const h1 = document.createElement('h1');

      // Copy the innerHTML of <strong> into the new <h1>
      h1.innerHTML = strong.innerHTML;

      // (Optional) migrate any inline attributes from <strong> → <h1>
      // for (const { name, value } of Array.from(strong.attributes)) h1.setAttribute(name, value);

      // Swap the original <p> with the new <h1>
      p.replaceWith(h1);
    }
  });

  // 3. Return the final HTML markup
  return container.innerHTML;
}

function convertBulletListToUl(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const olElements = [...doc.querySelectorAll('ol')];

  olElements.forEach(ol => {
    const ul = document.createElement('ul');
    let liMoved = false;

    [...ol.children].forEach(li => {
      const dataList = li.getAttribute('data-list');
      if (dataList === 'bullet') {
        li.removeAttribute('data-list');
        ul.appendChild(li.cloneNode(true));
        li.remove();
        liMoved = true;
      }
    });

    if (liMoved) {
      // If all lis were bullets, just replace the entire ol
      if (ol.children.length === 0) {
        ol.replaceWith(ul);
      } else {
        // Otherwise, insert ul before ol and keep ol for numbered items
        ol.parentNode.insertBefore(ul, ol);
      }
    }
  });

  return doc.body.innerHTML;
}

//-------------------------------------- Handle paste code --------------------------------------
const pasteButton = document.querySelector('#pasteBtn');

/* Paste button: clears editor then pastes */
pasteButton.addEventListener('click', () => handlePaste(true, true));

/* Editor-level paste listener (blocks images, funnels to handlePaste) */
const editorElement = document.querySelector('.ql-editor');
if (editorElement) {
  editorElement.addEventListener(
    'paste',
    e => {
      const cb = e.clipboardData || window.clipboardData;
      let hasText = false;

      if (cb && cb.items) {
        for (const it of cb.items) {
          if (it.kind === 'string' && /text\/(plain|html)/.test(it.type)) {
            hasText = true;
            break;
          }
        }

        if (!hasText) {
          for (const it of cb.items) {
            if (it.kind === 'file' && it.type.startsWith('image/')) {
              console.warn('Only image files detected, blocking paste');
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
        }
      }

      e.preventDefault();
      handlePaste(false, false);
    },
    true // capture
  );
}

/* Global safety net */
document.addEventListener(
  'paste',
  e => {
    const isEditorFocused =
      document.activeElement === editorElement || editorElement.contains(document.activeElement);

    if (isEditorFocused) {
      // console.group('📋 Paste Event Captured');
      // // console.log('Target Element:', document.activeElement);
      // // console.log('ClipboardData:', e.clipboardData || window.clipboardData);
      // console.groupEnd();
    }
  },
  true
);
// ── Updated helper function ──────────────────────────────────────────────

// Initialize the copy functionality

// Execute the initialization when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initQuillCopy();
});

// ! =============================== TTS & STT & Download & quillSelection & file upload ===============================
document.addEventListener('DOMContentLoaded', function () {
  // ... your existing code ...

  // Initialize TTS system
  initializeTTS();
  // Initialize STT system
  initializeSTT();
  initializeDownloadButton();
  setTimeout(() => {
    if (typeof quill1 !== 'undefined') {
      console.log('Quill instance found:', quill1);
      window.selectionToolbar = initializeSelectionToolbar(quill1);
    } else {
      console.error('Quill instance (quill1) not found!');
    }
  }, 1000);
  initializeFileUpload({
    showLoader: showLoader,
    hideLoader: hideLoader,
    handleClear: handleClear,
    displayResponse: displayResponse,
    scrollAfterPaste: scrollAfterPaste,
    manuallyCloseMicButton: manuallyCloseMicButton,
    getLanguageName: getLanguageName,
    getCurrentLanguage: getCurrentLanguage,
    HGF_ajax_object: HGF_ajax_object,
    HGF_ajax_object: HGF_ajax_object
  });
  initializeHistory();
  initializeRewriteSystem({
    displayResponse,
    onResponseGenerated,
    showLoader,
    hideLoader,
    originalContent,
    languageMap,
    getCurrentLanguage,
    HGF_ajax_object,
    dkHamdanCloseModal,
    clearHighlights, // ADD THIS
    manuallyCloseMicButton // ADD THIS
  });
});

// //new tutorial button functionality
// const showTutorialBtn = document.getElementById("show-tutorial-btn");
// const modal = document.getElementById("tutorial-popup");
// const closeBtn = document.querySelector(".tutorial-close-btn");
// const iframe = document.getElementById("tutorial-video");

// const originalSrc = iframe.src;

// showTutorialBtn.addEventListener("click", () => {
//   modal.hidden = false;
//   modal.style.display = "block";
//   iframe.src = originalSrc;
// });

// function closeModal() {
//   modal.style.display = "none";
//   modal.hidden = true;
//   iframe.src = "";
// }

// closeBtn.addEventListener("click", closeModal);

// window.addEventListener("click", (event) => {
//   if (event.target === modal) {
//     closeModal();
//   }
// });
// Tutorial Popup Functionality
document.addEventListener('DOMContentLoaded', function () {
  // Get DOM elements
  const showTutorialBtn = document.getElementById('show-tutorial-btn');
  const modal = document.getElementById('tutorial-popup');
  const closeBtn = document.querySelector('.close-btn');
  const iframe = document.getElementById('tutorial-video');

  // Store the original iframe source
  const originalSrc = iframe.src;

  // Show tutorial when button is clicked
  showTutorialBtn.addEventListener('click', () => {
    modal.hidden = false;
    modal.style.display = 'block';
    iframe.src = originalSrc; // Reset iframe src to start video
  });

  // Function to close the modal and stop the video
  function closeModal() {
    modal.style.display = 'none';
    modal.hidden = true;
    iframe.src = ''; // Clear src to stop video playback
  }

  // Close modal when close button is clicked
  closeBtn.addEventListener('click', closeModal);

  // Close modal when clicking outside of modal content
  window.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  // Add ESC key support to close the modal
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.style.display === 'block') {
      closeModal();
    }
  });
});

// Expose these functions on window object for copyPaste module to access
window.stopSpeaking = stopSpeaking;
window.manuallyCloseMicButton = manuallyCloseMicButton;
window.resetNavText = resetNavText;
window.resetSidebar = resetSidebar;
window.handleClear = handleClear;
window.resetNavText = resetNavText;
window.showNavigation = showNavigation;
// Add these to your existing window exports:
window.dkHamdanOpenModal = dkHamdanOpenModal;
window.dkHamdanCloseModal = dkHamdanCloseModal;
