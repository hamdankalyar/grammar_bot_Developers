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

// ======================= Loader Imports ====================================
import historyLoader from './modules/historyLoader.js';
import textAreaLoader from './modules/textAreaLoader.js';
import correctionSidebarLoader from './modules/correctionSidebarLoader.js';

import { initializeTTS, stopSpeaking, manualStopSpeaking } from './modules/textToSpeech.js';
import { initializeDownloadButton } from './modules/quillDownloader.js';

let sliderValue = 5;

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
    path: 'https://developskriv2.se/wp-content/uploads/2025/06/robot-wave.json'
  });
}

// Add this line to inject the function into the correction loader
correctionSidebarLoader.setLottieFunction(lottieLoadAnimation);

lottieLoadAnimation();

function lottieLoadAnimationByAddress(div) {
  lottie.loadAnimation({
    container: div,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'https://developskriv2.se/wp-content/uploads/2025/06/robot-wave.json'
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
      activeMember = true;
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
  /* overwrite = */
  true
);
// * ------------------------------- MS word bullets ----------------------------- *
const Delta = Quill.import('delta');

const LIST_PREFIX_RE = /^(\s*)([\u2022\u00B7•]|[0-9]+[.)]|[A-Za-z]+[.)])\s+/;
//  group 1  ───┘          optional leading spaces / tabs coming from Word
//  group 2                 •  •  •  OR “1.” “1)”  OR “A.” “a)” …
//  “\s+”                   at least one space / tab after the prefix

function matchMsWordList(node, delta) {
  // clone ops so we never mutate Quill’s original Delta
  const ops = delta.ops.map(op => ({
    ...op
  }));

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
  ops.push({
    insert: '\n',
    attributes: {
      list: listType,
      indent
    }
  });

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
Quill.register(
  {
    'formats/mark': MarkBlot
  },
  /*suppressWarning=*/ true
);

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
      op.attributes = {
        ...(op.attributes || {}),
        [attr]: true
      };
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
      op.attributes = {
        ...(op.attributes || {}),
        [attr]: true
      };
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
  updateClearRevertButtonState(); // For clear/revert buttons
  updateUndoRedoButtonState(); // For undo/redo buttons
});

// Also call both on generate button state updates
quill1.on('text-change', updateGenerateButtonState);

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
document.getElementById('sidebar-toggle-btn').addEventListener('click', e => {
  toggleState = !toggleState;

  const button = e.target.closest('.sidebar-toggle-btn');
  if (toggleState) {
    button.classList.add('active');
  } else {
    button.classList.remove('active');
  }

  if (toggleState !== cookieToggleState) {
    setCookie('korrektur-toggle', toggleState, 30);
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

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const mainTextAreaToggle = document.querySelector('.inner-textarea-bottom');
  const correctionSidebarToggle = document.querySelector('.correction-sidebar');
  const isMobileToggle = window.innerWidth <= 767;

  if (toggleState) {
    toggleBtn.classList.add('active');
  } else {
    toggleBtn.classList.remove('active');
  }

  // Toggle the SVG icon
  const toggleIcon = toggleBtn.querySelector('.sidebar-toggle-icon svg');
  if (toggleIcon) {
    if (toggleState) {
      // Sidebar is expanded - show collapse icon
      toggleIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
  <path d="M1.33301 7.33325H4.66634V10.6666M10.6663 4.66659H7.33301V1.33325" stroke="#A0A0A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`; // Paste your expanded state SVG here
    } else {
      // Sidebar is collapsed - show expand icon
      toggleIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="11" viewBox="0 0 10 11" fill="none">
  <mask id="path-1-inside-1_7138_2189" fill="white">
    <path d="M1.66634 8.83325H3.66634C3.85523 8.83325 4.01367 8.89725 4.14167 9.02525C4.26967 9.15325 4.33345 9.31147 4.33301 9.49992C4.33256 9.68836 4.26856 9.84681 4.14101 9.97525C4.01345 10.1037 3.85523 10.1675 3.66634 10.1666H0.999674C0.810786 10.1666 0.652563 10.1026 0.525008 9.97459C0.397452 9.84659 0.333452 9.68836 0.333008 9.49992V6.83325C0.333008 6.64436 0.397008 6.48614 0.525008 6.35859C0.653008 6.23103 0.81123 6.16703 0.999674 6.16659C1.18812 6.16614 1.34656 6.23014 1.47501 6.35859C1.60345 6.48703 1.66723 6.64525 1.66634 6.83325V8.83325ZM8.33301 2.16659H6.33301C6.14412 2.16659 5.9859 2.10259 5.85834 1.97459C5.73079 1.84659 5.66679 1.68836 5.66634 1.49992C5.6659 1.31147 5.7299 1.15325 5.85834 1.02525C5.98679 0.897252 6.14501 0.833252 6.33301 0.833252H8.99967C9.18856 0.833252 9.34701 0.897252 9.47501 1.02525C9.60301 1.15325 9.66679 1.31147 9.66634 1.49992V4.16659C9.66634 4.35547 9.60234 4.51392 9.47434 4.64192C9.34634 4.76992 9.18812 4.8337 8.99967 4.83325C8.81123 4.83281 8.65301 4.76881 8.52501 4.64125C8.39701 4.5137 8.33301 4.35547 8.33301 4.16659V2.16659Z"/>
  </mask>
  <path d="M1.66634 8.83325H-0.333659V10.8333H1.66634V8.83325ZM4.33301 9.49992L6.333 9.50464L4.33301 9.49992ZM3.66634 10.1666L3.67575 8.16659H3.66634V10.1666ZM0.333008 9.49992L-1.667 9.49992L-1.66699 9.50464L0.333008 9.49992ZM1.66634 6.83325L-0.333659 6.8238V6.83325H1.66634ZM8.33301 2.16659H10.333V0.166585H8.33301V2.16659ZM9.66634 1.49992L7.66634 1.4952V1.49992H9.66634ZM8.99967 4.83325L8.99496 6.83325L8.99967 4.83325ZM1.66634 8.83325V10.8333H3.66634V8.83325V6.83325H1.66634V8.83325ZM3.66634 8.83325V10.8333C3.53116 10.8333 3.36048 10.8095 3.17779 10.7357C2.9934 10.6612 2.84193 10.5539 2.72746 10.4395L4.14167 9.02525L5.55589 7.61104C5.03502 7.09017 4.35996 6.83325 3.66634 6.83325V8.83325ZM4.14167 9.02525L2.72746 10.4395C2.61301 10.325 2.5053 10.1731 2.43054 9.98764C2.35643 9.80378 2.33269 9.63177 2.33301 9.4952L4.33301 9.49992L6.333 9.50464C6.33464 8.80849 6.077 8.13215 5.55589 7.61104L4.14167 9.02525ZM4.33301 9.49992L2.33301 9.4952C2.33333 9.36056 2.35733 9.19155 2.43024 9.01103C2.50379 8.82894 2.60937 8.67927 2.72189 8.56596L4.14101 9.97525L5.56012 11.3845C6.0752 10.8659 6.33137 10.1954 6.333 9.50464L4.33301 9.49992ZM4.14101 9.97525L2.72189 8.56596C2.83748 8.44956 2.99117 8.34014 3.17895 8.26445C3.36498 8.18946 3.53866 8.16596 3.67575 8.16661L3.66634 10.1666L3.65693 12.1666C4.35587 12.1699 5.03684 11.9115 5.56012 11.3845L4.14101 9.97525ZM3.66634 10.1666V8.16659H0.999674V10.1666V12.1666H3.66634V10.1666ZM0.999674 10.1666V8.16659C1.13482 8.16659 1.30593 8.19035 1.4893 8.26452C1.67444 8.33941 1.82663 8.44739 1.94168 8.56283L0.525008 9.97459L-0.891663 11.3863C-0.370306 11.9095 0.305986 12.1666 0.999674 12.1666V10.1666ZM0.525008 9.97459L1.94168 8.56283C2.05517 8.67672 2.16145 8.82712 2.23541 9.00996C2.3087 9.19116 2.33268 9.3606 2.333 9.4952L0.333008 9.49992L-1.66699 9.50464C-1.66536 10.1955 -1.40903 10.8672 -0.891663 11.3863L0.525008 9.97459ZM0.333008 9.49992H2.33301V6.83325H0.333008H-1.66699V9.49992H0.333008ZM0.333008 6.83325H2.33301C2.33301 6.9684 2.30925 7.13951 2.23507 7.32288C2.16018 7.50802 2.05221 7.66021 1.93676 7.77526L0.525008 6.35859L-0.886744 4.94191C-1.40992 5.46327 -1.66699 6.13956 -1.66699 6.83325H0.333008ZM0.525008 6.35859L1.93676 7.77526C1.82287 7.88875 1.67247 7.99503 1.48963 8.06898C1.30844 8.14228 1.139 8.16626 1.00439 8.16658L0.999674 6.16659L0.994958 4.16659C0.30408 4.16822 -0.367579 4.42455 -0.886744 4.94191L0.525008 6.35859ZM0.999674 6.16659L1.00439 8.16658C0.866919 8.1669 0.694556 8.14291 0.510785 8.06868C0.325538 7.99386 0.174343 7.88635 0.0607942 7.7728L1.47501 6.35859L2.88922 4.94437C2.36911 4.42426 1.69323 4.16494 0.994958 4.16659L0.999674 6.16659ZM1.47501 6.35859L0.0607942 7.7728C-0.052732 7.65927 -0.160685 7.50764 -0.235796 7.32131C-0.310343 7.13637 -0.334293 6.96266 -0.333636 6.8238L1.66634 6.83325L3.66632 6.84271C3.66963 6.14189 3.40957 5.46472 2.88922 4.94437L1.47501 6.35859ZM1.66634 6.83325H-0.333659V8.83325H1.66634H3.66634V6.83325H1.66634ZM8.33301 2.16659V0.166585H6.33301V2.16659V4.16659H8.33301V2.16659ZM6.33301 2.16659V0.166585C6.46815 0.166585 6.63927 0.190348 6.82263 0.264519C7.00778 0.339408 7.15997 0.447388 7.27501 0.562833L5.85834 1.97459L4.44167 3.38634C4.96303 3.90951 5.63932 4.16659 6.33301 4.16659V2.16659ZM5.85834 1.97459L7.27501 0.562833C7.38851 0.676725 7.49478 0.827122 7.56874 1.00996C7.64203 1.19116 7.66602 1.3606 7.66634 1.4952L5.66634 1.49992L3.66635 1.50464C3.66798 2.19551 3.92431 2.86717 4.44167 3.38634L5.85834 1.97459ZM5.66634 1.49992L7.66634 1.4952C7.66666 1.63263 7.64268 1.80543 7.56807 1.98988C7.49284 2.17588 7.38462 2.32779 7.2701 2.44191L5.85834 1.02525L4.44658 -0.39141C3.92417 0.129193 3.6647 0.806289 3.66635 1.50464L5.66634 1.49992ZM5.85834 1.02525L7.2701 2.44191C7.15713 2.5545 7.007 2.66101 6.8233 2.73532C6.64103 2.80905 6.4699 2.83325 6.33301 2.83325V0.833252V-1.16675C5.63749 -1.16675 4.965 -0.908036 4.44658 -0.39141L5.85834 1.02525ZM6.33301 0.833252V2.83325H8.99967V0.833252V-1.16675H6.33301V0.833252ZM8.99967 0.833252V2.83325C8.86449 2.83325 8.69381 2.80948 8.51112 2.73568C8.32673 2.6612 8.17526 2.55393 8.06079 2.43947L9.47501 1.02525L10.8892 -0.388962C10.3684 -0.909826 9.69329 -1.16675 8.99967 -1.16675V0.833252ZM9.47501 1.02525L8.06079 2.43947C7.94635 2.32502 7.83863 2.17311 7.76387 1.98764C7.68976 1.80378 7.66602 1.63177 7.66635 1.4952L9.66634 1.49992L11.6663 1.50464C11.668 0.808484 11.4103 0.132149 10.8892 -0.388962L9.47501 1.02525ZM9.66634 1.49992H7.66634V4.16659H9.66634H11.6663V1.49992H9.66634ZM9.66634 4.16659H7.66634C7.66634 4.0314 7.69012 3.86072 7.76391 3.67803C7.83839 3.49365 7.94566 3.34218 8.06013 3.22771L9.47434 4.64192L10.8886 6.05613C11.4094 5.53527 11.6663 4.8602 11.6663 4.16659H9.66634ZM9.47434 4.64192L8.06013 3.22771C8.17458 3.11326 8.32648 3.00554 8.51196 2.93078C8.69581 2.85667 8.86782 2.83294 9.00439 2.83326L8.99967 4.83325L8.99496 6.83325C9.6911 6.83489 10.3674 6.57725 10.8886 6.05613L9.47434 4.64192ZM8.99967 4.83325L9.00439 2.83326C9.139 2.83358 9.30844 2.85756 9.48963 2.93085C9.67247 3.00481 9.82287 3.11109 9.93676 3.22458L8.52501 4.64125L7.11326 6.05792C7.63242 6.57529 8.30408 6.83162 8.99496 6.83325L8.99967 4.83325ZM8.52501 4.64125L9.93676 3.22458C10.0522 3.33963 10.1602 3.49182 10.2351 3.67696C10.3092 3.86033 10.333 4.03144 10.333 4.16659H8.33301H6.33301C6.33301 4.86027 6.59008 5.53657 7.11326 6.05792L8.52501 4.64125ZM8.33301 4.16659H10.333V2.16659H8.33301H6.33301V4.16659H8.33301Z" fill="#A0A0A0" mask="url(#path-1-inside-1_7138_2189)"/>
</svg>`; // Paste your collapsed state SVG here
    }
  }

  hideUnderlines(toggleState);
  callSidebar();

  if (!isMobileToggle) {
    if (toggleState) {
      mainTextAreaToggle.style.flexBasis = '74%';
      correctionSidebarToggle.style.flexBasis = '25%';
      correctionSidebarToggle.style.display = 'flex';
      correctionSidebarToggle.classList.remove('collapsed');
    } else {
      mainTextAreaToggle.style.flexBasis = '95%';
      correctionSidebarToggle.style.flexBasis = '4%';
      correctionSidebarToggle.style.display = 'flex';
      correctionSidebarToggle.classList.add('collapsed');
    }
  }

  adjustInputTextareaHeight();
}

// =================================== Sidebar Icons ========================================
document.querySelectorAll('.sidebar-icon-btn').forEach(iconBtn => {
  iconBtn.addEventListener('click', function () {
    const sidebar = document.querySelector('.correction-sidebar');

    // Expand the sidebar if collapsed
    if (sidebar && sidebar.classList.contains('collapsed')) {
      toggleState = true;
      setCookie('korrektur-toggle', toggleState, 30);
      actionOnToggle(toggleState);
    }

    // Find the corresponding dropdown option after expansion
    setTimeout(() => {
      const optionValue = this.getAttribute('data-option');
      const dropdownOption = document.querySelector(
        '.hk-dropdown-option[data-option="' + optionValue + '"]'
      );
      if (dropdownOption) {
        updateSelectedOption(dropdownOption);
      }
    }, 100);
  });
});

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

  // Update icon and text
  selectedIcon.replaceWith(optionIcon);
  selectedText.textContent = optionText;

  // Update active states
  dropdownOptions.forEach(opt => opt.classList.remove('active'));
  option.classList.add('active');

  // Get voiceSection reference once
  const voiceSection = document.querySelector('.voice-section');

  if (option.dataset.option === 'smart-help') {
    improvInner.style.display = 'none';
    correctionInner.style.display = 'flex';
    styleInner.style.display = 'none';
    if (voiceSection) voiceSection.style.display = 'none'; // ✅ ADD THIS

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
    if (voiceSection) voiceSection.style.display = 'none'; // ✅ ADD THIS

    optionIcon.querySelectorAll('path').forEach(path => {
      path.setAttribute('stroke', '#E24668');
    });
  } else if (option.dataset.option === 'improve-text') {
    improvInner.style.display = 'flex';
    correctionInner.style.display = 'none';
    styleInner.style.display = 'none';
    if (voiceSection) voiceSection.style.display = 'none'; // ✅ ADD THIS

    optionIcon.querySelectorAll('path, line, polyline').forEach(element => {
      element.setAttribute('stroke', '#E24668');
    });
  } else if (option.dataset.option === 'tone-style') {
    improvInner.style.display = 'none';
    correctionInner.style.display = 'none';
    styleInner.style.display = 'none';

    if (voiceSection) {
      voiceSection.style.display = 'flex'; // ✅ SHOW VOICE SECTION
    }
    // Update icon color
    optionIcon.querySelectorAll('path, line, polyline').forEach(element => {
      element.setAttribute('stroke', '#E24668');
    });
  }

  onUpdateSelectOption(option);
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
  const voiceSection = document.querySelector('.voice-section'); // Add this line

  improvInner.style.display = 'flex';
  correctionInner.style.display = 'none';
  styleInner.style.display = 'none';
  voiceSection.style.display = 'none'; // Add this line
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
      correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
      // NEW:
      correctionSidebarLoader.toggleSmartLoader(true);
      console.log('on update selection analyzeTranslatedText');
      analyzeTranslatedText();
      // console.log("calling in the smart-help")
    } else {
      // ✅ If no API call needed, make sure loaders are hidden
      correctionSidebarLoader.hideCorrectionLoader('.correction-message');
      correctionSidebarLoader.toggleSmartLoader(false);
    }
  } else if (option.dataset.option === 'improve-text') {
    // ✅ Show loader if explanations will be processed
    if (noOfChanges > 0 && !isExplanations) {
      correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
    }

    callImproveSidebar();
  } else if (option.dataset.option === 'change-style') {
    // ✅ Make sure loaders are hidden for style tab
    correctionSidebarLoader.hideCorrectionLoader('.correction-message');
    correctionSidebarLoader.toggleSmartLoader(false);
  } else if (option.dataset.option === 'tone-style') {
    // Hide loaders for voice section
    correctionSidebarLoader.hideCorrectionLoader('.correction-message');
    correctionSidebarLoader.toggleSmartLoader(false);
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
        correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
      }
      callImproveSidebar();
    } else if (dropDownValue === 'Teksthjælp') {
      // console.log("Retter teksten call started");
      // console.log("starting the analysis");

      if (lastCorrectedText != '' && isSmartCalled == false) {
        // ✅ Show loaders before calling analyzeTranslatedText
        correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
        // NEW:
        correctionSidebarLoader.toggleSmartLoader(true);
        console.log('call sidebar analyzeTranslatedText');
        analyzeTranslatedText();
      } else {
        // ✅ If no API call needed, make sure loaders are hidden
        // hideLoader('.correction-message');
        // correctionSidebarLoader.toggleSmartLoader(false);
      }
    }
  }
}

// =================================================== gen button ================================

function callImproveSidebar() {
  if (noOfChanges != -1) {
    if (noOfChanges == 0) {
      correctionSidebarLoader.hideCorrectionLoader('.correction-message');
      // NEW:
      correctionSidebarLoader.showPerfectState();
      correctionSidebarLoader.toggleSmartLoader(false);
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
        correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
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
            correctionSidebarLoader.hideCorrectionLoader('.correction-message');
            correctionSidebarLoader.toggleSmartLoader(false);
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
            correctionSidebarLoader.hideCorrectionLoader('.correction-message');
            correctionSidebarLoader.toggleSmartLoader(false);
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
      correctionSidebarLoader.hideCorrectionLoader('.correction-message');
      correctionSidebarLoader.toggleSmartLoader(false);
    }
  } else {
    // ✅ If no changes processed yet, hide loaders
    correctionSidebarLoader.hideCorrectionLoader('.correction-message');
    correctionSidebarLoader.toggleSmartLoader(false);
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
    generateBtn.style.backgroundColor = 'rgba(226, 70, 104, 1)';
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
    generateBtn.style.border = '1px solid #e5e5e7';
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
  // NEW:
  correctionSidebarLoader.showReadyState();
  // document.querySelector('.correction-options').style.display = 'flex';
  isUndo = false;
  isSmartCalled = false;
  isExplanations = false;
  lastCorrectedText = '';
  // NEW:
  textAreaLoader.showTextAreaLoader('.textarea-wrapper', 'Retter teksten...');
  correctionSidebarLoader.showCorrectionLoader('.correction-message', 'Analyzing...');
  // NEW:
  correctionSidebarLoader.toggleSmartLoader(true);

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
    // NEW:
    textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
    correctionSidebarLoader.hideCorrectionLoader('.correction-message');
    correctionSidebarLoader.toggleSmartLoader(false);
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
  // NEW:
  textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
  textAreaLoader.showTextAreaLoader('.textarea-wrapper', 'Ordner opsætningen...');

  // Validate input
  if (!language || !userInputText || !correctedText) {
    console.error('Missing required parameters');
    // NEW:
    textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
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
        document.querySelector('.correction-options').style.display = 'flex';
        const dropDownValue = document.querySelector('.hk-dropdown-text').textContent;
        if (dropDownValue === 'Teksthjælp') {
          console.log('in formatting call analyzeTranslatedText');
          analyzeTranslatedText();
        }
        adjustInputTextareaHeight();

        // NEW:
        textAreaLoader.hideTextAreaLoader('.textarea-wrapper'); // ✅ Hide when formatting completes
      } else {
        console.error('Formatting error:', response.data.message);
        // NEW:
        textAreaLoader.hideTextAreaLoader('.textarea-wrapper'); // ✅ Hide on error
      }
    },
    error: function (xhr, status, error) {
      console.error('AJAX error:', error);
      // NEW:
      textAreaLoader.hideTextAreaLoader('.textarea-wrapper'); // ✅ Hide on error
    }
  });
}

function formatCallingParallelWithLoader(language, formattingParts, fallbackDiffHtml) {
  // NEW:
  textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
  textAreaLoader.showTextAreaLoader('.textarea-wrapper', 'Ordner opsætningen...');

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
      document.querySelector('.correction-options').style.display = 'flex';
      onResponseGenerated(removeHamDanTags(combinedResult));
      const dropDownValue = document.querySelector('.hk-dropdown-text').textContent;
      if (dropDownValue === 'Teksthjælp') {
        console.log('in formatting call parallel analyzeTranslatedText');
        analyzeTranslatedText();
      }
      adjustInputTextareaHeight();
      // NEW:
      textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
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
    let prev = Array.from(
      {
        length: n + 1
      },
      (_, i) => i
    );
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
  textAreaLoader.showTextAreaLoader('.textarea-wrapper', 'Forbedre teksten...');

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
      // NEW:
      textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
    });
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
    correctionSidebarLoader.toggleSmartLoader(false);

    // Handle both demo-inner and correction-inner-main sections
    const demoInnerBubble = document.querySelector(
      '.correction-inner .demo-inner .hamdan-speech-bubble'
    );
    const mainBubble = document.querySelector('.correction-inner-main .hamdan-speech-bubble');

    if (demoInnerBubble) {
      demoInnerBubble.style.display = 'block';
      demoInnerBubble.textContent = 'Teksten er for kort...';
    }
    if (mainBubble) {
      mainBubble.textContent = 'Teksten er for kort...';
    }

    const demoText = document.querySelector('.demo-text-correction-inner');
    if (demoText) {
      demoText.style.display = 'none';
    }
    isSmartCalled = true;
    return;
  }

  // ✅ Only show analyseLoader if not already shown
  // (this prevents duplicate loader calls when switching tabs)
  const smartLoader = document.querySelector('.gradient-loader-smart');
  if (smartLoader && smartLoader.style.display === 'none') {
    // NEW:
    correctionSidebarLoader.toggleSmartLoader(true);
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
          console.log('First parse attempt failed, trying to fix JSON...');

          try {
            // More aggressive cleaning for malformed JSON
            let fixedString = cleanedString;

            // Remove any leading/trailing non-JSON characters
            const jsonStart = fixedString.indexOf('{');
            const jsonEnd = fixedString.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
              fixedString = fixedString.substring(jsonStart, jsonEnd + 1);
            }

            // Fix common JSON issues
            fixedString = fixedString
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
              .replace(/\n/g, '\\n') // Escape newlines
              .replace(/\r/g, '\\r') // Escape carriage returns
              .replace(/\t/g, '\\t') // Escape tabs
              .replace(/\\/g, '\\\\') // Escape backslashes
              .replace(/"/g, '"') // Normalize quotes
              .replace(/"/g, '"') // Normalize quotes
              .replace(/'/g, "'"); // Normalize single quotes

            parsedData = JSON.parse(fixedString);
            console.log('Successfully parsed after fixing JSON');
          } catch (secondError) {
            console.log('Second parse attempt failed, using fallback...');

            try {
              // Last resort: try to extract key-value pairs manually
              const textTypeMatch = cleanedString.match(/"textType"\s*:\s*"([^"]+)"/);
              const issueMatch = cleanedString.match(/"issue"\s*:\s*"([^"]+)"/);
              const currentStyleMatch = cleanedString.match(/"currentStyle"\s*:\s*"([^"]+)"/);
              const targetStyleMatch = cleanedString.match(/"targetStyle"\s*:\s*"([^"]+)"/);
              const buttonTextMatch = cleanedString.match(/"buttonText"\s*:\s*"([^"]+)"/);

              // Create a fallback object
              parsedData = {
                analysis: {
                  textType: textTypeMatch ? textTypeMatch[1] : 'Besked',
                  issue: issueMatch ? issueMatch[1] : 'Gør teksten mere præcis og forståelig.',
                  currentStyle: currentStyleMatch ? currentStyleMatch[1] : 'Uformel',
                  targetStyle: targetStyleMatch ? targetStyleMatch[1] : 'Professionel',
                  buttonText: buttonTextMatch ? buttonTextMatch[1] : 'Forbedre teksten'
                },
                improvementPrompt: 'Improve the text to be more professional and clear.'
              };

              console.log('Created fallback parsed data');
            } catch (thirdError) {
              console.error('All parsing attempts failed:', thirdError);

              // Use completely predefined fallback
              parsedData = {
                analysis: {
                  textType: 'Besked',
                  issue: 'Gør teksten mere præcis og forståelig.',
                  currentStyle: 'Uformel',
                  targetStyle: 'Professionel',
                  buttonText: 'Forbedre teksten'
                },
                improvementPrompt: 'Improve the text to be more professional and clear.'
              };

              console.log('Using completely predefined fallback data');
            }
          }
        }

        // Validate the processed data structure
        if (parsedData && parsedData.analysis) {
          updateAnalysisUI(parsedData.analysis);
          // Save the improvement prompt for later use
          savedImprovementPrompt = parsedData.improvementPrompt;
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
      console.log(
        'Raw response that failed to parse:',
        typeof data !== 'undefined' && data.data
          ? typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data)
          : 'No data available'
      );

      if (analyseAttempts < 2) {
        console.log('failed to analyze, retrying...');
        analyseAttempts++;
        analyzeTranslatedText();
      } else {
        console.log('failed to analyze after retry, using fallback');
        const preDefinedText = {
          textType: 'Besked',
          issue: 'Gør teksten mere præcis og forståelig.',
          currentStyle: 'Uformel',
          targetStyle: 'Professionel',
          buttonText: 'Forbedre teksten'
        };
        updateAnalysisUI(preDefinedText);
        correctionSidebarLoader.toggleSmartLoader(false);
      }
    })
    .finally(() => {
      // ✅ Hide the loader regardless of success or error (if API completes)
      if (isSmartCalled || analyseAttempts >= 2) {
        console.log(`inside the final block \n isSmartCalled : ${isSmartCalled}`);
        isImproved = true;
        isSmartCalled = true;
        updateClearRevertButtonState();
      }
    });
}
// Function to update the UI with analysis results
function updateAnalysisUI(analysis) {
  // Update text type with null check
  const analysisSubtitle = document.querySelector('.analysis-subtitle');
  if (analysisSubtitle) {
    analysisSubtitle.textContent = analysis.textType;
  }

  // Update warning message with null check
  const warningMsg = document.querySelector('.warning-msg');
  if (warningMsg) {
    warningMsg.textContent = analysis.issue;
  }

  // Update style conversion labels with null checks
  const informalLabel = document.querySelector('.style-label.informal');
  if (informalLabel) {
    informalLabel.textContent = analysis.currentStyle;
  }

  const professionalLabel = document.querySelector('.style-label.professional');
  if (professionalLabel) {
    professionalLabel.textContent = analysis.targetStyle;
  }

  // Update action button text with null check
  const actionButton = document.querySelector('.action-button');
  if (actionButton) {
    actionButton.textContent = analysis.buttonText;
  }

  // Show/hide sections with null checks
  const correctionInner = document.querySelector('.correction-inner');
  if (correctionInner) {
    correctionInner.style.paddingTop = '16px';
  }

  const demoInner = document.querySelector('.demo-inner');
  if (demoInner) {
    demoInner.style.display = 'none';
  }

  const correctionInnerMain = document.querySelector('.correction-inner-main');
  if (correctionInnerMain) {
    correctionInnerMain.style.display = 'flex';
  }

  // ✅ Reset the bubble text when showing analysis with null check
  const mainBubble = document.querySelector('.correction-inner-main .hamdan-speech-bubble');
  if (mainBubble) {
    mainBubble.textContent = analysis.issue;
  }
}

const gifInsider = document.querySelector('.correction-inner-main .hamdan-robot-container #gif');
if (gifInsider && !gifInsider.querySelector('svg')) {
  lottieLoadAnimationByAddress(gifInsider);
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
  textAreaLoader.showTextAreaLoader('.textarea-wrapper', 'Forbedre teksten...');
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
      // NEW:
      textAreaLoader.hideTextAreaLoader('.textarea-wrapper');
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

// ========================================== Redo btn ===============================================
document.querySelector('#redoBtn').addEventListener('click', e => {
  e.preventDefault();
  quill1.history.redo();
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

// ! second working version
// SIMPLIFIED height adjustment function - NO debounce, NO MutationObserver
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
  const bottomControls = document.querySelector('.bottom-controls');

  if (!textAreaContainer || !mainTextAreaSection) {
    console.error('Required container elements are missing');
    return;
  }

  // Set minimum height
  const minHeight = 520;

  // Get heights of fixed elements
  const topControlsHeight = topControls ? topControls.offsetHeight : 0;
  const headerHeight = headerSection ? headerSection.offsetHeight : 0;
  const bottomControlsHeight = bottomControls ? bottomControls.offsetHeight : 0;

  // Get correction options height (initially hidden, but shows after responses)
  const correctionOptions = document.querySelector('.correction-options');
  const correctionOptionsHeight =
    correctionOptions && window.getComputedStyle(correctionOptions).display !== 'none'
      ? correctionOptions.offsetHeight
      : 0;

  // Get padding from inner-textarea-bottom (25px top + 25px bottom = 50px)
  const innerTextareaBottom = document.querySelector('.inner-textarea-bottom');
  const innerPadding = innerTextareaBottom ? 50 : 0;

  // Calculate editor content height (let it size naturally to content)
  let editorContentHeight = minHeight;
  if (editor) {
    // Temporarily set height to auto to get the natural content height
    const originalHeight = editor.style.height;
    const originalOverflow = editor.style.overflowY;

    editor.style.height = 'auto';
    editor.style.overflowY = 'hidden';

    // Get the natural height the editor wants (this should be 935px for your content)
    editorContentHeight = Math.max(editor.scrollHeight, minHeight);

    // Restore original styles
    editor.style.height = originalHeight;
    editor.style.overflowY = originalOverflow;
  }

  // Simple logic: main-textarea-section = editor content + top controls
  const mainTextAreaSectionHeight = editorContentHeight + topControlsHeight;

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
  }

  // MAIN LOGIC: Calculate container height needed
  // inner-textarea-bottom ALWAYS has padding: 25px 20px (50px vertical total)
  // Inside this padded area we have: main-textarea-section + correction-options + bottom-controls
  const totalContainerHeight =
    mainTextAreaSectionHeight + bottomControlsHeight + correctionOptionsHeight + innerPadding;

  // Final height is the maximum of all requirements
  let finalHeight = Math.max(totalContainerHeight, styleInnerTotalHeight, minHeight);

  // Debug log to verify calculations
  console.log('Height calculations:', {
    editorContentHeight,
    topControlsHeight,
    mainTextAreaSectionHeight,
    bottomControlsHeight,
    correctionOptionsHeight,
    innerPadding,
    totalContainerHeight,
    finalHeight
  });

  // Apply the final height to containers
  textAreaContainer.style.height = `${finalHeight}px`;

  // The inner-textarea-bottom should be the container minus any outer margin/padding
  const innerTextareaBottomHeight = finalHeight;
  if (innerTextareaBottom) {
    innerTextareaBottom.style.height = `${innerTextareaBottomHeight}px`;
  }

  // Main textarea section gets exactly what it needs: editor content + top controls
  mainTextAreaSection.style.height = `${mainTextAreaSectionHeight}px`;

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
  const voiceSection = document.querySelector('.voice-section');

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

  // Handle voice section if visible
  if (voiceSection && window.getComputedStyle(voiceSection).display !== 'none') {
    const availableHeight = finalHeight - headerHeight;
    voiceSection.style.height = `${availableHeight}px`;
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

// ------------------ voice handler logic ----------------

// ------------------ voice handler logic ----------------
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.voice-slider-container');
  const handle = document.querySelector('.voice-handle');
  const progress = document.querySelector('.voice-progress');

  if (!container || !handle || !progress) return; // Exit if elements don't exist

  let isDragging = false;
  let lastKnownPercent = 50; // Start at "convencing" (professional)

  // Update for 4 points matching your option buttons
  const STEP_POINTS = [0, 25, 50, 75, 100]; // 4 evenly spaced points
  const VALUE_MAP = {
    0: 'simplify', // Uformel
    25: 'elaborate', // Personlig
    50: 'convencing', // Neutral
    75: 'concise', // Høflig
    100: 'professional' // Professionel
  };

  const VOICE_SETTINGS = {
    simplify: { title: 'Uformel', subtitle: 'Afslappet og venlig' },
    elaborate: { title: 'Personlig', subtitle: 'Varm og personlig' },
    convencing: { title: 'Neutral', subtitle: 'Klar og direkte' },
    concise: { title: 'Høflig', subtitle: 'Respektfuld og venlig' },
    professional: { title: 'Professionel', subtitle: 'Formel og autoritativ' }
  };

  function getGradientForPosition(percent) {
    const colors = {
      hverdagssprog: '#2DB62D',
      letAtForstaa: '#A122A1',
      formelt: '#6262F5',
      humor: '#F9AB1B'
    };

    if (percent <= STEP_POINTS[0]) {
      return colors.hverdagssprog;
    } else if (percent <= STEP_POINTS[1]) {
      return `linear-gradient(90deg, ${colors.hverdagssprog} 0%, ${colors.letAtForstaa} 100%)`;
    } else if (percent <= STEP_POINTS[2]) {
      return `linear-gradient(90deg, ${colors.hverdagssprog} 0%, ${colors.letAtForstaa} 33%, ${colors.formelt} 100%)`;
    } else {
      return `linear-gradient(90deg, ${colors.hverdagssprog} 0%, ${colors.letAtForstaa} 25%, ${colors.formelt} 50%, ${colors.humor} 100%)`;
    }
  }

  function getHandleColor(percent) {
    const colors = ['#2DB62D', '#A122A1', '#6262F5', '#F9AB1B'];
    const index = STEP_POINTS.findIndex(point => percent <= point);
    return colors[index !== -1 ? index : colors.length - 1];
  }

  function getSliderValue(percent) {
    const snappedPercent = STEP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - percent) < Math.abs(prev - percent) ? curr : prev
    );
    return VALUE_MAP[snappedPercent];
  }

  function updateVoiceCardSubtitle(optionId) {
    const titleElement = document.getElementById('voiceCardTitle');
    const subtitleElement = document.getElementById('voiceCardSubtitle');

    if (VOICE_SETTINGS[optionId] && titleElement && subtitleElement) {
      titleElement.textContent = VOICE_SETTINGS[optionId].title;
      subtitleElement.textContent = VOICE_SETTINGS[optionId].subtitle;
    }
  }

  function handleInteraction(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    let percent = Math.min(Math.max((x / rect.width) * 100, 0), 100);

    // Update slider position immediately for direct clicks
    if (!isDragging) {
      handle.style.left = `${percent}%`;
      progress.style.width = `${percent}%`;
      progress.style.background = getGradientForPosition(percent);
      handle.style.borderColor = getHandleColor(percent);

      // Then snap to nearest point
      percent = STEP_POINTS.reduce((prev, curr) =>
        Math.abs(curr - percent) < Math.abs(prev - percent) ? curr : prev
      );
    }

    lastKnownPercent = percent;
    updateSliderPosition(percent);
    return percent;
  }

  function updateSliderPosition(percent) {
    handle.style.left = `${percent}%`;
    progress.style.width = `${percent}%`;
    progress.style.background = getGradientForPosition(percent);
    handle.style.borderColor = getHandleColor(percent);

    sliderValue = getSliderValue(percent);
    updateVoiceCardSubtitle(sliderValue);
    console.log(`Slider Value: ${sliderValue}`);
  }

  function startDragging(e) {
    e.preventDefault();
    isDragging = true;
    handleInteraction(e);
    document.addEventListener(
      e.type.includes('touch') ? 'touchmove' : 'mousemove',
      handleInteraction
    );
  }

  function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    const snappedPercent = STEP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - lastKnownPercent) < Math.abs(prev - lastKnownPercent) ? curr : prev
    );
    updateSliderPosition(snappedPercent);
    document.removeEventListener('mousemove', handleInteraction);
    document.removeEventListener('touchmove', handleInteraction);
  }

  handle.addEventListener('mousedown', startDragging);
  handle.addEventListener('touchstart', startDragging);
  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('touchend', stopDragging);

  container.addEventListener('click', e => {
    if (e.target !== handle) {
      handleInteraction(e);
    }
  });

  // Initialize with "convencing" (formelt sprog)
  updateSliderPosition(50);

  // Add voice change button functionality
  // Add voice change button functionality
  document.getElementById('voiceChangeBtn')?.addEventListener('click', () => {
    // Check if text field has content
    if (!quill1.getText().trim().length) {
      return;
    }

    const currentOptionId = getSliderValue(lastKnownPercent);
    console.log(`Voice change requested with option: ${currentOptionId}`);

    // Trigger the existing button functionality
    const existingButton = document.getElementById(currentOptionId);
    if (existingButton) {
      existingButton.click();
    } else {
      console.warn(`Button with ID ${currentOptionId} not found`);
    }
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

// Function to update clear and revert button states (text-dependent)
function updateClearRevertButtonState(flag = 'center') {
  const revertBtn = document.querySelector('#revertBack');
  const clearBtn = document.querySelector('#clearBtn');

  if (flag === 'false') {
    if (revertBtn) revertBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  } else if (flag === 'true') {
    if (revertBtn) revertBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
  } else {
    const hasText = quill1.getText().trim().length > 0;
    if (revertBtn) revertBtn.disabled = !hasText;
    if (clearBtn) clearBtn.disabled = !hasText;
  }
}

// Function to update undo/redo button states (history-dependent)
function updateUndoRedoButtonState() {
  const revertBtn = document.querySelector('#revertBack');
  const redoBtn = document.querySelector('#redoBtn');

  if (revertBtn) {
    const canUndo = quill1.history.stack.undo.length > 0;
    const hasText = quill1.getText().trim().length > 0;
    // Undo requires both text and undo history
    revertBtn.disabled = !hasText || !canUndo;
    revertBtn.title = canUndo && hasText ? 'Fortryd (Ctrl+Z)' : 'Intet at fortryde';
  }

  if (redoBtn) {
    const canRedo = quill1.history.stack.redo.length > 0;
    // Redo only requires redo history, not current text
    redoBtn.disabled = !canRedo;
    redoBtn.title = canRedo ? 'Gentag (Ctrl+Y)' : 'Intet at gentage';
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

  // NEW:
  correctionSidebarLoader.showReadyState();
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
  updateUndoRedoButtonState(); // Also update undo/redo states after clear
}
// Add click event listener to clear button
clearButton.addEventListener('click', handleClear);

quill1.on('text-change', updateClearRevertButtonState);

document.addEventListener('keydown', e => {
  // Existing clear shortcut
  if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
    e.preventDefault();
    handleClear();
  }

  // Undo shortcut
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    const revertBtn = document.querySelector('#revertBack');
    if (revertBtn && !revertBtn.disabled) {
      quill1.history.undo();
    }
  }

  // Redo shortcut (Ctrl+Y or Ctrl+Shift+Z)
  if (
    ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')
  ) {
    e.preventDefault();
    const redoBtn = document.querySelector('#redoBtn');
    if (redoBtn && !redoBtn.disabled) {
      quill1.history.redo();
    }
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
      correctionSidebarLoader.hideCorrectionLoader('.correction-message');
      correctionSidebarLoader.toggleSmartLoader(false); // ✅ Hide after fallback completes
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
  correctionSidebarLoader.hideCorrectionLoader('.correction-message');
  correctionSidebarLoader.toggleSmartLoader(false); // ✅ Hide on error
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

  // Initialize undo/redo states
  updateUndoRedoButtonState();

  setTimeout(() => {
    if (typeof quill1 !== 'undefined') {
      console.log('Quill instance found:', quill1);
      window.selectionToolbar = initializeSelectionToolbar(quill1);
    } else {
      console.error('Quill instance (quill1) not found!');
    }
  }, 1000);
  initializeFileUpload({
    showLoader: (selector, text) => textAreaLoader.showTextAreaLoader(selector, text), // ✅ Properly bound
    hideLoader: selector => textAreaLoader.hideTextAreaLoader(selector), // ✅ Properly bound
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
    showLoader: (selector, text) => textAreaLoader.showTextAreaLoader(selector, text), // ✅ Properly bound
    hideLoader: selector => textAreaLoader.hideTextAreaLoader(selector), // ✅ Properly bound
    originalContent,
    languageMap,
    getCurrentLanguage,
    HGF_ajax_object,
    dkHamdanCloseModal,
    clearHighlights, // ADD THIS
    manuallyCloseMicButton // ADD THIS
  });
});

// Tutorial Popup Functionality
document.addEventListener('DOMContentLoaded', function () {
  // Get DOM elements
  const showTutorialBtn = document.getElementById('show-tutorial-btn');
  const modal = document.getElementById('tutorial-popup');
  const closeBtn = document.querySelector('.tutorial-close-btn');
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
window.correctionSidebarLoader = correctionSidebarLoader;
window.resetNavText = resetNavText;
window.handleClear = handleClear;
window.resetNavText = resetNavText;
window.showNavigation = showNavigation;
// Add these to your existing window exports:
window.dkHamdanOpenModal = dkHamdanOpenModal;
window.dkHamdanCloseModal = dkHamdanCloseModal;

document.addEventListener('DOMContentLoaded', () => {
  const topControlsDiv = document.querySelector('.top-controls');
  const middleControlsDiv = document.querySelector('.middle-controls');
  const rightControlsDiv = document.querySelector('.right-controls');
  const clearBtn = document.getElementById('clearBtn');

  console.log('Left,Mid,Right--DOM loaded!!!');

  if (!middleControlsDiv || !rightControlsDiv || !clearBtn) {
    console.warn('❌ Required elements not found in DOM');
    return;
  }

  const originalParent = middleControlsDiv.parentElement;
  const originalNextSibling = middleControlsDiv.nextElementSibling;
  let isMoved = false;

  // Function to handle the layout change based on screen size
  const handleResize = () => {
    const screenWidth = window.innerWidth;
    const isWithinRange = screenWidth >= 300 && screenWidth <= 426;

    if (isWithinRange && !isMoved) {
      console.log('MOBILE SIZE IS ON!!');
      // Move middle-controls into right-controls before clearBtn
      rightControlsDiv.insertBefore(middleControlsDiv, clearBtn);
      isMoved = true;
    } else if (!isWithinRange && isMoved) {
      console.log('PC SIZE IS ON!!');
      // Move middle-controls back to its original position
      originalParent.insertBefore(middleControlsDiv, originalNextSibling);
      isMoved = false;
    }
  };

  // Call on load and on resize
  window.addEventListener('resize', handleResize);
  handleResize(); // Initial call
});
